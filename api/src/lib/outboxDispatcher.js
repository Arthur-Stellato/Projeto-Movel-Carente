const prisma = require('./prisma');
const logger = require('./logger');
const { enfileirarEmail } = require('../queues/email.queue');

// Depois de tantas tentativas falhas seguidas, desiste e marca como "falhou"
// em vez de tentar pra sempre — evita um evento com problema de verdade (ex:
// payload malformado) ficando preso reprocessando eternamente. Fica visível
// pra investigação manual em vez de sumir silenciosamente.
const MAX_TENTATIVAS = 5;
const LOTE_POR_CICLO = 20;

// Cada "tipo" de evento sabe se despachar sozinho — hoje só email existe,
// mas isso deixa aberto pra registrar outros tipos de job (ex: notificações)
// sem precisar mexer no loop de processamento em si.
const DESPACHANTES = {
  email: (payload) => enfileirarEmail(payload),
};

async function processarEventosPendentes(limite = LOTE_POR_CICLO) {
  const pendentes = await prisma.eventoOutbox.findMany({
    where: { status: 'pendente' },
    orderBy: { criadoEm: 'asc' },
    take: limite,
  });

  let processados = 0;
  let falharam = 0;

  for (const evento of pendentes) {
    const despachar = DESPACHANTES[evento.tipo];

    if (!despachar) {
      // Tipo desconhecido não é um erro transitório (Redis fora do ar, por
      // exemplo) — reprocessar não vai resolver, então marca falhou direto.
      await prisma.eventoOutbox.update({
        where: { id: evento.id },
        data: { status: 'falhou', ultimoErro: `Tipo de evento desconhecido: "${evento.tipo}"` },
      });
      falharam++;
      continue;
    }

    try {
      await despachar(evento.payload);
      await prisma.eventoOutbox.update({
        where: { id: evento.id },
        data: { status: 'processado', processadoEm: new Date() },
      });
      processados++;
    } catch (err) {
      const tentativas = evento.tentativas + 1;
      const status = tentativas >= MAX_TENTATIVAS ? 'falhou' : 'pendente';

      await prisma.eventoOutbox.update({
        where: { id: evento.id },
        data: { tentativas, status, ultimoErro: err.message },
      });

      if (status === 'falhou') {
        logger.error({ eventoId: evento.id, tipo: evento.tipo, err }, '[outbox] Evento desistido após esgotar tentativas');
      }
      falharam++;
    }
  }

  return { total: pendentes.length, processados, falharam };
}

// Loop de fundo: roda a cada `intervaloMs`, processando o que estiver
// pendente. Chamado a partir do processo do worker de email (ver
// src/workers/email.worker.js) — não é um processo separado, pra não
// complicar o deploy com mais um script pra rodar.
function iniciarDispatcherOutbox(intervaloMs = 5000) {
  const executar = async () => {
    try {
      const resultado = await processarEventosPendentes();
      if (resultado.total > 0) {
        logger.info(resultado, '[outbox] Ciclo de processamento concluído');
      }
    } catch (err) {
      // Falha no ciclo inteiro (ex: Postgres fora do ar) — loga e tenta de
      // novo no próximo ciclo, não derruba o worker.
      logger.error({ err }, '[outbox] Erro no ciclo de processamento');
    }
  };

  const timer = setInterval(executar, intervaloMs);
  executar(); // primeira execução imediata, não espera o primeiro intervalo
  return timer;
}

module.exports = { processarEventosPendentes, iniciarDispatcherOutbox, MAX_TENTATIVAS };

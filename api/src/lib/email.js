const nodemailer = require('nodemailer');
const logger = require('./logger');

// SMTP é opcional de propósito — não entra em OBRIGATORIAS de validarEnv.js.
// Sem SMTP_HOST configurado (o padrão em desenvolvimento, ver .env.example),
// o email só é impresso no console do worker em vez de enviado de verdade —
// mesmo espírito do fallback já usado pro CEP_PROVIDER: dá pra desenvolver e
// testar o fluxo de ponta a ponta (registro → token → link) sem precisar de
// nenhuma credencial externa.
//
// Checado a cada chamada (não como constante de módulo) de propósito — assim
// o comportamento reage a mudanças de ambiente em teste sem precisar recarregar
// o módulo, e a decisão de qual caminho seguir fica sempre óbvia lendo a
// própria função, sem estado escondido calculado uma vez lá no topo do arquivo.
function smtpConfigurado() {
  return Boolean(process.env.SMTP_HOST);
}

// Uma instância nova por envio, em vez de um transportador único cacheado no
// módulo: o volume aqui é baixo (é um worker de fila, não um hot path), e criar
// na hora evita qualquer risco de reusar uma conexão/config presa de um estado
// anterior — o nodemailer já faz o próprio pool de conexão por baixo quando
// necessário.
function criarTransportador() {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    secure: process.env.SMTP_SECURE === 'true', // true = SSL implícito (porta 465); STARTTLS nas demais
    auth: process.env.SMTP_USER
      ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
      : undefined, // servidores de captura local (Mailpit, Mailhog, smtp4dev) costumam nem exigir auth
  });
}

function imprimirPreview({ para, assunto, html, texto }) {
  const corpo = texto || (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  logger.info(
    `\n${'─'.repeat(60)}\n[EMAIL — preview, SMTP não configurado]\nPara: ${para}\nAssunto: ${assunto}\n\n${corpo}\n${'─'.repeat(60)}`
  );
}

async function enviarEmail({ para, assunto, html, texto }) {
  // Falha rápido e com mensagem clara em vez de deixar o nodemailer (ou o SMTP
  // remoto) reclamar de um jeito mais obscuro lá na frente — este é o tipo de
  // erro de programação (payload montado errado em algum service), não algo
  // que uma nova tentativa do BullMQ resolveria, então nem chega a tentar enviar.
  if (!para || !assunto || (!html && !texto)) {
    throw new Error('enviarEmail requer "para", "assunto" e pelo menos um de "html" ou "texto"');
  }

  if (!smtpConfigurado()) {
    imprimirPreview({ para, assunto, html, texto });
    return;
  }

  try {
    await criarTransportador().sendMail({
      from: process.env.SMTP_FROM || '"MóvelCarente" <nao-responda@movelcarente.com.br>',
      to: para,
      subject: assunto,
      html,
      text: texto,
    });
  } catch (err) {
    // Propaga o erro original do nodemailer (código, resposta do servidor SMTP)
    // em vez de mascará-lo com uma mensagem genérica — é o que o BullMQ usa pra
    // decidir o retry (3 tentativas, backoff exponencial — ver queues/email.queue.js)
    // e o que aparece no log "[EMAIL WORKER] Falha ao enviar email" do worker.
    // Logamos aqui também porque, se as 3 tentativas se esgotarem, esse log é o
    // único rastro que sobra — o evento na Outbox já foi marcado "processado"
    // no momento em que caiu na fila, bem antes de sabermos se o envio real deu certo.
    logger.error({ err, para, assunto }, 'Falha ao enviar email via SMTP');
    throw err;
  }
}

module.exports = { enviarEmail };
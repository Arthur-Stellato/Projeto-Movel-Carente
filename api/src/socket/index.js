const { Server } = require('socket.io');
const logger = require('../lib/logger');
const { verificarAccessToken } = require('../lib/token');
const { origensPermitidas } = require('../lib/origensPermitidas');
const { validarUuid } = require('../lib/validadores');
const { buscarSolicitacaoComItem, ehParticipante } = require('../lib/participanteSolicitacao');
const mensagemService = require('../services/mensagem.service');
const mensagemValidation = require('../validations/mensagem.validation');
const { clienteRedis } = require('../config/rateLimiter');

function nomeDaSala(solicitacaoId) {
  return `solicitacao:${solicitacaoId}`;
}

// Fase 10: limite de taxa por evento de chat. Sockets não passam pelo
// rate limiter HTTP (limitadorGeral/limitadorAuth) de jeito nenhum — aquele
// é middleware do Express, só roda em requisição REST. Sem isso, nada
// impedia alguém de disparar 'mensagem:enviar' (ou qualquer outro evento)
// em loop pelo socket.
//
// Reaproveita o MESMO cliente Redis do rate limiter HTTP (config/
// rateLimiter.js) — sem abrir uma conexão nova — e a MESMA filosofia de
// fail-open de lá: se o Redis cair, o chat continua funcionando sem limite
// em vez de travar. Tempo real vale mais que a proteção nesse cenário
// extremo, e é a mesma escolha que já foi feita pra API REST inteira.
const JANELA_LIMITE_MS = 60 * 1000; // 1 minuto
const LIMITE_GERAL_POR_MINUTO = 120; // todos os eventos de chat somados, por usuário
const LIMITE_ENVIO_POR_MINUTO = 20; // mensagem:enviar é o mais caro (grava no banco + enfileira notificação)

async function dentroDoLimite(chave, limite, janelaMs) {
  try {
    const contagem = await clienteRedis.incr(chave);
    if (contagem === 1) {
      await clienteRedis.pexpire(chave, janelaMs);
    }
    return contagem <= limite;
  } catch (err) {
    logger.error({ err, chave }, '[socket] Erro no Redis ao checar limite de taxa — fail-open, evento permitido');
    return true;
  }
}

// Fase 11: presença online, por CONVERSA (não global). "Online" aqui
// significa "tem uma conexão de socket aberta e está com esta conversa
// aberta agora" — não "tem o app aberto em algum lugar". É o sinal que
// realmente importa pro doador/solicitante ("será que a pessoa tá vendo
// isso agora?"), e evita ter que decidir o que "online globalmente"
// significaria pra alguém sem nenhuma conversa aberta.
//
// Guardado em memória do processo, de propósito — não no Redis, diferente
// do limite de taxa da fase 10. O motivo: o broadcast do Socket.IO em si
// (io.to(sala).emit(...), usado desde a fase 4) já só alcança sockets
// conectados a ESTE processo — não existe adaptador Redis pro Socket.IO
// configurado aqui. Guardar presença no Redis criaria a ilusão de suportar
// múltiplas instâncias quando o mecanismo de broadcast por trás nem
// suporta; o dia que isso for adicionado, os dois (adaptador + presença)
// têm que mudar juntos.
//
// Map<sala, Map<usuarioId, quantidade de sockets deste usuário nesta sala>>
// — o contador (não um boolean) é o que permite várias abas/dispositivos
// abertos na mesma conversa sem que a primeira aba fechada derrube a
// presença enquanto a segunda ainda está lá.
const presencaPorSala = new Map();

function configurarSocket(servidorHttp) {
  const io = new Server(servidorHttp, {
    // CORS do Socket.IO é uma configuração própria, independente da do
    // Express — não herda a de app.js só por rodar no mesmo processo, por
    // isso reaproveita a MESMA função em vez de duplicar a lista.
    cors: { origin: origensPermitidas(), credentials: true },
  });

  // Roda uma vez, na conexão — bem diferente do middleware HTTP, que roda a
  // cada requisição. Uma vez que passa daqui, socket.usuario fica disponível
  // pelo resto da vida da conexão (não precisa reverificar a cada evento).
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token;
    if (!token) {
      return next(new Error('Token de acesso não fornecido'));
    }
    try {
      socket.usuario = verificarAccessToken(token);
      return next();
    } catch {
      return next(new Error('Token de acesso inválido ou expirado'));
    }
  });

  io.on('connection', (socket) => {
    logger.info({ usuarioId: socket.usuario.id }, 'Socket conectado');

    // Fase 11: entra na sala rastreando presença (não é só socket.join cru).
    // Idempotente do jeito certo: se ESTE socket já estava na sala, não
    // conta de novo (evita inflar o contador toda vez que enviar/digitando/
    // marcar_lida chamam isso defensivamente). Só dispara o broadcast de
    // "ficou online" quando é a PRIMEIRA conexão deste usuário nesta sala
    // (contagem 0 → 1) — a segunda aba do mesmo usuário não gera um segundo
    // aviso.
    function entrarNaSalaComPresenca(sala) {
      if (socket.rooms.has(sala)) return; // já contabilizado antes por este socket
      socket.join(sala);

      if (!presencaPorSala.has(sala)) presencaPorSala.set(sala, new Map());
      const usuariosNaSala = presencaPorSala.get(sala);
      const contagemAnterior = usuariosNaSala.get(socket.usuario.id) || 0;
      usuariosNaSala.set(socket.usuario.id, contagemAnterior + 1);

      if (contagemAnterior === 0) {
        socket.to(sala).emit('solicitacao:presenca', { usuarioId: socket.usuario.id, online: true });
      }
    }

    // Envolve um handler de evento com checagem de limite de taxa: um
    // contador GERAL (todos os eventos de chat deste usuário somados) mais,
    // opcionalmente, um contador ESPECÍFICO mais apertado pro evento em
    // questão — mesma dupla camada que a API REST já usa (limitadorGeral +
    // limitadorAuth). Estourou qualquer um dos dois, o handler de verdade
    // nem chega a rodar.
    function comLimiteDeTaxa(nomeEvento, limiteEspecifico, handler) {
      return async (payload) => {
        const chaveGeral = `rl:socket:geral:${socket.usuario.id}`;
        const checagens = [dentroDoLimite(chaveGeral, LIMITE_GERAL_POR_MINUTO, JANELA_LIMITE_MS)];

        if (limiteEspecifico) {
          const chaveEspecifica = `rl:socket:${nomeEvento}:${socket.usuario.id}`;
          checagens.push(dentroDoLimite(chaveEspecifica, limiteEspecifico, JANELA_LIMITE_MS));
        }

        const resultados = await Promise.all(checagens);
        if (resultados.some((permitido) => !permitido)) {
          return socket.emit('erro', {
            mensagem: 'Muitas ações em pouco tempo. Aguarde um instante.',
            codigo: 'LIMITE_EXCEDIDO',
          });
        }

        return handler(payload);
      };
    }

    // Uma sala por solicitação (não por usuário) — assim, 'mensagem:nova'
    // (handler logo abaixo) chega pras duas partes com um único
    // io.to(sala).emit(...), sem o servidor precisar rastrear os ids de
    // socket de cada uma individualmente.
    socket.on('solicitacao:entrar', comLimiteDeTaxa('solicitacao:entrar', null, async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;

      if (!solicitacaoId || !validarUuid(solicitacaoId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId inválido' });
      }

      try {
        const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
        if (!ehParticipante(solicitacao, socket.usuario.id)) {
          return socket.emit('erro', { mensagem: 'Você não participa desta solicitação' });
        }
        const sala = nomeDaSala(solicitacaoId);
        entrarNaSalaComPresenca(sala);
        // Fase 11: quem chegou agora precisa saber quem JÁ estava online —
        // o broadcast de "ficou online" só alcança quem já estava na sala
        // no momento em que aconteceu, então sem isso a pessoa só ficaria
        // sabendo de mudanças de presença DAQUI PRA FRENTE, nunca do estado
        // atual (ex: a outra parte entrou 5 minutos antes).
        const usuariosNaSala = presencaPorSala.get(sala);
        const usuariosOnline = usuariosNaSala
          ? [...usuariosNaSala.keys()].filter((id) => id !== socket.usuario.id)
          : [];
        socket.emit('solicitacao:entrou', { solicitacaoId, usuariosOnline });
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível entrar na conversa' });
      }
    }));

    // Fase 4: envio em tempo real. A autorização de verdade (é participante?
    // a conversa ainda está aberta pra novo envio?) mora inteiramente dentro
    // de mensagem.service.js — o MESMO service que a rota REST da fase 2
    // usa. Este handler não reimplementa nenhuma regra de negócio, só traduz
    // evento de socket em chamada de service e o resultado em broadcast.
    socket.on('mensagem:enviar', comLimiteDeTaxa('mensagem:enviar', LIMITE_ENVIO_POR_MINUTO, async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;

      if (!solicitacaoId || !validarUuid(solicitacaoId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId inválido' });
      }

      // Reaproveita o MESMO schema Joi da rota POST /solicitacoes/:id/mensagens
      // — sem isso, um evento de socket poderia mandar conteudo vazio ou
      // gigante sem nenhuma validação, já que sockets não passam pelo
      // middleware `validar()` do Express de jeito nenhum.
      const { error, value } = mensagemValidation.enviar.validate({
        conteudo: payload?.conteudo,
        anexoUrl: payload?.anexoUrl,
        anexoTipo: payload?.anexoTipo,
      });
      if (error) {
        return socket.emit('erro', { mensagem: error.details[0].message });
      }

      try {
        const mensagem = await mensagemService.enviarMensagem(solicitacaoId, socket.usuario.id, value);
        const sala = nomeDaSala(solicitacaoId);
        // Garante que quem mandou também está na sala antes de emitir — não
        // depende do cliente ter chamado 'solicitacao:entrar' antes (join é
        // idempotente: chamar de novo pra uma sala que já se está não faz
        // nada). Sem isso, o próprio remetente não veria a própria mensagem
        // aparecer via o broadcast, só a outra parte.
        entrarNaSalaComPresenca(sala);
        io.to(sala).emit('mensagem:nova', { mensagem });
        // Fase 7: some com o "digitando..." assim que a mensagem chega — sem
        // isso, o indicador ficaria visível na tela da outra parte por mais
        // alguns segundos, até o cliente do remetente mandar o
        // "parou de digitar" por conta própria (evento separado, sujeito a
        // atraso de debounce).
        socket.to(sala).emit('mensagem:usuario_digitando', { usuarioId: socket.usuario.id, digitando: false });
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível enviar a mensagem' });
      }
    }));

    // Fase 6: mesma receita da fase 4 — o handler só traduz evento em chamada
    // de service (toda regra de negócio, incluindo a janela de 15 minutos,
    // mora em mensagem.service.js) e o resultado em broadcast pra sala.
    socket.on('mensagem:editar', comLimiteDeTaxa('mensagem:editar', null, async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;
      const mensagemId = payload?.mensagemId;

      if (!solicitacaoId || !validarUuid(solicitacaoId) || !mensagemId || !validarUuid(mensagemId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId ou mensagemId inválido' });
      }

      const { error, value } = mensagemValidation.editar.validate({ conteudo: payload?.conteudo });
      if (error) {
        return socket.emit('erro', { mensagem: error.details[0].message });
      }

      try {
        const mensagem = await mensagemService.editarMensagem(solicitacaoId, mensagemId, socket.usuario.id, value.conteudo);
        io.to(nomeDaSala(solicitacaoId)).emit('mensagem:editada', { mensagem });
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível editar a mensagem' });
      }
    }));

    socket.on('mensagem:deletar', comLimiteDeTaxa('mensagem:deletar', null, async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;
      const mensagemId = payload?.mensagemId;

      if (!solicitacaoId || !validarUuid(solicitacaoId) || !mensagemId || !validarUuid(mensagemId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId ou mensagemId inválido' });
      }

      try {
        const mensagem = await mensagemService.deletarMensagem(solicitacaoId, mensagemId, socket.usuario.id);
        io.to(nomeDaSala(solicitacaoId)).emit('mensagem:deletada', { mensagem });
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível apagar a mensagem' });
      }
    }));

    // Fase 7: indicador de "digitando...". Puramente efêmero — nada é
    // persistido no banco, é só um sinal de UI em tempo real. Por isso não
    // existe rota REST equivalente (não faria sentido "consultar" quem
    // estava digitando ontem). Broadcast usa socket.to() (não io.to()) de
    // propósito: quem está digitando não precisa ver o próprio indicador de
    // volta — diferente de 'mensagem:enviar', que usa io.to() porque o
    // remetente PRECISA ver a própria mensagem aparecer.
    socket.on('mensagem:digitando', comLimiteDeTaxa('mensagem:digitando', null, async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;
      const digitando = payload?.digitando;

      if (!solicitacaoId || !validarUuid(solicitacaoId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId inválido' });
      }
      if (typeof digitando !== 'boolean') {
        return socket.emit('erro', { mensagem: 'digitando precisa ser true ou false' });
      }

      try {
        const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
        if (!ehParticipante(solicitacao, socket.usuario.id)) {
          return socket.emit('erro', { mensagem: 'Você não participa desta solicitação' });
        }
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível processar o indicador de digitação' });
      }

      const sala = nomeDaSala(solicitacaoId);
      entrarNaSalaComPresenca(sala);
      socket.to(sala).emit('mensagem:usuario_digitando', { usuarioId: socket.usuario.id, digitando });
    }));

    // Fase 8: confirmação de leitura. O GET REST de histórico já marca como
    // lida no banco (garante que fica correto mesmo se o socket cair) — este
    // evento existe só pra avisar a OUTRA parte em tempo real (check ✓✓
    // aparecendo na hora). O cliente dispara os dois ao abrir a tela do chat.
    socket.on('mensagem:marcar_lida', comLimiteDeTaxa('mensagem:marcar_lida', null, async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;

      if (!solicitacaoId || !validarUuid(solicitacaoId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId inválido' });
      }

      try {
        const { marcadas } = await mensagemService.marcarComoLida(solicitacaoId, socket.usuario.id);
        if (marcadas > 0) {
          const sala = nomeDaSala(solicitacaoId);
          entrarNaSalaComPresenca(sala);
          socket.to(sala).emit('mensagem:lida', { lidoPor: socket.usuario.id });
        }
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível marcar as mensagens como lidas' });
      }
    }));

    // 'disconnecting' (não 'disconnect') roda ANTES do socket sair das
    // salas — é a única janela em que socket.rooms ainda reflete onde ele
    // estava. Sem isso, se a aba fechar ou a conexão cair no meio de um
    // "digitando" ou de uma presença online, os dois ficariam presos pra
    // sempre do lado de quem ficou — o cliente que caiu nunca vai chegar a
    // mandar "parou de digitar" nem "fiquei offline" por conta própria.
    socket.on('disconnecting', () => {
      for (const sala of socket.rooms) {
        if (!sala.startsWith('solicitacao:')) continue;

        socket.to(sala).emit('mensagem:usuario_digitando', { usuarioId: socket.usuario.id, digitando: false });

        // Fase 11: só derruba a presença se ESTA era a última conexão do
        // usuário nesta sala (outra aba/dispositivo aberto na mesma
        // conversa mantém a presença em pé).
        const usuariosNaSala = presencaPorSala.get(sala);
        if (!usuariosNaSala) continue;

        const restante = (usuariosNaSala.get(socket.usuario.id) || 1) - 1;
        if (restante <= 0) {
          usuariosNaSala.delete(socket.usuario.id);
          socket.to(sala).emit('solicitacao:presenca', { usuarioId: socket.usuario.id, online: false });
        } else {
          usuariosNaSala.set(socket.usuario.id, restante);
        }
        if (usuariosNaSala.size === 0) presencaPorSala.delete(sala);
      }
    });

    socket.on('disconnect', () => {
      logger.info({ usuarioId: socket.usuario.id }, 'Socket desconectado');
    });
  });

  return io;
}

module.exports = configurarSocket;

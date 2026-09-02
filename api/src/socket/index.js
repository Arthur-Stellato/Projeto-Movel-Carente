const { Server } = require('socket.io');
const logger = require('../lib/logger');
const { verificarAccessToken } = require('../lib/token');
const { origensPermitidas } = require('../lib/origensPermitidas');
const { validarUuid } = require('../lib/validadores');
const { buscarSolicitacaoComItem, ehParticipante } = require('../lib/participanteSolicitacao');
const mensagemService = require('../services/mensagem.service');
const mensagemValidation = require('../validations/mensagem.validation');

function nomeDaSala(solicitacaoId) {
  return `solicitacao:${solicitacaoId}`;
}

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

    // Uma sala por solicitação (não por usuário) — assim, 'mensagem:nova'
    // (handler logo abaixo) chega pras duas partes com um único
    // io.to(sala).emit(...), sem o servidor precisar rastrear os ids de
    // socket de cada uma individualmente.
    socket.on('solicitacao:entrar', async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;

      if (!solicitacaoId || !validarUuid(solicitacaoId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId inválido' });
      }

      try {
        const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
        if (!ehParticipante(solicitacao, socket.usuario.id)) {
          return socket.emit('erro', { mensagem: 'Você não participa desta solicitação' });
        }
        socket.join(nomeDaSala(solicitacaoId));
        socket.emit('solicitacao:entrou', { solicitacaoId });
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível entrar na conversa' });
      }
    });

    // Fase 4: envio em tempo real. A autorização de verdade (é participante?
    // a conversa ainda está aberta pra novo envio?) mora inteiramente dentro
    // de mensagem.service.js — o MESMO service que a rota REST da fase 2
    // usa. Este handler não reimplementa nenhuma regra de negócio, só traduz
    // evento de socket em chamada de service e o resultado em broadcast.
    socket.on('mensagem:enviar', async (payload) => {
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
        socket.join(sala);
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
    });

    // Fase 6: mesma receita da fase 4 — o handler só traduz evento em chamada
    // de service (toda regra de negócio, incluindo a janela de 15 minutos,
    // mora em mensagem.service.js) e o resultado em broadcast pra sala.
    socket.on('mensagem:editar', async (payload) => {
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
    });

    socket.on('mensagem:deletar', async (payload) => {
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
    });

    // Fase 7: indicador de "digitando...". Puramente efêmero — nada é
    // persistido no banco, é só um sinal de UI em tempo real. Por isso não
    // existe rota REST equivalente (não faria sentido "consultar" quem
    // estava digitando ontem). Broadcast usa socket.to() (não io.to()) de
    // propósito: quem está digitando não precisa ver o próprio indicador de
    // volta — diferente de 'mensagem:enviar', que usa io.to() porque o
    // remetente PRECISA ver a própria mensagem aparecer.
    socket.on('mensagem:digitando', async (payload) => {
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
      socket.join(sala);
      socket.to(sala).emit('mensagem:usuario_digitando', { usuarioId: socket.usuario.id, digitando });
    });

    // 'disconnecting' (não 'disconnect') roda ANTES do socket sair das
    // salas — é a única janela em que socket.rooms ainda reflete onde ele
    // estava. Sem isso, se a aba fechar ou a conexão cair no meio de um
    // "digitando", o indicador ficaria preso pra sempre do lado de quem
    // ficou — o cliente que caiu nunca vai chegar a mandar o "parou de
    // digitar" por conta própria.
    // Fase 8: confirmação de leitura. O GET REST de histórico já marca como
    // lida no banco (garante que fica correto mesmo se o socket cair) — este
    // evento existe só pra avisar a OUTRA parte em tempo real (check ✓✓
    // aparecendo na hora). O cliente dispara os dois ao abrir a tela do chat.
    socket.on('mensagem:marcar_lida', async (payload) => {
      const solicitacaoId = payload?.solicitacaoId;

      if (!solicitacaoId || !validarUuid(solicitacaoId)) {
        return socket.emit('erro', { mensagem: 'solicitacaoId inválido' });
      }

      try {
        const { marcadas } = await mensagemService.marcarComoLida(solicitacaoId, socket.usuario.id);
        if (marcadas > 0) {
          const sala = nomeDaSala(solicitacaoId);
          socket.join(sala);
          socket.to(sala).emit('mensagem:lida', { lidoPor: socket.usuario.id });
        }
      } catch (err) {
        return socket.emit('erro', { mensagem: err.message || 'Não foi possível marcar as mensagens como lidas' });
      }
    });

    socket.on('disconnecting', () => {
      for (const sala of socket.rooms) {
        if (sala.startsWith('solicitacao:')) {
          socket.to(sala).emit('mensagem:usuario_digitando', { usuarioId: socket.usuario.id, digitando: false });
        }
      }
    });

    socket.on('disconnect', () => {
      logger.info({ usuarioId: socket.usuario.id }, 'Socket desconectado');
    });
  });

  return io;
}

module.exports = configurarSocket;

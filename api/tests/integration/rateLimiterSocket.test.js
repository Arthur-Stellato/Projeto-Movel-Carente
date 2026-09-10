// Mesmo setup de infraestrutura usado em chat.socket.test.js (servidor http
// de verdade + socket.io-client) — ver comentário lá pro porquê de não dar
// pra usar Supertest aqui.
const http = require('http');
const { io: ioClient } = require('socket.io-client');
const configurarSocket = require('../../src/socket');
const { gerarAccessToken } = require('../../src/lib/token');
const prisma = require('../../src/lib/prisma');
const { clienteRedis } = require('../../src/config/rateLimiter');

let servidor;
let url;
const socketsAbertos = [];

beforeAll((done) => {
  servidor = http.createServer();
  configurarSocket(servidor);
  servidor.listen(0, () => {
    url = `http://localhost:${servidor.address().port}`;
    done();
  });
});

afterAll((done) => {
  servidor.close(done);
});

afterEach(() => {
  while (socketsAbertos.length) socketsAbertos.pop().disconnect();
  // Volta ao default "sempre permite" pra não vazar override de um teste
  // pro próximo (mesma disciplina já usada pra clienteRedis.ping noutros
  // arquivos — cada teste configura o que precisa, do zero).
  clienteRedis.incr.mockResolvedValue(1);
  clienteRedis.pexpire.mockResolvedValue(1);
  clienteRedis.pexpire.mockClear();
});

function conectar(token) {
  return new Promise((resolve, reject) => {
    const socket = ioClient(url, {
      auth: { token },
      transports: ['websocket'],
      forceNew: true,
      reconnection: false,
    });
    socketsAbertos.push(socket);
    socket.on('connect', () => resolve(socket));
    socket.on('connect_error', reject);
  });
}

function aguardarEvento(socket, evento) {
  return new Promise((resolve) => socket.once(evento, resolve));
}

function tokenPara(usuarioId) {
  return gerarAccessToken({ id: usuarioId, tipo: 'usuario' });
}

const SOLICITACAO_ID = '11111111-1111-4111-8111-111111111111';
const DOADOR_ID = '22222222-2222-4222-8222-222222222222';
const SOLICITANTE_ID = '33333333-3333-4333-8333-333333333333';

const SOLICITACAO_FAKE = {
  id: SOLICITACAO_ID,
  solicitanteId: SOLICITANTE_ID,
  status: 'aceita',
  item: { id: 'item-1', doadorId: DOADOR_ID, titulo: 'Sofá 3 lugares' },
};

describe('Fase 10: limite de taxa nos eventos de socket', () => {
  test('dentro do limite: evento é processado normalmente', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    clienteRedis.incr.mockResolvedValue(1); // "primeira" chamada da janela, bem abaixo de qualquer limite

    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });

    // Nenhum 'erro' deveria chegar — se chegasse, seria o de limite excedido
    let recebeuErro = false;
    socket.on('erro', () => {
      recebeuErro = true;
    });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recebeuErro).toBe(false);
  });

  test('limite GERAL estourado: bloqueia o evento antes de rodar o handler de verdade', async () => {
    clienteRedis.incr.mockResolvedValue(999); // muito acima do LIMITE_GERAL_POR_MINUTO (120)

    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });

    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.codigo).toBe('LIMITE_EXCEDIDO');
    expect(erro.mensagem).toMatch(/Muitas ações/);
    // Prova de que o handler de verdade nem rodou: nunca chegou a consultar a solicitação.
    expect(prisma.solicitacaoItem.findUnique).not.toHaveBeenCalled();
  });

  test('limite ESPECÍFICO de mensagem:enviar estourado mesmo com o geral OK', async () => {
    clienteRedis.incr.mockImplementation((chave) => {
      if (chave.includes(':mensagem:enviar:')) return Promise.resolve(999); // estoura o específico (limite 20)
      return Promise.resolve(1); // o contador geral está tranquilo
    });

    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'oi' });

    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.codigo).toBe('LIMITE_EXCEDIDO');
    // Prova de que o service nem chegou a ser chamado (nada gravado no banco).
    expect(prisma.mensagem.create).not.toHaveBeenCalled();
  });

  test('outros eventos continuam liberados quando só o limite ESPECÍFICO de enviar estourou', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    clienteRedis.incr.mockImplementation((chave) => {
      if (chave.includes(':mensagem:enviar:')) return Promise.resolve(999);
      return Promise.resolve(1);
    });

    const socket = await conectar(tokenPara(DOADOR_ID));
    let recebeuErro = false;
    socket.on('erro', () => {
      recebeuErro = true;
    });

    // 'mensagem:digitando' não tem limite específico — só entra no geral, que está OK
    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recebeuErro).toBe(false);
  });

  test('fail-open: se o Redis falhar, o evento é permitido mesmo assim', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    clienteRedis.incr.mockRejectedValue(new Error('Redis indisponível'));

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const recebida = aguardarEvento(socketSolicitante, 'mensagem:usuario_digitando');
    socketDoador.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });

    // O broadcast chegou normalmente — prova de que o Redis falhando não travou o chat.
    const evento = await recebida;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, digitando: true });
  });

  test('pexpire só é chamado na primeira requisição da janela (contagem === 1)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    clienteRedis.incr.mockResolvedValue(1);

    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(clienteRedis.pexpire).toHaveBeenCalled();

    clienteRedis.pexpire.mockClear();
    clienteRedis.incr.mockResolvedValue(2); // já não é mais a primeira da janela

    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: false });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(clienteRedis.pexpire).not.toHaveBeenCalled();
  });
});

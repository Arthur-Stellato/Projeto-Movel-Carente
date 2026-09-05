// Diferente das rotas HTTP (testadas via Supertest, sem precisar de uma porta
// de verdade), o Socket.IO precisa de um servidor de verdade escutando —
// Supertest não serve pra isso. Sobe um http.Server numa porta aleatória
// (porta 0 = o SO escolhe uma livre) só pra esta suíte, e conecta com o
// cliente oficial (socket.io-client) contra ele.
const http = require('http');
const jwt = require('jsonwebtoken');
const { io: ioClient } = require('socket.io-client');
const configurarSocket = require('../../src/socket');
const { gerarAccessToken } = require('../../src/lib/token');
const prisma = require('../../src/lib/prisma');

let servidor;
let io;
let url;
const socketsAbertos = [];

beforeAll((done) => {
  servidor = http.createServer();
  io = configurarSocket(servidor);
  servidor.listen(0, () => {
    url = `http://localhost:${servidor.address().port}`;
    done();
  });
});

afterAll((done) => {
  servidor.close(done);
});

afterEach(() => {
  // Rede de segurança: desconecta qualquer socket que um teste tenha deixado
  // aberto (ex: um teste que falhou antes de chegar no disconnect() dele
  // mesmo) — evita que uma conexão de um teste vaze pro próximo.
  while (socketsAbertos.length) socketsAbertos.pop().disconnect();
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

function tokenPara(usuarioId, tipo = 'usuario') {
  return gerarAccessToken({ id: usuarioId, tipo });
}

// IDs falsos, mas em formato de UUID de verdade (versão 4, variante correta)
// — o handler valida formato antes de consultar o banco, então um id tipo
// "sol-1" nunca passaria dessa checagem pra sequer chegar no mock do Prisma.
const SOLICITACAO_ID = '11111111-1111-4111-8111-111111111111';
const DOADOR_ID = '22222222-2222-4222-8222-222222222222';
const SOLICITANTE_ID = '33333333-3333-4333-8333-333333333333';
const ESTRANHO_ID = '44444444-4444-4444-8444-444444444444';
const USUARIO_ID = '55555555-5555-4555-8555-555555555555';
const SOL_INEXISTENTE_ID = '99999999-9999-4999-8999-999999999999';

const SOLICITACAO_FAKE = {
  id: SOLICITACAO_ID,
  solicitanteId: SOLICITANTE_ID,
  status: 'pendente',
  item: { id: 'item-1', doadorId: DOADOR_ID, titulo: 'Sofá 3 lugares' },
};

describe('handshake autenticado', () => {
  test('conecta normalmente com um access token válido', async () => {
    const socket = await conectar(tokenPara(USUARIO_ID));
    expect(socket.connected).toBe(true);
  });

  test('rejeita conexão sem token', async () => {
    await expect(conectar(undefined)).rejects.toThrow(/Token de acesso não fornecido/);
  });

  test('rejeita conexão com token inválido/malformado', async () => {
    await expect(conectar('isto-nao-e-um-jwt')).rejects.toThrow(/Token de acesso inválido ou expirado/);
  });

  test('rejeita conexão com token expirado', async () => {
    const tokenExpirado = jwt.sign({ sub: USUARIO_ID, tipo: 'usuario' }, process.env.JWT_SECRET, { expiresIn: '-1s' });
    await expect(conectar(tokenExpirado)).rejects.toThrow(/Token de acesso inválido ou expirado/);
  });
});

describe('solicitacao:entrar', () => {
  test('rejeita solicitacaoId ausente ou mal formado', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('solicitacao:entrar', { solicitacaoId: 'nao-e-um-uuid' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/inválido/);
  });

  test('rejeita quem não é o doador nem o solicitante da solicitação', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(ESTRANHO_ID));

    socket.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não participa/);
  });

  test('rejeita quando a solicitação não existe', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('solicitacao:entrar', { solicitacaoId: SOL_INEXISTENTE_ID });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não encontrada/);
  });

  test('aceita o doador e confirma a entrada na sala', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    const confirmacao = await aguardarEvento(socket, 'solicitacao:entrou');

    // usuariosOnline vem vazio aqui: ninguém mais entrou nesta sala ainda
    // (fase 11 — ver describe('presença online') mais abaixo pro caso com alguém já dentro).
    expect(confirmacao).toEqual({ solicitacaoId: SOLICITACAO_ID, usuariosOnline: [] });
  });

  test('aceita o solicitante e confirma a entrada na sala', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(SOLICITANTE_ID));

    socket.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    const confirmacao = await aguardarEvento(socket, 'solicitacao:entrou');

    expect(confirmacao).toEqual({ solicitacaoId: SOLICITACAO_ID, usuariosOnline: [] });
  });

  test('duas conexões (doador e solicitante) entram na MESMA sala no servidor', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));

    socketDoador.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });

    await Promise.all([
      aguardarEvento(socketDoador, 'solicitacao:entrou'),
      aguardarEvento(socketSolicitante, 'solicitacao:entrou'),
    ]);

    // Confere DIRETO no servidor (não só que os dois clientes acharam que deu
    // certo) — é essa sala que a fase 4 vai usar pra entregar 'mensagem:nova'
    // pras duas partes de uma vez, com um único io.to(sala).emit(...).
    const sala = io.sockets.adapter.rooms.get(`solicitacao:${SOLICITACAO_ID}`);
    expect(sala?.size).toBe(2);
  });
});

describe('mensagem:enviar', () => {
  test('rejeita solicitacaoId ausente ou mal formado', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:enviar', { solicitacaoId: 'nao-e-um-uuid', conteudo: 'oi' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/inválido/);
  });

  test('rejeita conteudo vazio (reaproveita o mesmo Joi da rota REST)', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: '' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/não pode ser vazia/);
  });

  test('rejeita conteudo acima de 2000 caracteres', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'a'.repeat(2001) });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/2000 caracteres/);
  });

  test('rejeita quem não é participante — mesma regra de autorização do REST, chamada pelo socket', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(ESTRANHO_ID));

    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'oi' });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não participa/);
  });

  test('rejeita envio quando a solicitação já foi recusada', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({ ...SOLICITACAO_FAKE, status: 'recusada' });
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'oi' });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não aceita mais mensagens/);
  });

  test('persiste a mensagem de verdade (chama o mesmo mensagem.service.js da fase 2)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.create.mockResolvedValue({
      id: 'msg-1',
      solicitacaoId: SOLICITACAO_ID,
      remetenteId: DOADOR_ID,
      conteudo: 'Oi, ainda está disponível?',
      anexoUrl: null,
      anexoTipo: null,
      lida: false,
      editadoEm: null,
      deletadoEm: null,
      criadoEm: new Date(),
      remetente: { id: DOADOR_ID, primeiroNome: 'Ana', ultimoNome: 'Silva' },
    });
    prisma.notificacao.create.mockResolvedValue({});

    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'Oi, ainda está disponível?' });
    await aguardarEvento(socket, 'mensagem:nova');

    expect(prisma.mensagem.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ solicitacaoId: SOLICITACAO_ID, remetenteId: DOADOR_ID, conteudo: 'Oi, ainda está disponível?' }),
    }));
  });

  test('quem manda recebe a própria mensagem de volta (broadcast inclui o remetente)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.create.mockResolvedValue({
      id: 'msg-2', solicitacaoId: SOLICITACAO_ID, remetenteId: DOADOR_ID, conteudo: 'oi', anexoUrl: null,
      anexoTipo: null, lida: false, editadoEm: null, deletadoEm: null, criadoEm: new Date(),
      remetente: { id: DOADOR_ID, primeiroNome: 'Ana', ultimoNome: 'Silva' },
    });
    prisma.notificacao.create.mockResolvedValue({});

    // Sem chamar 'solicitacao:entrar' antes — confere que o join defensivo
    // dentro do próprio handler de 'mensagem:enviar' garante o broadcast de
    // volta mesmo sem esse passo prévio.
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'oi' });
    const { mensagem } = await aguardarEvento(socket, 'mensagem:nova');

    expect(mensagem.id).toBe('msg-2');
    expect(mensagem.deletada).toBe(false);
  });

  test('a OUTRA parte recebe a mensagem em tempo real, sem precisar recarregar nada', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.create.mockResolvedValue({
      id: 'msg-3', solicitacaoId: SOLICITACAO_ID, remetenteId: DOADOR_ID, conteudo: 'chegou?', anexoUrl: null,
      anexoTipo: null, lida: false, editadoEm: null, deletadoEm: null, criadoEm: new Date(),
      remetente: { id: DOADOR_ID, primeiroNome: 'Ana', ultimoNome: 'Silva' },
    });
    prisma.notificacao.create.mockResolvedValue({});

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));

    // O solicitante entra na sala primeiro (senão não estaria "presente" pra
    // receber nada — mesmo espírito de abrir o chat antes de alguém escrever).
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const recebida = aguardarEvento(socketSolicitante, 'mensagem:nova');
    socketDoador.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'chegou?' });

    const { mensagem } = await recebida;
    expect(mensagem.conteudo).toBe('chegou?');
    expect(mensagem.remetente.primeiroNome).toBe('Ana');
  });
});

// Fase 6: edição (janela de 15 min) e soft-delete (sem prazo, apaga
// conteúdo/anexo de vez) de mensagem própria, com o mesmo broadcast em
// tempo real que 'mensagem:enviar' já usa.
const MENSAGEM_ID_EDITAR = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const MENSAGEM_ID_DELETAR = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function mensagemPropriaFake(id, overrides = {}) {
  return {
    id,
    solicitacaoId: SOLICITACAO_ID,
    remetenteId: DOADOR_ID,
    conteudo: 'texto original',
    anexoUrl: null,
    anexoTipo: null,
    lida: false,
    editadoEm: null,
    deletadoEm: null,
    criadoEm: new Date(),
    remetente: { id: DOADOR_ID, primeiroNome: 'Ana', ultimoNome: 'Silva' },
    ...overrides,
  };
}

describe('mensagem:editar', () => {
  test('rejeita solicitacaoId ou mensagemId mal formado', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:editar', { solicitacaoId: 'nao-e-uuid', mensagemId: MENSAGEM_ID_EDITAR, conteudo: 'novo texto' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/inválido/);
  });

  test('rejeita conteudo vazio (mesmo Joi da rota REST)', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:editar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_EDITAR, conteudo: '' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/não pode ser vazia/);
  });

  test('rejeita quem não é o remetente da mensagem', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_EDITAR));
    const socket = await conectar(tokenPara(ESTRANHO_ID));

    socket.emit('mensagem:editar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_EDITAR, conteudo: 'novo texto' });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/suas próprias mensagens/);
  });

  test('rejeita edição fora da janela de 15 minutos', async () => {
    const criadaHaMuitoTempo = new Date(Date.now() - 16 * 60 * 1000);
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_EDITAR, { criadoEm: criadaHaMuitoTempo }));
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('mensagem:editar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_EDITAR, conteudo: 'novo texto' });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/prazo de 15 minutos/);
  });

  test('rejeita edição de mensagem já apagada', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_EDITAR, { deletadoEm: new Date() }));
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('mensagem:editar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_EDITAR, conteudo: 'novo texto' });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/apagada não pode ser editada/);
  });

  test('rejeita edição quando a conversa já foi recusada', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_EDITAR));
    prisma.solicitacaoItem.findUnique.mockResolvedValue({ ...SOLICITACAO_FAKE, status: 'recusada' });
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('mensagem:editar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_EDITAR, conteudo: 'novo texto' });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não aceita mais edições/);
  });

  test('edita com sucesso dentro da janela e transmite mensagem:editada pra sala inteira', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_EDITAR));
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.update.mockResolvedValue(
      mensagemPropriaFake(MENSAGEM_ID_EDITAR, { conteudo: 'texto corrigido', editadoEm: new Date() })
    );

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const recebida = aguardarEvento(socketSolicitante, 'mensagem:editada');
    socketDoador.emit('mensagem:editar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_EDITAR, conteudo: 'texto corrigido' });

    const { mensagem } = await recebida;
    expect(mensagem.conteudo).toBe('texto corrigido');
    expect(mensagem.editada).toBe(true);
  });
});

describe('mensagem:deletar', () => {
  test('rejeita solicitacaoId ou mensagemId mal formado', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:deletar', { solicitacaoId: SOLICITACAO_ID, mensagemId: 'nao-e-uuid' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/inválido/);
  });

  test('rejeita quem não é o remetente da mensagem', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_DELETAR));
    const socket = await conectar(tokenPara(ESTRANHO_ID));

    socket.emit('mensagem:deletar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_DELETAR });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/suas próprias mensagens/);
  });

  test('rejeita apagar uma mensagem que já foi apagada', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_DELETAR, { deletadoEm: new Date() }));
    const socket = await conectar(tokenPara(DOADOR_ID));

    socket.emit('mensagem:deletar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_DELETAR });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/já foi apagada/);
  });

  test('apaga com sucesso mesmo fora da janela de edição (deletar não tem prazo) e transmite mensagem:deletada', async () => {
    const criadaHaMuitoTempo = new Date(Date.now() - 60 * 60 * 1000); // 1h atrás — passaria da janela de EDIÇÃO, mas deletar não expira
    prisma.mensagem.findUnique.mockResolvedValue(mensagemPropriaFake(MENSAGEM_ID_DELETAR, { criadoEm: criadaHaMuitoTempo, anexoUrl: null }));
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.update.mockResolvedValue(
      mensagemPropriaFake(MENSAGEM_ID_DELETAR, { criadoEm: criadaHaMuitoTempo, conteudo: null, anexoUrl: null, anexoTipo: null, deletadoEm: new Date() })
    );

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const recebida = aguardarEvento(socketSolicitante, 'mensagem:deletada');
    socketDoador.emit('mensagem:deletar', { solicitacaoId: SOLICITACAO_ID, mensagemId: MENSAGEM_ID_DELETAR });

    const { mensagem } = await recebida;
    expect(mensagem.conteudo).toBeNull();
    expect(mensagem.deletada).toBe(true);
  });
});

// Fase 7: indicador de "digitando...". Só socket, sem contrapartida REST —
// é sinal de UI efêmero, nada persiste no banco.
describe('mensagem:digitando', () => {
  test('rejeita solicitacaoId mal formado', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:digitando', { solicitacaoId: 'nao-e-uuid', digitando: true });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/inválido/);
  });

  test('rejeita "digitando" que não é booleano', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: 'sim' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/true ou false/);
  });

  test('rejeita quem não participa da solicitação', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(ESTRANHO_ID));

    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não participa/);
  });

  test('quem está digitando não recebe o próprio broadcast de volta', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(DOADOR_ID));

    let recebeuAlgo = false;
    socket.on('mensagem:usuario_digitando', () => {
      recebeuAlgo = true;
    });

    socket.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });
    // Não tem um evento de confirmação pra esperar (o emissor não recebe
    // nada de volta em caso de sucesso) — um pequeno delay é a única forma
    // de garantir que, se o broadcast fosse chegar até ele, já teria chegado.
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recebeuAlgo).toBe(false);
  });

  test('a outra parte da conversa recebe o indicador em tempo real', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));

    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const recebida = aguardarEvento(socketSolicitante, 'mensagem:usuario_digitando');
    socketDoador.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });

    const evento = await recebida;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, digitando: true });
  });

  test('conexão cair no meio do "digitando" avisa a sala que parou (evita indicador preso pra sempre)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));

    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    socketDoador.emit('mensagem:digitando', { solicitacaoId: SOLICITACAO_ID, digitando: true });
    await aguardarEvento(socketSolicitante, 'mensagem:usuario_digitando');

    const avisoDeParada = aguardarEvento(socketSolicitante, 'mensagem:usuario_digitando');
    socketDoador.disconnect();

    const evento = await avisoDeParada;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, digitando: false });
  });

  test('enviar uma mensagem limpa o indicador de digitação automaticamente', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.create.mockResolvedValue({
      id: 'msg-digitando-1', solicitacaoId: SOLICITACAO_ID, remetenteId: DOADOR_ID, conteudo: 'oi', anexoUrl: null,
      anexoTipo: null, lida: false, editadoEm: null, deletadoEm: null, criadoEm: new Date(),
      remetente: { id: DOADOR_ID, primeiroNome: 'Ana', ultimoNome: 'Silva' },
    });
    prisma.notificacao.create.mockResolvedValue({});

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const paraDeDigitar = aguardarEvento(socketSolicitante, 'mensagem:usuario_digitando');
    socketDoador.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'oi' });

    const evento = await paraDeDigitar;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, digitando: false });
  });
});

// Fase 8: confirmação de leitura em tempo real. O GET REST já marca como
// lida no banco (ver mensagemListar.test.js) — este evento só existe pra
// avisar a OUTRA parte na hora, sem precisar dar refresh.
describe('mensagem:marcar_lida', () => {
  test('rejeita solicitacaoId mal formado', async () => {
    const socket = await conectar(tokenPara(DOADOR_ID));
    socket.emit('mensagem:marcar_lida', { solicitacaoId: 'nao-e-uuid' });
    const erro = await aguardarEvento(socket, 'erro');
    expect(erro.mensagem).toMatch(/inválido/);
  });

  test('rejeita quem não participa da solicitação', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const socket = await conectar(tokenPara(ESTRANHO_ID));

    socket.emit('mensagem:marcar_lida', { solicitacaoId: SOLICITACAO_ID });
    const erro = await aguardarEvento(socket, 'erro');

    expect(erro.mensagem).toMatch(/não participa/);
  });

  test('quando não havia nada pra marcar (marcadas=0), não faz broadcast nenhum', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.updateMany.mockResolvedValue({ count: 0 });

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    let recebeuAlgo = false;
    socketSolicitante.on('mensagem:lida', () => {
      recebeuAlgo = true;
    });

    socketDoador.emit('mensagem:marcar_lida', { solicitacaoId: SOLICITACAO_ID });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recebeuAlgo).toBe(false);
  });

  test('quem marcou como lida não recebe o próprio broadcast de volta', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.updateMany.mockResolvedValue({ count: 1 });

    const socket = await conectar(tokenPara(DOADOR_ID));

    let recebeuAlgo = false;
    socket.on('mensagem:lida', () => {
      recebeuAlgo = true;
    });

    socket.emit('mensagem:marcar_lida', { solicitacaoId: SOLICITACAO_ID });
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(recebeuAlgo).toBe(false);
  });

  test('a outra parte recebe mensagem:lida em tempo real quando há mensagens marcadas', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.updateMany.mockResolvedValue({ count: 2 });

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const recebida = aguardarEvento(socketSolicitante, 'mensagem:lida');
    socketDoador.emit('mensagem:marcar_lida', { solicitacaoId: SOLICITACAO_ID });

    const evento = await recebida;
    expect(evento).toEqual({ lidoPor: DOADOR_ID });
  });
});

// Fase 11: presença online, por conversa. Ver comentário em
// src/socket/index.js pro porquê de ser por sala (não global) e guardado
// em memória do processo (não no Redis, diferente do rate limit da fase 10).
describe('presença online (solicitacao:presenca)', () => {
  test('quem já está na sala é avisado quando o outro participante entra', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    socketDoador.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketDoador, 'solicitacao:entrou');

    const avisoDePresenca = aguardarEvento(socketDoador, 'solicitacao:presenca');
    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });

    const evento = await avisoDePresenca;
    expect(evento).toEqual({ usuarioId: SOLICITANTE_ID, online: true });
  });

  test('quem entra recebe, na própria confirmação, a lista de quem já estava online', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    socketDoador.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketDoador, 'solicitacao:entrou');

    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    const confirmacao = await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    expect(confirmacao).toEqual({ solicitacaoId: SOLICITACAO_ID, usuariosOnline: [DOADOR_ID] });
  });

  test('segunda conexão do MESMO usuário na mesma sala não dispara um segundo aviso de presença', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const avisoOnline = aguardarEvento(socketSolicitante, 'solicitacao:presenca');
    const socketDoadorAba1 = await conectar(tokenPara(DOADOR_ID));
    socketDoadorAba1.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await avisoOnline; // consome o único aviso esperado — a partir daqui, mais um seria bug

    let avisosRecebidos = 0;
    socketSolicitante.on('solicitacao:presenca', () => {
      avisosRecebidos += 1;
    });

    // segunda aba do MESMO doador, na MESMA sala
    const socketDoadorAba2 = await conectar(tokenPara(DOADOR_ID));
    socketDoadorAba2.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketDoadorAba2, 'solicitacao:entrou');
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(avisosRecebidos).toBe(0);
  });

  test('ao desconectar a única conexão, a outra parte é avisada que ficou offline', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const avisoOnline = aguardarEvento(socketSolicitante, 'solicitacao:presenca');
    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    socketDoador.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await avisoOnline;

    const avisoOffline = aguardarEvento(socketSolicitante, 'solicitacao:presenca');
    socketDoador.disconnect();

    const evento = await avisoOffline;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, online: false });
  });

  test('desconectar UMA de duas abas do mesmo usuário não derruba a presença — só a última derruba', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const avisoOnline = aguardarEvento(socketSolicitante, 'solicitacao:presenca');
    const socketDoadorAba1 = await conectar(tokenPara(DOADOR_ID));
    socketDoadorAba1.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await avisoOnline;

    const socketDoadorAba2 = await conectar(tokenPara(DOADOR_ID));
    socketDoadorAba2.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketDoadorAba2, 'solicitacao:entrou');

    let recebeuOffline = false;
    socketSolicitante.on('solicitacao:presenca', (evento) => {
      if (evento.online === false) recebeuOffline = true;
    });

    socketDoadorAba1.disconnect(); // fecha só UMA das duas abas
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(recebeuOffline).toBe(false);

    const avisoOffline = aguardarEvento(socketSolicitante, 'solicitacao:presenca');
    socketDoadorAba2.disconnect(); // fecha a ÚLTIMA — agora sim cai
    const evento = await avisoOffline;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, online: false });
  });

  test('mandar mensagem sem nunca ter chamado solicitacao:entrar também conta como presença', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.create.mockResolvedValue({
      id: 'msg-presenca-1', solicitacaoId: SOLICITACAO_ID, remetenteId: DOADOR_ID, conteudo: 'oi', anexoUrl: null,
      anexoTipo: null, lida: false, editadoEm: null, deletadoEm: null, criadoEm: new Date(),
      remetente: { id: DOADOR_ID, primeiroNome: 'Ana', ultimoNome: 'Silva' },
    });
    prisma.notificacao.create.mockResolvedValue({});

    const socketSolicitante = await conectar(tokenPara(SOLICITANTE_ID));
    socketSolicitante.emit('solicitacao:entrar', { solicitacaoId: SOLICITACAO_ID });
    await aguardarEvento(socketSolicitante, 'solicitacao:entrou');

    const avisoDePresenca = aguardarEvento(socketSolicitante, 'solicitacao:presenca');
    const socketDoador = await conectar(tokenPara(DOADOR_ID));
    // Doador nunca deu 'solicitacao:entrar' — só mandou direto. O join
    // defensivo dentro de 'mensagem:enviar' (entrarNaSalaComPresenca) é o
    // mesmo pro dois casos, sem código duplicado.
    socketDoador.emit('mensagem:enviar', { solicitacaoId: SOLICITACAO_ID, conteudo: 'oi' });

    const evento = await avisoDePresenca;
    expect(evento).toEqual({ usuarioId: DOADOR_ID, online: true });
  });
});

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

const SOLICITACAO_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOADOR_ID = 'doador-1';
const SOLICITANTE_ID = 'solicitante-1';
const ESTRANHO_ID = 'estranho-1';

const SOLICITACAO_FAKE = {
  id: SOLICITACAO_ID,
  status: 'aceita',
  solicitanteId: SOLICITANTE_ID,
  solicitante: { id: SOLICITANTE_ID, primeiroNome: 'João', ultimoNome: 'Souza' },
  item: { id: 'item-1', doadorId: DOADOR_ID, titulo: 'Sofá 3 lugares' },
};

function gerarToken(sub, tipo = 'usuario') {
  return jwt.sign({ sub, tipo }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

describe('GET /solicitacoes/:id/mensagens (fase 8: marca como lida ao abrir)', () => {
  test('sem token: 401', async () => {
    const res = await request(app).get(`/solicitacoes/${SOLICITACAO_ID}/mensagens`);
    expect(res.status).toBe(401);
  });

  test('solicitação não encontrada: 404', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);
    expect(res.status).toBe(404);
  });

  test('quem não participa da solicitação: 403, e não marca nada como lida', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken(ESTRANHO_ID)}`);
    expect(res.status).toBe(403);
    expect(prisma.mensagem.updateMany).not.toHaveBeenCalled();
  });

  test('participante: 200 e marca como lida todas as mensagens da OUTRA parte (não as próprias)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.updateMany.mockResolvedValue({ count: 2 });
    prisma.mensagem.findMany.mockResolvedValue([
      {
        id: 'msg-1', solicitacaoId: SOLICITACAO_ID, remetenteId: SOLICITANTE_ID, conteudo: 'oi', anexoUrl: null,
        anexoTipo: null, lida: true, editadoEm: null, deletadoEm: null, criadoEm: new Date(),
        remetente: { id: SOLICITANTE_ID, primeiroNome: 'João', ultimoNome: 'Souza' },
      },
    ]);

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(200);
    expect(prisma.mensagem.updateMany).toHaveBeenCalledWith({
      where: { solicitacaoId: SOLICITACAO_ID, remetenteId: { not: DOADOR_ID }, lida: false },
      data: { lida: true },
    });
    expect(res.body.mensagens[0].lida).toBe(true);
  });

  test('visita de admin NÃO marca mensagens como lidas (não é destinatário de verdade)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken('admin-1', 'admin')}`);

    expect(res.status).toBe(200);
    expect(prisma.mensagem.updateMany).not.toHaveBeenCalled();
  });
});

// Fase 9: paginação por cursor. Chat é o único recurso do projeto cuja lista
// cresce em tempo real enquanto é consultada, então usa "antesDe=<id>" em vez
// de pagina/tamanho — evita o bug clássico de página deslizante quando chega
// mensagem nova no meio da leitura.
function mensagemFake(id, criadoEm, remetenteId = SOLICITANTE_ID) {
  return {
    id,
    solicitacaoId: SOLICITACAO_ID,
    remetenteId,
    conteudo: `conteudo-${id}`,
    anexoUrl: null,
    anexoTipo: null,
    lida: false,
    editadoEm: null,
    deletadoEm: null,
    criadoEm,
    remetente: { id: remetenteId, primeiroNome: 'João', ultimoNome: 'Souza' },
  };
}

describe('GET /solicitacoes/:id/mensagens — paginação por cursor (fase 9)', () => {
  beforeEach(() => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    // Todos os testes deste bloco usam DOADOR_ID (participante de verdade),
    // então marcarMensagensComoLidas sempre roda — precisa de um retorno
    // válido de updateMany, senão a chamada quebra antes de chegar na
    // parte que a gente quer testar (a paginação em si).
    prisma.mensagem.updateMany.mockResolvedValue({ count: 0 });
  });

  test('sem "antesDe": usa limite padrão (30), pede um a mais (31) e não passa cursor pro Prisma', async () => {
    prisma.mensagem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(200);
    expect(prisma.mensagem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { criadoEm: 'desc' }, take: 31 })
    );
    const chamada = prisma.mensagem.findMany.mock.calls[0][0];
    expect(chamada.cursor).toBeUndefined();
    expect(chamada.skip).toBeUndefined();
    expect(res.body.paginacao).toEqual({ limite: 30, temMais: false, proximoCursor: null });
  });

  test('respeita "?limite=" customizado e aplica o teto de 100', async () => {
    prisma.mensagem.findMany.mockResolvedValue([]);

    await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?limite=5`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);
    expect(prisma.mensagem.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 6 }));

    prisma.mensagem.findMany.mockClear();
    await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?limite=999999`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);
    expect(prisma.mensagem.findMany).toHaveBeenCalledWith(expect.objectContaining({ take: 101 })); // teto 100 + 1
  });

  test('mais mensagens do que o limite: temMais=true, corta a página e aponta proximoCursor pra mais antiga dela', async () => {
    // limite=2 → pede 3 (take: limite+1). Devolvemos 3 em DESC (mais nova primeiro), como o Prisma faria.
    prisma.mensagem.findMany.mockResolvedValue([
      mensagemFake('msg-3', new Date('2026-01-03')),
      mensagemFake('msg-2', new Date('2026-01-02')),
      mensagemFake('msg-1', new Date('2026-01-01')),
    ]);

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?limite=2`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(200);
    // Corta pra 2 e devolve em ordem ASC (mais antiga primeiro), pronta pra tela.
    expect(res.body.mensagens.map((m) => m.id)).toEqual(['msg-2', 'msg-3']);
    expect(res.body.paginacao).toEqual({ limite: 2, temMais: true, proximoCursor: 'msg-2' });
  });

  test('mensagens dentro do limite: temMais=false e proximoCursor=null', async () => {
    prisma.mensagem.findMany.mockResolvedValue([
      mensagemFake('msg-2', new Date('2026-01-02')),
      mensagemFake('msg-1', new Date('2026-01-01')),
    ]);

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?limite=5`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.body.mensagens.map((m) => m.id)).toEqual(['msg-1', 'msg-2']);
    expect(res.body.paginacao).toEqual({ limite: 5, temMais: false, proximoCursor: null });
  });

  test('"antesDe" mal formado (não é UUID): 400', async () => {
    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?antesDe=nao-e-uuid`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);
    expect(res.status).toBe(400);
  });

  test('"antesDe" de uma mensagem que não existe: 400', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(null);
    const antesDe = '660e8400-e29b-41d4-a716-446655440099';

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?antesDe=${antesDe}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/antesDe/);
  });

  test('"antesDe" de uma mensagem de OUTRA conversa: 400 (cursor não vaza entre conversas)', async () => {
    const antesDe = '660e8400-e29b-41d4-a716-446655440099';
    prisma.mensagem.findUnique.mockResolvedValue({ ...mensagemFake(antesDe, new Date()), solicitacaoId: 'outra-solicitacao-qualquer' });

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?antesDe=${antesDe}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(400);
  });

  test('"antesDe" válido: repassa cursor+skip pro Prisma', async () => {
    const antesDe = '660e8400-e29b-41d4-a716-446655440099';
    prisma.mensagem.findUnique.mockResolvedValue({ ...mensagemFake(antesDe, new Date()), solicitacaoId: SOLICITACAO_ID });
    prisma.mensagem.findMany.mockResolvedValue([]);

    const res = await request(app)
      .get(`/solicitacoes/${SOLICITACAO_ID}/mensagens?antesDe=${antesDe}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(200);
    expect(prisma.mensagem.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: { id: antesDe }, skip: 1 })
    );
  });
});

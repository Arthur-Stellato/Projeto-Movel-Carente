const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const { DIRETORIO_UPLOADS_MENSAGENS } = require('../../src/lib/uploads');

const SOLICITACAO_ID = '550e8400-e29b-41d4-a716-446655440000';
const MENSAGEM_ID = '660e8400-e29b-41d4-a716-446655440000';
const DOADOR_ID = 'doador-1';
const SOLICITANTE_ID = 'solicitante-1';
const ESTRANHO_ID = 'estranho-1';

const SOLICITACAO_FAKE = {
  id: SOLICITACAO_ID,
  status: 'aceita',
  solicitanteId: SOLICITANTE_ID,
  item: { id: 'item-1', doadorId: DOADOR_ID, titulo: 'Sofá 3 lugares' },
};

function gerarToken(sub) {
  return jwt.sign({ sub, tipo: 'usuario' }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function mensagemFake(overrides = {}) {
  return {
    id: MENSAGEM_ID,
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

describe('PATCH /solicitacoes/:id/mensagens/:mensagemId', () => {
  test('sem token: 401', async () => {
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .send({ conteudo: 'novo texto' });
    expect(res.status).toBe(401);
  });

  test('rejeita conteudo ausente: 400', async () => {
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigatório/);
  });

  test('rejeita conteudo vazio: 400', async () => {
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({ conteudo: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/não pode ser vazia/);
  });

  test('mensagem não encontrada: 404', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({ conteudo: 'novo texto' });
    expect(res.status).toBe(404);
  });

  test('quem não é o remetente: 403', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake());
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(ESTRANHO_ID)}`)
      .send({ conteudo: 'novo texto' });
    expect(res.status).toBe(403);
    expect(res.body.erro).toMatch(/suas próprias mensagens/);
  });

  test('fora da janela de 15 minutos: 409', async () => {
    const criadaHaMuitoTempo = new Date(Date.now() - 16 * 60 * 1000);
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake({ criadoEm: criadaHaMuitoTempo }));
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({ conteudo: 'novo texto' });
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/prazo de 15 minutos/);
  });

  test('mensagem já apagada: 409', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake({ deletadoEm: new Date() }));
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({ conteudo: 'novo texto' });
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/apagada não pode ser editada/);
  });

  test('conversa já recusada: 409', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake());
    prisma.solicitacaoItem.findUnique.mockResolvedValue({ ...SOLICITACAO_FAKE, status: 'recusada' });
    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({ conteudo: 'novo texto' });
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/não aceita mais edições/);
  });

  test('dentro da janela, remetente correto, conversa aberta: 200', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake());
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);
    prisma.mensagem.update.mockResolvedValue(mensagemFake({ conteudo: 'texto corrigido', editadoEm: new Date() }));

    const res = await request(app)
      .patch(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`)
      .send({ conteudo: 'texto corrigido' });

    expect(res.status).toBe(200);
    expect(res.body.mensagem.conteudo).toBe('texto corrigido');
    expect(res.body.mensagem.editada).toBe(true);
    expect(res.body.mensagem.deletada).toBe(false);
    expect(prisma.mensagem.update).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: MENSAGEM_ID },
      data: expect.objectContaining({ conteudo: 'texto corrigido' }),
    }));
  });
});

describe('DELETE /solicitacoes/:id/mensagens/:mensagemId', () => {
  test('sem token: 401', async () => {
    const res = await request(app).delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`);
    expect(res.status).toBe(401);
  });

  test('mensagem não encontrada: 404', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(null);
    const res = await request(app)
      .delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);
    expect(res.status).toBe(404);
  });

  test('quem não é o remetente: 403', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake());
    const res = await request(app)
      .delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(ESTRANHO_ID)}`);
    expect(res.status).toBe(403);
  });

  test('mensagem já apagada: 409', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake({ deletadoEm: new Date() }));
    const res = await request(app)
      .delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);
    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/já foi apagada/);
  });

  test('sem prazo — apaga mesmo bem depois da janela de edição: 200', async () => {
    const criadaHaMuitoTempo = new Date(Date.now() - 60 * 60 * 1000);
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake({ criadoEm: criadaHaMuitoTempo }));
    prisma.mensagem.update.mockResolvedValue(
      mensagemFake({ criadoEm: criadaHaMuitoTempo, conteudo: null, anexoUrl: null, anexoTipo: null, deletadoEm: new Date() })
    );

    const res = await request(app)
      .delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(200);
    expect(res.body.mensagem.conteudo).toBeNull();
    expect(res.body.mensagem.deletada).toBe(true);
  });

  test('conversa encerrada NÃO impede apagar (diferente de editar)', async () => {
    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake());
    prisma.mensagem.update.mockResolvedValue(mensagemFake({ conteudo: null, anexoUrl: null, anexoTipo: null, deletadoEm: new Date() }));

    const res = await request(app)
      .delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    // Repare que nem chegamos a mockar solicitacaoItem.findUnique pra um status
    // "recusada"/"cancelada" — se deletarMensagem checasse isso, o mock de
    // solicitacaoItem.findUnique (não configurado neste teste) devolveria
    // undefined e a chamada quebraria antes de responder 200.
    expect(res.status).toBe(200);
    expect(prisma.solicitacaoItem.findUnique).not.toHaveBeenCalled();
  });

  test('remove o arquivo físico do anexo do disco ao apagar', async () => {
    const nomeArquivo = 'anexo-existente-de-teste.jpg';
    fs.writeFileSync(path.join(DIRETORIO_UPLOADS_MENSAGENS, nomeArquivo), 'conteudo-fake');

    prisma.mensagem.findUnique.mockResolvedValue(mensagemFake({ anexoUrl: `/uploads/mensagens/${nomeArquivo}`, anexoTipo: 'imagem', conteudo: null }));
    prisma.mensagem.update.mockResolvedValue(mensagemFake({ conteudo: null, anexoUrl: null, anexoTipo: null, deletadoEm: new Date() }));

    const res = await request(app)
      .delete(`/solicitacoes/${SOLICITACAO_ID}/mensagens/${MENSAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken(DOADOR_ID)}`);

    expect(res.status).toBe(200);
    expect(fs.existsSync(path.join(DIRETORIO_UPLOADS_MENSAGENS, nomeArquivo))).toBe(false);
  });
});

// NOTA: validação de nota/comentário (obrigatório, 1-5, tamanho do comentário)
// já é checada pelo Joi na rota (POST /solicitacoes/:id/avaliacoes) — coberta
// em tests/integration/validacao.test.js. Aqui só sobram as regras de negócio:
// participação, status da doação, duplicidade, e a janela de revelação.
const prisma = require('../../src/lib/prisma');
const avaliacaoService = require('../../src/services/avaliacao.service');

const DIA_MS = 24 * 60 * 60 * 1000;

function solicitacaoConcluida(overrides = {}) {
  return {
    id: 'sol-1',
    solicitanteId: 'solicitante-1',
    status: 'aceita',
    item: { id: 'item-1', doadorId: 'doador-1', status: 'doado' },
    ...overrides,
  };
}

describe('criar', () => {
  test('lança 404 quando a solicitação não existe', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);

    await expect(avaliacaoService.criar('doador-1', 'sol-inexistente', { nota: 5 }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejeita avaliador que não participou da solicitação', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());

    await expect(avaliacaoService.criar('estranho-1', 'sol-1', { nota: 5 }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('rejeita quando a solicitação ainda não foi aceita', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida({ status: 'pendente' }));

    await expect(avaliacaoService.criar('doador-1', 'sol-1', { nota: 5 }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('rejeita quando o item ainda não foi marcado como doado (ex: reservado)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(
      solicitacaoConcluida({ item: { id: 'item-1', doadorId: 'doador-1', status: 'reservado' } })
    );

    await expect(avaliacaoService.criar('doador-1', 'sol-1', { nota: 5 }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('rejeita avaliação duplicada da mesma pessoa pra mesma solicitação', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findUnique.mockResolvedValue({ id: 'avaliacao-existente' });

    await expect(avaliacaoService.criar('doador-1', 'sol-1', { nota: 5 }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('doador avalia solicitante: avaliadoId é o solicitante', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findUnique.mockResolvedValue(null);
    prisma.avaliacao.create.mockResolvedValue({ id: 'aval-1' });

    await avaliacaoService.criar('doador-1', 'sol-1', { nota: 5, comentario: 'Ótimo!' });

    expect(prisma.avaliacao.create).toHaveBeenCalledWith({
      data: { solicitacaoId: 'sol-1', avaliadorId: 'doador-1', avaliadoId: 'solicitante-1', nota: 5, comentario: 'Ótimo!' },
    });
  });

  test('solicitante avalia doador: avaliadoId é o doador', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findUnique.mockResolvedValue(null);
    prisma.avaliacao.create.mockResolvedValue({ id: 'aval-2' });

    await avaliacaoService.criar('solicitante-1', 'sol-1', { nota: 4 });

    expect(prisma.avaliacao.create).toHaveBeenCalledWith({
      data: { solicitacaoId: 'sol-1', avaliadorId: 'solicitante-1', avaliadoId: 'doador-1', nota: 4, comentario: null },
    });
  });
});

describe('listarPorSolicitacao', () => {
  test('lança 404 quando a solicitação não existe', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);

    await expect(avaliacaoService.listarPorSolicitacao('sol-inexistente', 'doador-1', false))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejeita quem não participou e não é admin', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());

    await expect(avaliacaoService.listarPorSolicitacao('sol-1', 'estranho-1', false))
      .rejects.toMatchObject({ status: 403 });
  });

  test('não revela a avaliação do outro lado quando só uma existe e ainda está dentro da janela', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findMany.mockResolvedValue([
      { id: 'a1', solicitacaoId: 'sol-1', avaliadorId: 'doador-1', avaliadoId: 'solicitante-1', nota: 5, criadoEm: new Date() },
    ]);

    const resultado = await avaliacaoService.listarPorSolicitacao('sol-1', 'solicitante-1', false);

    expect(resultado.revelado).toBe(false);
    expect(resultado.avaliacaoRecebida).toBeNull();
    // a própria pessoa não avaliou ainda — minhaAvaliacao é null, mas a do doador (recebida) fica escondida
  });

  test('quem já avaliou sempre vê a própria avaliação, mesmo sem revelação', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findMany.mockResolvedValue([
      { id: 'a1', solicitacaoId: 'sol-1', avaliadorId: 'doador-1', avaliadoId: 'solicitante-1', nota: 5, criadoEm: new Date() },
    ]);

    const resultado = await avaliacaoService.listarPorSolicitacao('sol-1', 'doador-1', false);

    expect(resultado.minhaAvaliacao).toMatchObject({ id: 'a1' });
    expect(resultado.avaliacaoRecebida).toBeNull();
    expect(resultado.revelado).toBe(false);
  });

  test('revela as duas quando ambos os lados já avaliaram', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findMany.mockResolvedValue([
      { id: 'a1', solicitacaoId: 'sol-1', avaliadorId: 'doador-1', avaliadoId: 'solicitante-1', nota: 5, criadoEm: new Date() },
      { id: 'a2', solicitacaoId: 'sol-1', avaliadorId: 'solicitante-1', avaliadoId: 'doador-1', nota: 4, criadoEm: new Date() },
    ]);

    const resultado = await avaliacaoService.listarPorSolicitacao('sol-1', 'doador-1', false);

    expect(resultado.revelado).toBe(true);
    expect(resultado.minhaAvaliacao).toMatchObject({ id: 'a1' });
    expect(resultado.avaliacaoRecebida).toMatchObject({ id: 'a2' });
  });

  test('revela mesmo com só uma avaliação, depois que a janela de 3 dias expira', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findMany.mockResolvedValue([
      {
        id: 'a1', solicitacaoId: 'sol-1', avaliadorId: 'doador-1', avaliadoId: 'solicitante-1', nota: 5,
        criadoEm: new Date(Date.now() - (avaliacaoService.JANELA_REVELACAO_DIAS * DIA_MS + 1000)),
      },
    ]);

    const resultado = await avaliacaoService.listarPorSolicitacao('sol-1', 'solicitante-1', false);

    expect(resultado.revelado).toBe(true);
    expect(resultado.avaliacaoRecebida).toMatchObject({ id: 'a1' });
  });

  test('admin vê as duas avaliações mesmo sem revelação (moderação não é refém do double-blind)', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(solicitacaoConcluida());
    prisma.avaliacao.findMany.mockResolvedValue([
      { id: 'a1', solicitacaoId: 'sol-1', avaliadorId: 'doador-1', avaliadoId: 'solicitante-1', nota: 5, criadoEm: new Date() },
    ]);

    const resultado = await avaliacaoService.listarPorSolicitacao('sol-1', 'admin-1', true);

    expect(resultado.revelado).toBe(false); // o PAR ainda não revelou entre si...
    expect(resultado.avaliacoes).toHaveLength(1); // ...mas o admin recebe a lista crua de qualquer forma
  });
});

describe('listarRecebidas', () => {
  test('retorna vazio quando o usuário não recebeu nenhuma avaliação', async () => {
    prisma.avaliacao.findMany.mockResolvedValueOnce([]);

    const resultado = await avaliacaoService.listarRecebidas('usuario-1', {});

    expect(resultado).toMatchObject({ avaliacoes: [], total: 0, media: null });
  });

  test('filtra fora avaliações ainda não reveladas e calcula a média só das visíveis', async () => {
    const recebidas = [
      { id: 'a1', solicitacaoId: 'sol-1', avaliadorId: 'x', avaliadoId: 'usuario-1', nota: 5, criadoEm: new Date() },
      {
        id: 'a2', solicitacaoId: 'sol-2', avaliadorId: 'y', avaliadoId: 'usuario-1', nota: 1,
        criadoEm: new Date(Date.now() - (avaliacaoService.JANELA_REVELACAO_DIAS * DIA_MS + 1000)),
      },
    ];
    // a1 (sol-1) está sozinha e dentro da janela -> NÃO revelada
    // a2 (sol-2) está sozinha mas já passou a janela -> revelada
    prisma.avaliacao.findMany
      .mockResolvedValueOnce(recebidas) // primeira chamada: avaliações recebidas
      .mockResolvedValueOnce(recebidas); // segunda chamada: todas do(s) mesmo(s) par(es) — aqui coincide, cada uma é sozinha no seu par

    const resultado = await avaliacaoService.listarRecebidas('usuario-1', {});

    expect(resultado.total).toBe(1);
    expect(resultado.avaliacoes).toEqual([recebidas[1]]);
    expect(resultado.media).toBe(1);
  });

  test('pagina os resultados visíveis', async () => {
    const agora = new Date();
    const recebidas = Array.from({ length: 5 }, (_, i) => ({
      id: `a${i}`, solicitacaoId: `sol-${i}`, avaliadorId: `x${i}`, avaliadoId: 'usuario-1', nota: 3, criadoEm: agora,
    }));
    // todas em pares completos (2 avaliações cada) pra forçar revelado=true em todas
    const doMesmoPar = recebidas.flatMap((a) => [
      a,
      { ...a, id: `${a.id}-par`, avaliadorId: 'usuario-1', avaliadoId: a.avaliadorId },
    ]);

    prisma.avaliacao.findMany
      .mockResolvedValueOnce(recebidas)
      .mockResolvedValueOnce(doMesmoPar);

    const resultado = await avaliacaoService.listarRecebidas('usuario-1', { pagina: 2, tamanho: 2 });

    expect(resultado.total).toBe(5);
    expect(resultado.avaliacoes).toHaveLength(2);
    expect(resultado.pagina).toBe(2);
    expect(resultado.tamanho).toBe(2);
  });
});

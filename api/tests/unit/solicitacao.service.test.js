const prisma = require('../../src/lib/prisma');
const solicitacaoService = require('../../src/services/solicitacao.service');

describe('criar', () => {
  test('lança 404 quando o item não existe', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    await expect(solicitacaoService.criar('solicitante-1', 'item-inexistente', 'Oi'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('impede autosolicitação (doador não pode solicitar o próprio item)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });

    await expect(solicitacaoService.criar('doador-1', 'item-1', 'Oi'))
      .rejects.toMatchObject({ status: 403 });
  });

  test('rejeita solicitação para item que não está disponível', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'reservado' });

    await expect(solicitacaoService.criar('solicitante-1', 'item-1', 'Oi'))
      .rejects.toMatchObject({ status: 409 });
  });

  test('rejeita solicitação duplicada do mesmo usuário para o mesmo item', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.solicitacaoItem.findUnique.mockResolvedValue({ id: 'sol-existente' });

    await expect(solicitacaoService.criar('solicitante-1', 'item-1', 'Oi'))
      .rejects.toMatchObject({ status: 409 });
  });

  test('cria a solicitação e notifica o doador', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel', titulo: 'Sofá' });
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);
    prisma.solicitacaoItem.create.mockResolvedValue({ id: 'sol-1' });
    prisma.notificacao.create.mockResolvedValue({});

    const resultado = await solicitacaoService.criar('solicitante-1', 'item-1', 'Tenho interesse');

    expect(resultado.id).toBe('sol-1');
    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: 'doador-1', tipo: 'nova_solicitacao' }),
    });
  });
});

describe('listarPorItem', () => {
  test('lança 404 quando o item não existe', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    await expect(solicitacaoService.listarPorItem('item-inexistente', 'u1', false)).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita quem não é dono do item nem admin', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1' });
    await expect(solicitacaoService.listarPorItem('item-1', 'outro-usuario', false)).rejects.toMatchObject({ status: 403 });
  });

  test('admin pode ver mesmo sem ser o dono', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1' });
    prisma.$transaction.mockResolvedValue([[], 0]);

    await expect(solicitacaoService.listarPorItem('item-1', 'admin-1', true)).resolves.toBeDefined();
  });
});

describe('aceitar', () => {
  test('lança 404 quando a solicitação não existe', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);
    await expect(solicitacaoService.aceitar('sol-inexistente', 'doador-1', false)).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita quem não é dono do item nem admin', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'pendente', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', status: 'disponivel', titulo: 'Sofá' },
    });

    await expect(solicitacaoService.aceitar('sol-1', 'outro-usuario', false)).rejects.toMatchObject({ status: 403 });
  });

  test('rejeita solicitação que já foi respondida', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'aceita', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', status: 'reservado', titulo: 'Sofá' },
    });

    await expect(solicitacaoService.aceitar('sol-1', 'doador-1', false)).rejects.toMatchObject({ status: 409 });
  });

  test('aceitar: reserva o item, recusa as demais pendentes em cascata e notifica todo mundo', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'pendente', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', status: 'disponivel', titulo: 'Sofá' },
    });
    prisma.solicitacaoItem.findMany.mockResolvedValue([
      { id: 'sol-2', solicitanteId: 's2' },
      { id: 'sol-3', solicitanteId: 's3' },
    ]);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.solicitacaoItem.update.mockResolvedValue({});
    prisma.itemDoacao.update.mockResolvedValue({});
    prisma.solicitacaoItem.updateMany.mockResolvedValue({});
    prisma.notificacao.create.mockResolvedValue({});

    await solicitacaoService.aceitar('sol-1', 'doador-1', false);

    // Uma notificação para quem foi aceito + uma para cada uma das 2 outras solicitações recusadas
    expect(prisma.notificacao.create).toHaveBeenCalledTimes(3);
    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: 's1', tipo: 'solicitacao_aceita' }),
    });
    expect(prisma.notificacao.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ usuarioId: 's2', tipo: 'solicitacao_recusada' }),
    });
  });
});

describe('recusar', () => {
  test('rejeita quem não é dono nem admin', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'pendente', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', titulo: 'Sofá' },
    });

    await expect(solicitacaoService.recusar('sol-1', 'outro-usuario', false)).rejects.toMatchObject({ status: 403 });
  });

  test('recusa uma solicitação pendente e notifica o solicitante', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'pendente', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', titulo: 'Sofá' },
    });
    prisma.solicitacaoItem.update.mockResolvedValue({});
    prisma.notificacao.create.mockResolvedValue({});

    await solicitacaoService.recusar('sol-1', 'doador-1', false);

    expect(prisma.solicitacaoItem.update).toHaveBeenCalledWith({
      where: { id: 'sol-1' },
      data: { status: 'recusada', respondidoEm: expect.any(Date) },
    });
  });
});

describe('cancelar', () => {
  test('lança 404 quando a solicitação não existe', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(null);
    await expect(solicitacaoService.cancelar('sol-inexistente', 's1')).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita cancelamento por quem não é o solicitante original', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({ id: 'sol-1', solicitanteId: 's1', status: 'pendente' });
    await expect(solicitacaoService.cancelar('sol-1', 'outro-usuario')).rejects.toMatchObject({ status: 403 });
  });

  test('só permite cancelar solicitações pendentes', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({ id: 'sol-1', solicitanteId: 's1', status: 'aceita' });
    await expect(solicitacaoService.cancelar('sol-1', 's1')).rejects.toMatchObject({ status: 409 });
  });
});

describe('concluir', () => {
  test('só permite concluir solicitação já aceita', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'pendente', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', status: 'disponivel', titulo: 'Sofá' },
    });

    await expect(solicitacaoService.concluir('sol-1', 'doador-1', false)).rejects.toMatchObject({ status: 409 });
  });

  test('exige que o item esteja reservado', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'aceita', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', status: 'doado', titulo: 'Sofá' },
    });

    await expect(solicitacaoService.concluir('sol-1', 'doador-1', false)).rejects.toMatchObject({ status: 409 });
  });

  test('conclui a doação e notifica o solicitante', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: 'sol-1', status: 'aceita', solicitanteId: 's1',
      item: { id: 'item-1', doadorId: 'doador-1', status: 'reservado', titulo: 'Sofá' },
    });
    prisma.itemDoacao.update.mockResolvedValue({});
    prisma.notificacao.create.mockResolvedValue({});

    await solicitacaoService.concluir('sol-1', 'doador-1', false);

    expect(prisma.itemDoacao.update).toHaveBeenCalledWith({
      where: { id: 'item-1' },
      data: { status: 'doado' },
    });
  });
});

const prisma = require('../../src/lib/prisma');
const notificacaoService = require('../../src/services/notificacao.service');

describe('listar', () => {
  test('lista todas por padrão', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'n1' }], 1]);
    const resultado = await notificacaoService.listar('u1');
    expect(resultado.notificacoes).toHaveLength(1);
  });

  test('filtra apenas não lidas quando solicitado', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);
    await notificacaoService.listar('u1', { apenasNaoLidas: true });

    expect(prisma.notificacao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { usuarioId: 'u1', lida: false },
    }));
  });
});

describe('contarNaoLidas', () => {
  test('devolve a contagem de não lidas do usuário', async () => {
    prisma.notificacao.count.mockResolvedValue(4);
    const resultado = await notificacaoService.contarNaoLidas('u1');
    expect(resultado).toEqual({ naoLidas: 4 });
    expect(prisma.notificacao.count).toHaveBeenCalledWith({ where: { usuarioId: 'u1', lida: false } });
  });
});

describe('marcarComoLida', () => {
  test('lança 404 quando a notificação não existe', async () => {
    prisma.notificacao.findUnique.mockResolvedValue(null);
    await expect(notificacaoService.marcarComoLida('n1', 'u1')).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita quando a notificação pertence a outro usuário', async () => {
    prisma.notificacao.findUnique.mockResolvedValue({ id: 'n1', usuarioId: 'outro-usuario' });
    await expect(notificacaoService.marcarComoLida('n1', 'u1')).rejects.toMatchObject({ status: 403 });
  });

  test('marca como lida quando pertence ao usuário', async () => {
    prisma.notificacao.findUnique.mockResolvedValue({ id: 'n1', usuarioId: 'u1' });
    prisma.notificacao.update.mockResolvedValue({ id: 'n1', lida: true });

    const resultado = await notificacaoService.marcarComoLida('n1', 'u1');
    expect(resultado.lida).toBe(true);
  });
});

describe('marcarTodasComoLidas', () => {
  test('atualiza apenas as notificações não lidas do usuário', async () => {
    prisma.notificacao.updateMany.mockResolvedValue({ count: 3 });
    await notificacaoService.marcarTodasComoLidas('u1');

    expect(prisma.notificacao.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', lida: false },
      data: { lida: true },
    });
  });
});

describe('remover', () => {
  test('lança 404 quando a notificação não existe', async () => {
    prisma.notificacao.findUnique.mockResolvedValue(null);
    await expect(notificacaoService.remover('n1', 'u1')).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita remoção de notificação de outro usuário (posse)', async () => {
    prisma.notificacao.findUnique.mockResolvedValue({ id: 'n1', usuarioId: 'outro-usuario' });
    await expect(notificacaoService.remover('n1', 'u1')).rejects.toMatchObject({ status: 403 });
  });

  test('remove quando pertence ao usuário', async () => {
    prisma.notificacao.findUnique.mockResolvedValue({ id: 'n1', usuarioId: 'u1' });
    prisma.notificacao.delete.mockResolvedValue({});

    await notificacaoService.remover('n1', 'u1');
    expect(prisma.notificacao.delete).toHaveBeenCalledWith({ where: { id: 'n1' } });
  });
});

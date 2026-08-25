// NOTA: exigência de itemId foi movida para o middleware Joi na rota (POST
// /favoritos) — coberta em tests/integration/validacao.test.js.
const prisma = require('../../src/lib/prisma');
const favoritoService = require('../../src/services/favorito.service');

describe('adicionar', () => {
  test('lança 404 quando o item não existe', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    await expect(favoritoService.adicionar('u1', 'item-inexistente')).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita favorito duplicado', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.favorito.findUnique.mockResolvedValue({ id: 'fav-existente' });

    await expect(favoritoService.adicionar('u1', 'item-1')).rejects.toMatchObject({ status: 409 });
  });

  test('adiciona aos favoritos com sucesso', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.favorito.findUnique.mockResolvedValue(null);
    prisma.favorito.create.mockResolvedValue({ id: 'fav-1', usuarioId: 'u1', itemId: 'item-1' });

    const resultado = await favoritoService.adicionar('u1', 'item-1');
    expect(resultado.id).toBe('fav-1');
  });
});

describe('remover', () => {
  test('lança 404 quando o favorito não existe', async () => {
    prisma.favorito.findUnique.mockResolvedValue(null);
    await expect(favoritoService.remover('u1', 'item-1')).rejects.toMatchObject({ status: 404 });
  });

  test('remove com sucesso', async () => {
    prisma.favorito.findUnique.mockResolvedValue({ id: 'fav-1' });
    prisma.favorito.delete.mockResolvedValue({});

    await favoritoService.remover('u1', 'item-1');
    expect(prisma.favorito.delete).toHaveBeenCalledWith({ where: { id: 'fav-1' } });
  });
});

describe('listar', () => {
  test('devolve favoritos paginados', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'fav-1' }], 1]);
    const resultado = await favoritoService.listar('u1', {});
    expect(resultado.favoritos).toHaveLength(1);
    expect(resultado.total).toBe(1);
  });
});

describe('verificar', () => {
  test('retorna true quando o item está favoritado', async () => {
    prisma.favorito.findUnique.mockResolvedValue({ id: 'fav-1' });
    expect(await favoritoService.verificar('u1', 'item-1')).toBe(true);
  });

  test('retorna false quando o item não está favoritado', async () => {
    prisma.favorito.findUnique.mockResolvedValue(null);
    expect(await favoritoService.verificar('u1', 'item-1')).toBe(false);
  });
});
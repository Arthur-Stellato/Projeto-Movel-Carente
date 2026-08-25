// NOTA: validação de formato (nome obrigatório/vazio, limite de 100 caracteres)
// foi movida para o middleware Joi nas rotas — coberta em
// tests/integration/validacao.test.js. Aqui só sobram as regras que dependem
// do banco (categoria não encontrada, nome/slug duplicado).
const prisma = require('../../src/lib/prisma');
const categoriaService = require('../../src/services/categoria.service');

describe('listar', () => {
  test('por padrão, lista só categorias ativas', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 'c1', ativo: true }]);
    await categoriaService.listar();
    expect(prisma.categoria.findMany).toHaveBeenCalledWith({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
    });
  });

  test('com incluirInativas=true, lista todas', async () => {
    prisma.categoria.findMany.mockResolvedValue([]);
    await categoriaService.listar({ incluirInativas: true });
    expect(prisma.categoria.findMany).toHaveBeenCalledWith({
      where: {},
      orderBy: { nome: 'asc' },
    });
  });
});

describe('buscarPorId', () => {
  test('lança 404 quando a categoria não existe', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);
    await expect(categoriaService.buscarPorId('inexistente')).rejects.toMatchObject({ status: 404 });
  });
});

describe('criar', () => {
  test('rejeita nome duplicado (checa nome OU slug)', async () => {
    prisma.categoria.findFirst.mockResolvedValue({ id: 'existente' });
    await expect(categoriaService.criar({ nome: 'Móveis' })).rejects.toMatchObject({ status: 409 });
  });

  test('cria categoria com slug gerado automaticamente', async () => {
    prisma.categoria.findFirst.mockResolvedValue(null);
    prisma.categoria.create.mockResolvedValue({ id: 'c1', nome: 'Eletrodomésticos', slug: 'eletrodomesticos' });

    const resultado = await categoriaService.criar({ nome: 'Eletrodomésticos' });

    expect(prisma.categoria.create).toHaveBeenCalledWith({
      data: { nome: 'Eletrodomésticos', slug: 'eletrodomesticos', icone: undefined },
    });
    expect(resultado.slug).toBe('eletrodomesticos');
  });
});

describe('atualizar', () => {
  test('lança 404 quando a categoria não existe', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);
    await expect(categoriaService.atualizar('inexistente', { nome: 'Novo' })).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita conflito de nome/slug com outra categoria existente', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.categoria.findFirst.mockResolvedValue({ id: 'c2' }); // outra categoria com mesmo nome/slug

    await expect(categoriaService.atualizar('c1', { nome: 'Móveis' })).rejects.toMatchObject({ status: 409 });
    // Garante que a checagem de conflito exclui a própria categoria (id: { not: id })
    expect(prisma.categoria.findFirst).toHaveBeenCalledWith({
      where: { id: { not: 'c1' }, OR: [{ nome: 'Móveis' }, { slug: 'moveis' }] },
    });
  });

  test('atualiza normalmente quando não há conflito', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.categoria.findFirst.mockResolvedValue(null);
    prisma.categoria.update.mockResolvedValue({ id: 'c1', nome: 'Roupas', ativo: false });

    const resultado = await categoriaService.atualizar('c1', { nome: 'Roupas', ativo: false });
    expect(resultado.ativo).toBe(false);
  });
});

describe('desativar', () => {
  test('lança 404 quando a categoria não existe', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);
    await expect(categoriaService.desativar('inexistente')).rejects.toMatchObject({ status: 404 });
  });

  test('faz soft delete (ativo=false), não remove fisicamente', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: 'c1' });
    prisma.categoria.update.mockResolvedValue({ id: 'c1', ativo: false });

    await categoriaService.desativar('c1');

    expect(prisma.categoria.update).toHaveBeenCalledWith({ where: { id: 'c1' }, data: { ativo: false } });
  });
});

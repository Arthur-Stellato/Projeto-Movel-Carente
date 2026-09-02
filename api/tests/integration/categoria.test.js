const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

function gerarToken({ tipo = 'usuario', sub = 'usuario-1' } = {}) {
  return jwt.sign({ sub, tipo }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

describe('GET /categorias', () => {
  test('lista categorias ativas sem precisar de autenticação', async () => {
    prisma.categoria.findMany.mockResolvedValue([{ id: 'c1', nome: 'Móveis', ativo: true }]);

    const res = await request(app).get('/categorias');

    expect(res.status).toBe(200);
    expect(res.body.categorias).toHaveLength(1);
  });

  test('?todas=true só tem efeito quando quem pede é admin autenticado', async () => {
    prisma.categoria.findMany.mockResolvedValue([]);
    const tokenUsuarioComum = gerarToken({ tipo: 'usuario' });

    await request(app).get('/categorias?todas=true').set('Authorization', `Bearer ${tokenUsuarioComum}`);

    expect(prisma.categoria.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { ativo: true } }));
  });

  test('admin autenticado com ?todas=true vê categorias inativas também', async () => {
    prisma.categoria.findMany.mockResolvedValue([]);
    const tokenAdmin = gerarToken({ tipo: 'admin' });

    await request(app).get('/categorias?todas=true').set('Authorization', `Bearer ${tokenAdmin}`);

    expect(prisma.categoria.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: {} }));
  });
});

describe('GET /categorias/:id', () => {
  test('id com formato inválido devolve 400 antes mesmo de tocar o banco', async () => {
    const res = await request(app).get('/categorias/nao-e-um-uuid');

    expect(res.status).toBe(400);
    expect(prisma.categoria.findUnique).not.toHaveBeenCalled();
  });

  test('id válido mas inexistente devolve 404', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);
    const res = await request(app).get('/categorias/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(404);
  });

  test('id válido e existente devolve 200 com a categoria', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', nome: 'Móveis', ativo: true });
    const res = await request(app).get('/categorias/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(200);
    expect(res.body.categoria.nome).toBe('Móveis');
  });

  test('categoria inativa devolve 404 pra quem não é admin (visitante ou usuário comum)', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', nome: 'Antiga', ativo: false });
    const res = await request(app).get('/categorias/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(404);
  });

  test('categoria inativa devolve 200 pra admin autenticado', async () => {
    prisma.categoria.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', nome: 'Antiga', ativo: false });
    const tokenAdmin = gerarToken({ tipo: 'admin' });

    const res = await request(app)
      .get('/categorias/550e8400-e29b-41d4-a716-446655440000')
      .set('Authorization', `Bearer ${tokenAdmin}`);

    expect(res.status).toBe(200);
  });
});

describe('POST /categorias', () => {
  test('sem token, devolve 401', async () => {
    const res = await request(app).post('/categorias').send({ nome: 'Nova Categoria' });
    expect(res.status).toBe(401);
  });

  test('com token de usuário comum (não-admin), devolve 403', async () => {
    const token = gerarToken({ tipo: 'usuario' });
    const res = await request(app).post('/categorias').set('Authorization', `Bearer ${token}`).send({ nome: 'Nova Categoria' });
    expect(res.status).toBe(403);
  });

  test('com token inválido/adulterado, devolve 401', async () => {
    const res = await request(app).post('/categorias').set('Authorization', 'Bearer token-invalido').send({ nome: 'X' });
    expect(res.status).toBe(401);
  });

  test('admin autenticado cria a categoria com sucesso (201)', async () => {
    const token = gerarToken({ tipo: 'admin' });
    prisma.categoria.findFirst.mockResolvedValue(null);
    prisma.categoria.create.mockResolvedValue({ id: 'c1', nome: 'Eletrônicos', slug: 'eletronicos' });

    const res = await request(app).post('/categorias').set('Authorization', `Bearer ${token}`).send({ nome: 'Eletrônicos' });

    expect(res.status).toBe(201);
    expect(res.body.categoria.slug).toBe('eletronicos');
  });

  test('admin autenticado tentando criar categoria duplicada recebe 409', async () => {
    const token = gerarToken({ tipo: 'admin' });
    prisma.categoria.findFirst.mockResolvedValue({ id: 'existente' });

    const res = await request(app).post('/categorias').set('Authorization', `Bearer ${token}`).send({ nome: 'Móveis' });

    expect(res.status).toBe(409);
    expect(res.body.erro).toBeDefined();
  });
});

describe('DELETE /categorias/:id', () => {
  test('admin desativa a categoria (204, sem corpo)', async () => {
    const token = gerarToken({ tipo: 'admin' });
    prisma.categoria.findUnique.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000' });
    prisma.categoria.update.mockResolvedValue({ id: '550e8400-e29b-41d4-a716-446655440000', ativo: false });

    const res = await request(app)
      .delete('/categorias/550e8400-e29b-41d4-a716-446655440000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(204);
  });

  test('usuário comum não pode desativar categoria (403)', async () => {
    const token = gerarToken({ tipo: 'usuario' });
    const res = await request(app)
      .delete('/categorias/550e8400-e29b-41d4-a716-446655440000')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });
});

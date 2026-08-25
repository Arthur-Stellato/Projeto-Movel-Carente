const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

describe('rota não encontrada', () => {
  test('devolve 404 em JSON, não a página HTML padrão do Express', async () => {
    const res = await request(app).get('/essa-rota-nao-existe');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body).toEqual({ erro: expect.any(String) });
    expect(res.text).not.toMatch(/<html/i);
  });

  test('também funciona para métodos HTTP não mapeados numa rota existente', async () => {
    const res = await request(app).patch('/categorias');
    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/json/);
  });
});

describe('corpo da requisição malformado', () => {
  test('JSON inválido no corpo devolve 400 em JSON, sem stack trace no corpo da resposta', async () => {
    const res = await request(app)
      .post('/categorias')
      .set('Content-Type', 'application/json')
      .send('{ "nome": "sem fechar aspas ');

    expect(res.status).toBe(400);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.erro).toBeDefined();
    expect(res.text).not.toMatch(/at Object/); // padrão de linha de stack trace do Node
    expect(res.text).not.toMatch(/<html/i);
  });

  test('corpo maior que o limite de 1MB devolve 413 em JSON, não trava nem derruba a API', async () => {
    const corpoGrande = JSON.stringify({ nome: 'a'.repeat(2 * 1024 * 1024) }); // 2MB > limite de 1MB

    const res = await request(app)
      .post('/categorias')
      .set('Content-Type', 'application/json')
      .send(corpoGrande);

    expect(res.status).toBe(413);
    expect(res.headers['content-type']).toMatch(/json/);
    expect(res.body.erro).toBeDefined();
  });
});

describe('parâmetro de rota inválido', () => {
  test(':id que não é UUID devolve 400 antes de chegar no service/Prisma', async () => {
    const res = await request(app).get('/categorias/12345');

    expect(res.status).toBe(400);
    expect(res.body.erro).toBeDefined();
    expect(prisma.categoria.findUnique).not.toHaveBeenCalled();
  });
});

describe('erro de constraint do Prisma que escapa da checagem manual', () => {
  test('violação de unique constraint (P2002) vira 409, não 500, mesmo sem checagem manual prévia', async () => {
    const token = require('jsonwebtoken').sign(
      { sub: 'admin-1', tipo: 'admin' },
      process.env.JWT_SECRET,
      { expiresIn: '15m' }
    );
    const erroPrisma = new Error('Unique constraint failed on the fields: (`nome`)');
    erroPrisma.name = 'PrismaClientKnownRequestError';
    erroPrisma.code = 'P2002';
    erroPrisma.meta = { target: ['nome'] };

    prisma.categoria.findFirst.mockResolvedValue(null); // passa da checagem manual de duplicidade...
    prisma.categoria.create.mockRejectedValue(erroPrisma); // ...mas o banco rejeita mesmo assim (corrida)

    const res = await request(app)
      .post('/categorias')
      .set('Authorization', `Bearer ${token}`)
      .send({ nome: 'Móveis' });

    expect(res.status).toBe(409);
    expect(res.body.erro).toMatch(/nome/);
    expect(JSON.stringify(res.body)).not.toMatch(/Unique constraint failed/); // sem vazar mensagem técnica
  });
});

describe('erro interno inesperado', () => {
  test('falha inesperada no banco vira 500 genérico, sem vazar detalhe interno', async () => {
    prisma.categoria.findUnique.mockRejectedValue(new Error('conexão com o banco caiu'));

    const res = await request(app).get('/categorias/550e8400-e29b-41d4-a716-446655440000');

    expect(res.status).toBe(500);
    expect(res.body.erro).toBeDefined();
    // A mensagem devolvida ao cliente não deve conter o texto do erro interno
    expect(JSON.stringify(res.body)).not.toMatch(/conexão com o banco caiu/);
  });
});
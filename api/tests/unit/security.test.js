const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const { hashearToken } = require('../../src/lib/token');

describe('cabeçalhos de segurança (Helmet)', () => {
  test('respostas incluem os cabeçalhos padrão do Helmet e CSP ativo', async () => {
    prisma.categoria.findMany.mockResolvedValue([]);

    const res = await request(app).get('/categorias');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBeDefined();
    expect(res.headers['content-security-policy']).toBeDefined();
  });

  test('CSP é removido especificamente na rota /docs para permitir o Swagger UI', async () => {
    const res = await request(app).get('/docs/');

    expect(res.headers['content-security-policy']).toBeUndefined();
  });

  test('rota de uploads estáticos possui cabeçalhos de proteção e sandbox', async () => {
    const res = await request(app).get('/uploads/itens/inexistente.jpg');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['content-security-policy']).toContain('sandbox');
  });
});

describe('hashing de tokens sensíveis (SHA-256)', () => {
  test('hashearToken produz um hash SHA-256 de 64 caracteres hexadecimais diferente do token cru', () => {
    const tokenCru = 'abc123tokensecreto';
    const hash = hashearToken(tokenCru);

    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(tokenCru);
    expect(hash).toBe(hashearToken(tokenCru)); // idempotente
  });
});
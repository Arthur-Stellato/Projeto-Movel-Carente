const request = require('supertest');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const { clienteRedis } = require('../../src/config/rateLimiter');

describe('GET /health/ready', () => {
  test('Postgres e Redis acessíveis: 200, status "ok"', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    clienteRedis.ping.mockResolvedValue('PONG');

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok', postgres: 'ok', redis: 'ok' });
  });

  test('Postgres inacessível: 503 — é crítico, a API não funciona sem ele', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('conexão recusada'));
    clienteRedis.ping.mockResolvedValue('PONG');

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.postgres).toBe('erro');
    expect(res.body.status).toBe('indisponivel');
  });

  test('Redis inacessível sozinho: continua 200, só marca "degradado" — não é crítico', async () => {
    prisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    clienteRedis.ping.mockRejectedValue(new Error('Redis fora do ar'));

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'degradado', postgres: 'ok', redis: 'degradado' });
  });

  test('Postgres E Redis inacessíveis: 503 prevalece (Postgres é o crítico)', async () => {
    prisma.$queryRaw.mockRejectedValue(new Error('conexão recusada'));
    clienteRedis.ping.mockRejectedValue(new Error('Redis fora do ar'));

    const res = await request(app).get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.postgres).toBe('erro');
    expect(res.body.redis).toBe('degradado');
  });
});
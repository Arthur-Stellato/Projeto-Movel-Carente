// Este teste usa o rateLimiter DE VERDADE, não o mock — de propósito. O objetivo é
// provar o comportamento de fail-open contra um Redis que realmente não está
// disponível neste ambiente (não existe Redis rodando no sandbox de teste), e não
// apenas checar que o código "parece certo".
jest.unmock('../../src/config/rateLimiter');

const express = require('express');
const request = require('supertest');

describe('rate limiter real — fail-open quando o Redis está indisponível', () => {
  let app;
  let clienteRedis;

  beforeAll(() => {
    const rateLimiter = require('../../src/config/rateLimiter');
    clienteRedis = rateLimiter.clienteRedis;

    app = express();
    app.use(rateLimiter.limitadorGeral);
    app.get('/ping', (req, res) => res.json({ ok: true }));
  });

  afterAll(() => {
    // Sem isso, o cliente ioredis continua tentando reconectar em segundo plano
    // (retryStrategy) e o processo de teste não encerra sozinho.
    clienteRedis.disconnect();
  });

  test('requisição segue normalmente mesmo sem Redis — não trava, não derruba a API', async () => {
    const res = await request(app).get('/ping');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ ok: true });
  }, 10000);

  test('múltiplas requisições em sequência continuam funcionando (sem acumular travamento)', async () => {
    for (let i = 0; i < 3; i += 1) {
      const res = await request(app).get('/ping');
      expect(res.status).toBe(200);
    }
  }, 10000);
});
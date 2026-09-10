// Mock manual do rate limiter. A versão real conecta no Redis (ioredis) na hora de
// ser importada, o que não deve acontecer em teste. Aqui os dois limitadores viram
// middlewares no-op que sempre deixam a requisição passar.
const passThrough = (req, res, next) => next();

module.exports = {
  limitadorGeral: passThrough,
  limitadorAuth: passThrough,
  clienteRedis: {
    // Usado pelo /health/ready (app.js) para checar o Redis. Cada teste configura
    // o retorno via clienteRedis.ping.mockResolvedValue(...) / mockRejectedValue(...).
    ping: jest.fn(),
    // Fase 10: usados pelo limite de taxa do socket (src/socket/index.js).
    // Default incr()=1 (sempre "primeira requisição da janela", nunca estoura
    // nenhum limite) pra não quebrar nenhum teste de socket já existente que
    // não tem nada a ver com rate limiting — só os testes da fase 10 sobrescrevem
    // isso pra simular o limite estourando (ver rateLimiterSocket.test.js).
    incr: jest.fn().mockResolvedValue(1),
    pexpire: jest.fn().mockResolvedValue(1),
  },
};
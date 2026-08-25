// Mock manual do rate limiter. A versão real conecta no Redis (ioredis) na hora de
// ser importada, o que não deve acontecer em teste. Aqui os dois limitadores viram
// middlewares no-op que sempre deixam a requisição passar.
const passThrough = (req, res, next) => next();

module.exports = {
  limitadorGeral: passThrough,
  limitadorAuth: passThrough,
  // Usado pelo /health/ready (app.js) para checar o Redis. Cada teste configura
  // o retorno via clienteRedis.ping.mockResolvedValue(...) / mockRejectedValue(...).
  clienteRedis: { ping: jest.fn() },
};
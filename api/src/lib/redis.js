// Configuração única da conexão Redis, reaproveitada em toda fila/worker do projeto.
// Mesmo padrão do lib/prisma.js: um lugar só define a conexão, todo o resto importa daqui.
const conexaoRedis = {
  host: process.env.REDIS_HOST || 'localhost',
  port: Number(process.env.REDIS_PORT) || 6379,
};

module.exports = conexaoRedis;
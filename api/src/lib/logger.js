const pino = require('pino');

const ambienteDeTeste = process.env.NODE_ENV === 'test';
const producao = process.env.NODE_ENV === 'production';

const logger = pino({
  level: ambienteDeTeste ? 'silent' : (process.env.LOG_LEVEL || 'info'),
  // Em produção, log cru em JSON — é o formato que ferramentas de agregação de log
  // (Datadog, CloudWatch, etc) esperam. Em desenvolvimento, formatado e colorido
  // pra ser lido direto no terminal. Em teste, nem chega a instanciar o transport
  // (level 'silent' já corta tudo antes, e o worker thread do pino-pretty não some
  // limpo no ambiente do Jest, causando os mesmos avisos de "handle aberto" que já
  // vimos com o ioredis).
  transport: producao || ambienteDeTeste
    ? undefined
    : {
      target: 'pino-pretty',
      options: { colorize: true, translateTime: 'SYS:HH:MM:ss', ignore: 'pid,hostname' },
    },
});

module.exports = logger;
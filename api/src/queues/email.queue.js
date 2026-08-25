const { Queue } = require('bullmq');
const conexaoRedis = require('../lib/redis');

const filaEmail = new Queue('emails', { connection: conexaoRedis });

async function enfileirarEmail({ para, assunto, html, texto }) {
  await filaEmail.add(
    'enviar-email',
    { para, assunto, html, texto },
    {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
    }
  );
}

module.exports = { filaEmail, enfileirarEmail };
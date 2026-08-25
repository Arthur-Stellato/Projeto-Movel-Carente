require('dotenv').config();
const { Worker } = require('bullmq');
const conexaoRedis = require('../lib/redis');
const { enviarEmail } = require('../lib/email');
const { iniciarDispatcherOutbox } = require('../lib/outboxDispatcher');
const logger = require('../lib/logger');

const worker = new Worker(
  'emails',
  async (job) => {
    const { para, assunto, html, texto } = job.data;
    logger.info({ para, tarefaId: job.id }, '[EMAIL WORKER] Enviando email');
    await enviarEmail({ para, assunto, html, texto });
    logger.info({ para, tarefaId: job.id }, '[EMAIL WORKER] Email enviado com sucesso');
  },
  { connection: conexaoRedis }
);

worker.on('failed', (job, err) => {
  logger.error({ err, tarefaId: job.id }, '[EMAIL WORKER] Falha ao enviar email');
});

logger.info('[EMAIL WORKER] Aguardando emails para enviar...');

// Roda no mesmo processo do worker de email (não é um Job do BullMQ — é um
// polling simples na tabela de outbox, ver src/lib/outboxDispatcher.js).
// É este loop quem de fato chama enfileirarEmail() pro BullMQ agora — os
// services (auth.service.js) só gravam o evento pendente, nunca enfileiram
// direto, então uma queda do Redis nunca mais trava um request HTTP.
iniciarDispatcherOutbox();
logger.info('[EMAIL WORKER] Dispatcher de outbox iniciado');
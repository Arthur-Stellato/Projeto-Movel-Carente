const prisma = require('./prisma');

// Grava um evento pendente na tabela de outbox. Sempre uma escrita comum no
// Postgres — nunca toca o Redis, então nunca trava esperando o BullMQ. Quem
// de fato enfileira no BullMQ é o dispatcher (ver src/lib/outboxDispatcher.js),
// rodando fora do ciclo de request.
//
// Aceita um `cliente` opcional (ex: uma transação `prisma.$transaction`) pra
// quem quiser gravar o evento atomicamente junto com outra escrita relacionada
// — ver uso em auth.service.js, onde o evento de "enviar email de verificação"
// entra na mesma transação que cria o token de verificação.
//
// PROPOSITALMENTE NÃO é `async`: precisa devolver a PrismaPromise crua (o
// retorno direto de `cliente.eventoOutbox.create(...)`), sem embrulhar numa
// Promise comum — senão `prisma.$transaction([registrarEventoOutbox(...), ...])`
// quebra silenciosamente (o Prisma real exige o objeto PrismaPromise
// específico pra conseguir agrupar as operações na mesma transação; uma
// Promise comum de uma função `async` perde essa marcação). Quem só quer
// `await registrarEventoOutbox(...)` isoladamente continua funcionando igual
// — `await` funciona em qualquer thenable.
function registrarEventoOutbox(tipo, payload, cliente = prisma) {
  return cliente.eventoOutbox.create({
    data: { tipo, payload },
  });
}

module.exports = { registrarEventoOutbox };

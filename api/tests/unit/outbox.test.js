const prisma = require('../../src/lib/prisma');
const { registrarEventoOutbox } = require('../../src/lib/outbox');

describe('registrarEventoOutbox', () => {
  test('grava tipo e payload na tabela de outbox', async () => {
    prisma.eventoOutbox.create.mockResolvedValue({ id: 'evento-1' });

    await registrarEventoOutbox('email', { para: 'joana@example.com' });

    expect(prisma.eventoOutbox.create).toHaveBeenCalledWith({
      data: { tipo: 'email', payload: { para: 'joana@example.com' } },
    });
  });

  test('aceita um cliente alternativo (ex: dentro de uma transação)', async () => {
    const clienteTx = { eventoOutbox: { create: jest.fn().mockResolvedValue({}) } };

    await registrarEventoOutbox('email', { para: 'x@example.com' }, clienteTx);

    expect(clienteTx.eventoOutbox.create).toHaveBeenCalled();
    expect(prisma.eventoOutbox.create).not.toHaveBeenCalled();
  });

  test('NÃO é uma função async — devolve a PrismaPromise crua, sem embrulhar numa Promise comum (necessário pra funcionar dentro de prisma.$transaction([...]))', () => {
    // Se algum dia isso virar `async function`, essa asserção quebra — é
    // exatamente o sinal de que a garantia documentada no arquivo foi perdida.
    expect(registrarEventoOutbox.constructor.name).not.toBe('AsyncFunction');
  });
});

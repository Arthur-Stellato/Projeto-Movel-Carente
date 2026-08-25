const prisma = require('../../src/lib/prisma');
const { enfileirarEmail } = require('../../src/queues/email.queue');
const { processarEventosPendentes, iniciarDispatcherOutbox, MAX_TENTATIVAS } = require('../../src/lib/outboxDispatcher');

function eventoFake(overrides = {}) {
  return {
    id: 'evento-1',
    tipo: 'email',
    payload: { para: 'joana@example.com', assunto: 'Oi', html: '<p>Oi</p>' },
    status: 'pendente',
    tentativas: 0,
    criadoEm: new Date(),
    ...overrides,
  };
}

describe('processarEventosPendentes', () => {
  test('sem eventos pendentes, não faz nada', async () => {
    prisma.eventoOutbox.findMany.mockResolvedValue([]);

    const resultado = await processarEventosPendentes();

    expect(resultado).toEqual({ total: 0, processados: 0, falharam: 0 });
    expect(enfileirarEmail).not.toHaveBeenCalled();
  });

  test('respeita o limite de eventos por ciclo', async () => {
    prisma.eventoOutbox.findMany.mockResolvedValue([]);

    await processarEventosPendentes(5);

    expect(prisma.eventoOutbox.findMany).toHaveBeenCalledWith({
      where: { status: 'pendente' },
      orderBy: { criadoEm: 'asc' },
      take: 5,
    });
  });

  test('despacha evento de email com sucesso: marca processado e chama enfileirarEmail com o payload', async () => {
    const evento = eventoFake();
    prisma.eventoOutbox.findMany.mockResolvedValue([evento]);
    prisma.eventoOutbox.update.mockResolvedValue({});

    const resultado = await processarEventosPendentes();

    expect(enfileirarEmail).toHaveBeenCalledWith(evento.payload);
    expect(prisma.eventoOutbox.update).toHaveBeenCalledWith({
      where: { id: 'evento-1' },
      data: { status: 'processado', processadoEm: expect.any(Date) },
    });
    expect(resultado).toEqual({ total: 1, processados: 1, falharam: 0 });
  });

  test('tipo de evento desconhecido: falha direto, sem tentar de novo (não é erro transitório)', async () => {
    const evento = eventoFake({ tipo: 'sms' });
    prisma.eventoOutbox.findMany.mockResolvedValue([evento]);
    prisma.eventoOutbox.update.mockResolvedValue({});

    const resultado = await processarEventosPendentes();

    expect(enfileirarEmail).not.toHaveBeenCalled();
    expect(prisma.eventoOutbox.update).toHaveBeenCalledWith({
      where: { id: 'evento-1' },
      data: { status: 'falhou', ultimoErro: expect.stringContaining('sms') },
    });
    expect(resultado).toEqual({ total: 1, processados: 0, falharam: 1 });
  });

  test('despacho falha e ainda não bateu o máximo de tentativas: continua pendente, incrementa contador', async () => {
    const evento = eventoFake({ tentativas: 1 });
    prisma.eventoOutbox.findMany.mockResolvedValue([evento]);
    enfileirarEmail.mockRejectedValueOnce(new Error('Redis fora do ar'));
    prisma.eventoOutbox.update.mockResolvedValue({});

    const resultado = await processarEventosPendentes();

    expect(prisma.eventoOutbox.update).toHaveBeenCalledWith({
      where: { id: 'evento-1' },
      data: { tentativas: 2, status: 'pendente', ultimoErro: 'Redis fora do ar' },
    });
    expect(resultado.falharam).toBe(1);
  });

  test('despacho falha na última tentativa permitida: desiste e marca falhou', async () => {
    const evento = eventoFake({ tentativas: MAX_TENTATIVAS - 1 });
    prisma.eventoOutbox.findMany.mockResolvedValue([evento]);
    enfileirarEmail.mockRejectedValueOnce(new Error('Sempre falha'));
    prisma.eventoOutbox.update.mockResolvedValue({});

    await processarEventosPendentes();

    expect(prisma.eventoOutbox.update).toHaveBeenCalledWith({
      where: { id: 'evento-1' },
      data: { tentativas: MAX_TENTATIVAS, status: 'falhou', ultimoErro: 'Sempre falha' },
    });
  });

  test('processa vários eventos no mesmo ciclo e soma os resultados corretamente', async () => {
    const sucesso = eventoFake({ id: 'e1' });
    const falhaTransitoria = eventoFake({ id: 'e2', tentativas: 0 });
    const tipoDesconhecido = eventoFake({ id: 'e3', tipo: 'push' });

    prisma.eventoOutbox.findMany.mockResolvedValue([sucesso, falhaTransitoria, tipoDesconhecido]);
    prisma.eventoOutbox.update.mockResolvedValue({});
    enfileirarEmail
      .mockResolvedValueOnce(undefined) // e1: sucesso
      .mockRejectedValueOnce(new Error('falhou')); // e2: falha transitória

    const resultado = await processarEventosPendentes();

    expect(resultado).toEqual({ total: 3, processados: 1, falharam: 2 });
  });
});

describe('iniciarDispatcherOutbox', () => {
  test('roda imediatamente ao iniciar, e de novo a cada intervalo', async () => {
    jest.useFakeTimers();
    prisma.eventoOutbox.findMany.mockResolvedValue([]);

    const timer = iniciarDispatcherOutbox(1000);
    await Promise.resolve(); // deixa a execução imediata (não-esperada) terminar
    expect(prisma.eventoOutbox.findMany).toHaveBeenCalledTimes(1);

    jest.advanceTimersByTime(1000);
    await Promise.resolve();
    expect(prisma.eventoOutbox.findMany).toHaveBeenCalledTimes(2);

    clearInterval(timer);
    jest.useRealTimers();
  });

  test('erro no ciclo inteiro (ex: Postgres fora do ar) não derruba o processo', async () => {
    jest.useFakeTimers();
    prisma.eventoOutbox.findMany.mockRejectedValue(new Error('Postgres fora do ar'));

    const timer = iniciarDispatcherOutbox(1000);
    await Promise.resolve();
    await Promise.resolve();

    clearInterval(timer);
    jest.useRealTimers();
    // Se chegou até aqui sem lançar/derrubar o teste, o erro foi contido corretamente.
  });
});

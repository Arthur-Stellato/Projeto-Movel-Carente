const logger = require('../../src/lib/logger');

describe('logger', () => {
  test('expõe a API padrão do pino (info, error, warn, debug)', () => {
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.error).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.debug).toBe('function');
  });

  test('fica silencioso em ambiente de teste (NODE_ENV=test), pra não poluir a saída do Jest', () => {
    expect(logger.level).toBe('silent');
  });
});
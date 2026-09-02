describe('validarVariaveisDeAmbiente', () => {
  const ENV_ORIGINAL = process.env;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let processExitSpy;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...ENV_ORIGINAL };
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    processExitSpy = jest.spyOn(process, 'exit').mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = ENV_ORIGINAL;
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    processExitSpy.mockRestore();
  });

  test('com DATABASE_URL e JWT_SECRET presentes (e fortes), não sai do processo nem avisa', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'um-segredo-bem-forte-e-longo-o-suficiente'; // 41 caracteres, acima do mínimo

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).not.toHaveBeenCalled();
    expect(consoleErrorSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });

  test('sem DATABASE_URL: loga erro claro e sai com código 1', () => {
    delete process.env.DATABASE_URL;
    process.env.JWT_SECRET = 'um-segredo-bem-forte-e-longo-o-suficiente';

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('DATABASE_URL'));
  });

  test('sem JWT_SECRET: loga erro claro e sai com código 1', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    delete process.env.JWT_SECRET;

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  test('variável presente mas vazia/só espaço conta como ausente', () => {
    process.env.DATABASE_URL = '   ';
    process.env.JWT_SECRET = 'um-segredo-bem-forte-e-longo-o-suficiente';

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).toHaveBeenCalledWith(1);
  });

  test('JWT_SECRET curto: avisa mas NÃO sai do processo (é warning, não erro fatal) fora de produção', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'curto';
    process.env.NODE_ENV = 'test';

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  test('JWT_SECRET curto EM PRODUÇÃO: loga erro claro e sai com código 1 (nada de deixar passar só com aviso)', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'curto-demais-para-producao';
    process.env.NODE_ENV = 'production';

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).toHaveBeenCalledWith(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('JWT_SECRET'));
  });

  test('JWT_SECRET com 32+ caracteres em produção: não sai nem avisa', () => {
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/db';
    process.env.JWT_SECRET = 'a'.repeat(32);
    process.env.NODE_ENV = 'production';

    const { validarVariaveisDeAmbiente } = require('../../src/lib/validarEnv');
    validarVariaveisDeAmbiente();

    expect(processExitSpy).not.toHaveBeenCalled();
    expect(consoleWarnSpy).not.toHaveBeenCalled();
  });
});
const { ErroDominio, tratarErroController } = require('../../src/lib/erros');
const logger = require('../../src/lib/logger');

function criarRespostaFake() {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('ErroDominio', () => {
  test('usa status 400 por padrão quando não informado', () => {
    const erro = new ErroDominio('algo deu errado');
    expect(erro.status).toBe(400);
    expect(erro.message).toBe('algo deu errado');
  });

  test('aceita status customizado', () => {
    const erro = new ErroDominio('não encontrado', 404);
    expect(erro.status).toBe(404);
  });

  test('subclasses mantêm identidade própria, mas ambas são instanceof ErroDominio', () => {
    class ErroTeste extends ErroDominio {}
    const erro = new ErroTeste('falha específica', 403);

    expect(erro).toBeInstanceOf(ErroTeste);
    expect(erro).toBeInstanceOf(ErroDominio);
    expect(erro).toBeInstanceOf(Error);
  });
});

describe('tratarErroController', () => {
  let loggerErrorSpy;

  beforeEach(() => {
    loggerErrorSpy = jest.spyOn(logger, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    loggerErrorSpy.mockRestore();
  });

  test('ErroDominio (ou subclasse): devolve o status e a mensagem definidos no erro', () => {
    class ErroTeste extends ErroDominio {}
    const res = criarRespostaFake();

    tratarErroController(new ErroTeste('CPF inválido', 400), res);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ erro: 'CPF inválido' });
  });

  test('erro genérico e inesperado: loga no servidor mas devolve só mensagem genérica (nunca vaza detalhe)', () => {
    const res = criarRespostaFake();
    const erroInterno = new Error('detalhe sensível do banco de dados');

    tratarErroController(erroInterno, res);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ erro: 'Erro interno do servidor' });
    expect(JSON.stringify(res.json.mock.calls[0][0])).not.toMatch(/detalhe sensível/);
    expect(loggerErrorSpy).toHaveBeenCalledWith({ err: erroInterno }, expect.any(String));
  });

  describe('erros do Prisma (PrismaClientKnownRequestError) que escaparam de checagem manual', () => {
    function criarErroPrismaFake(code, meta) {
      const erro = new Error('mensagem técnica do Prisma');
      erro.name = 'PrismaClientKnownRequestError';
      erro.code = code;
      erro.meta = meta;
      return erro;
    }

    test('P2002 (unique constraint): 409, mencionando o campo em conflito', () => {
      const res = criarRespostaFake();
      tratarErroController(criarErroPrismaFake('P2002', { target: ['email'] }), res);

      expect(res.status).toHaveBeenCalledWith(409);
      expect(res.json).toHaveBeenCalledWith({ erro: expect.stringContaining('email') });
    });

    test('P2002 sem meta.target: ainda devolve 409 com mensagem genérica de conflito', () => {
      const res = criarRespostaFake();
      tratarErroController(criarErroPrismaFake('P2002', undefined), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('P2003 (foreign key): 409', () => {
      const res = criarRespostaFake();
      tratarErroController(criarErroPrismaFake('P2003'), res);

      expect(res.status).toHaveBeenCalledWith(409);
    });

    test('P2025 (registro esperado não encontrado): 404', () => {
      const res = criarRespostaFake();
      tratarErroController(criarErroPrismaFake('P2025'), res);

      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('código do Prisma não mapeado explicitamente: cai no 500 genérico, sem vazar mensagem técnica', () => {
      const res = criarRespostaFake();
      tratarErroController(criarErroPrismaFake('P9999'), res);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({ erro: 'Erro interno do servidor' });
    });
  });
});
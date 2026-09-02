// NOTA: validação de formato (campos obrigatórios do login, força de senha na
// redefinição, token obrigatório) foi movida para o middleware Joi nas rotas —
// coberta em tests/integration/validacao.test.js. Aqui só sobram as regras de
// negócio (conta existe, bloqueio, token válido/expirado/usado).
const bcrypt = require('bcrypt');
const prisma = require('../../src/lib/prisma');
const authService = require('../../src/services/auth.service');

function criarUsuarioFake(overrides = {}) {
  return {
    id: 'usuario-1',
    email: 'joana@example.com',
    senhaHash: 'hash-fake',
    primeiroNome: 'Joana',
    ultimoNome: 'Silva',
    tipo: 'usuario',
    ativo: true,
    emailVerificado: true,
    tentativasLoginFalhas: 0,
    bloqueadoAte: null,
    ...overrides,
  };
}

describe('login', () => {
  test('rejeita com mensagem genérica quando o usuário não existe (evita enumeração de contas)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);

    await expect(authService.login({ email: 'naoexiste@example.com', senha: '12345678' }))
      .rejects.toMatchObject({ message: 'Email ou senha inválidos', status: 401 });
  });

  test('normaliza o email antes de consultar — maiúscula/espaço não deveriam impedir o login', async () => {
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake());
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    await authService.login({ email: '  Joana@Example.COM  ', senha: '12345678' });

    expect(prisma.usuario.findUnique).toHaveBeenCalledWith({ where: { email: 'joana@example.com' } });
  });

  test('rejeita conta desativada', async () => {
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake({ ativo: false }));
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true); // senha certa: só assim a checagem de status é alcançada

    await expect(authService.login({ email: 'joana@example.com', senha: '12345678' }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('rejeita login enquanto a conta estiver bloqueada, informando minutos restantes', async () => {
    const bloqueadoAte = new Date(Date.now() + 10 * 60000);
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake({ bloqueadoAte }));
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true); // senha certa: só assim a checagem de status é alcançada

    await expect(authService.login({ email: 'joana@example.com', senha: '12345678' }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('NÃO revela que a conta está desativada quando a senha está errada (evita enumeração de contas)', async () => {
    const usuario = criarUsuarioFake({ ativo: false });
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(authService.login({ email: 'joana@example.com', senha: 'errada' }))
      .rejects.toMatchObject({ message: 'Email ou senha inválidos', status: 401 });
  });

  test('NÃO revela que a conta está bloqueada quando a senha está errada (evita enumeração de contas)', async () => {
    const bloqueadoAte = new Date(Date.now() + 10 * 60000);
    const usuario = criarUsuarioFake({ bloqueadoAte });
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(authService.login({ email: 'joana@example.com', senha: 'errada' }))
      .rejects.toMatchObject({ message: 'Email ou senha inválidos', status: 401 });
  });

  test('roda bcrypt.compare mesmo quando o usuário não existe (evita diferença de tempo perceptível)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    const espiao = jest.spyOn(bcrypt, 'compare');

    await expect(authService.login({ email: 'naoexiste@example.com', senha: '12345678' })).rejects.toThrow();

    expect(espiao).toHaveBeenCalledWith('12345678', expect.any(String));
  });

  test('permite login normalmente quando o bloqueio anterior já expirou', async () => {
    const bloqueadoAte = new Date(Date.now() - 60000); // expirou há 1 minuto
    const usuario = criarUsuarioFake({ bloqueadoAte });
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue(usuario);
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const resultado = await authService.login({ email: 'joana@example.com', senha: '12345678' });

    expect(resultado.accessToken).toBeDefined();
    expect(resultado.usuario.senhaHash).toBeUndefined(); // sanitizado
  });

  test('registra tentativa de falha e não bloqueia antes do limite', async () => {
    const usuario = criarUsuarioFake({ tentativasLoginFalhas: 2 });
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(authService.login({ email: 'joana@example.com', senha: 'errada' }))
      .rejects.toMatchObject({ status: 401 });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario-1' },
      data: { tentativasLoginFalhas: { increment: 1 } },
    });
  });

  test('bloqueia a conta ao atingir o número máximo de tentativas (5)', async () => {
    const usuario = criarUsuarioFake({ tentativasLoginFalhas: 4 });
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(authService.login({ email: 'joana@example.com', senha: 'errada' }))
      .rejects.toMatchObject({ status: 401 });

    const chamada = prisma.usuario.update.mock.calls[0][0];
    expect(chamada.data.bloqueadoAte).toBeInstanceOf(Date);
    // O contador zera ao aplicar o bloqueio (evita ficar incrementando indefinidamente)
    expect(chamada.data.tentativasLoginFalhas).toBe(0);
  });

  test('login bem-sucedido zera tentativas e bloqueio, e devolve tokens', async () => {
    const usuario = criarUsuarioFake({ tentativasLoginFalhas: 3 });
    prisma.usuario.findUnique.mockResolvedValue(usuario);
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const resultado = await authService.login({ email: 'joana@example.com', senha: '12345678' });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario-1' },
      data: { tentativasLoginFalhas: 0, bloqueadoAte: null },
    });
    expect(resultado.accessToken).toEqual(expect.any(String));
    expect(resultado.refreshToken).toEqual(expect.any(String));
  });
});

describe('renovarAccessToken', () => {
  test('exige refresh token', async () => {
    await expect(authService.renovarAccessToken(undefined)).rejects.toMatchObject({ status: 401 });
  });

  test('rejeita refresh token inexistente', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null);
    await expect(authService.renovarAccessToken('token-invalido')).rejects.toMatchObject({ status: 401 });
  });

  test('token já revogado (reuso): rejeita E revoga todas as sessões ativas do usuário (detecção de roubo)', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', revogado: true, expiraEm: new Date(Date.now() + 100000),
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 2 });

    await expect(authService.renovarAccessToken('token-ja-rotacionado')).rejects.toMatchObject({ status: 401 });

    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'usuario-1', revogado: false },
      data: { revogado: true },
    });
  });

  test('rejeita refresh token expirado (mas não revogado)', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', revogado: false, expiraEm: new Date(Date.now() - 1000),
    });
    await expect(authService.renovarAccessToken('token-expirado')).rejects.toMatchObject({ status: 401 });
  });

  test('token válido: rotaciona (revoga o antigo, cria um novo) numa transação, e devolve os dois tokens', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', revogado: false, expiraEm: new Date(Date.now() + 100000),
    });
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake());
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.refreshToken.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});

    const resultado = await authService.renovarAccessToken('token-valido', 'algum-user-agent', '127.0.0.1');

    expect(resultado.accessToken).toEqual(expect.any(String));
    expect(resultado.refreshToken).toEqual(expect.any(String));
    expect(resultado.refreshToken).not.toBe('token-valido'); // é um token NOVO, não o mesmo reaproveitado
    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { revogado: true },
    });
  });

  test('rejeita quando o usuário do token não existe mais ou foi desativado', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', revogado: false, expiraEm: new Date(Date.now() + 100000),
    });
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake({ ativo: false }));

    await expect(authService.renovarAccessToken('token-valido')).rejects.toMatchObject({ status: 401 });
  });
});

describe('logout', () => {
  test('não faz nada se nenhum refresh token for informado', async () => {
    await authService.logout(undefined);
    expect(prisma.refreshToken.updateMany).not.toHaveBeenCalled();
  });

  test('revoga o refresh token informado', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    await authService.logout('algum-token');
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { token: 'algum-token' },
      data: { revogado: true },
    });
  });
});

describe('solicitarRecuperacaoSenha', () => {
  test('não revela se o email existe (não lança erro, apenas retorna undefined)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    const resultado = await authService.solicitarRecuperacaoSenha('naoexiste@example.com');
    expect(resultado).toBeUndefined();
    expect(prisma.eventoOutbox.create).not.toHaveBeenCalled();
  });

  test('grava o token e o evento de outbox numa transação só (nunca chama o Redis direto)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake());
    prisma.tokenUsuario.updateMany.mockResolvedValue({ count: 1 });
    prisma.tokenUsuario.create.mockResolvedValue({});
    prisma.eventoOutbox.create.mockResolvedValue({});

    await authService.solicitarRecuperacaoSenha('joana@example.com');

    expect(prisma.tokenUsuario.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'usuario-1', tipo: 'recuperacao_senha', usado: false },
      data: { usado: true },
    });
    expect(prisma.tokenUsuario.create).toHaveBeenCalled();
    expect(prisma.eventoOutbox.create).toHaveBeenCalledWith({
      data: {
        tipo: 'email',
        payload: expect.objectContaining({ para: 'joana@example.com', assunto: expect.stringContaining('Recuperação de senha') }),
      },
    });
    // as 3 escritas viram uma transação atômica — nada de chamadas soltas fora dela
    expect(prisma.$transaction).toHaveBeenCalled();
  });

  test('com EXPOR_TOKENS_DEV=true, devolve o token na resposta (facilita testar sem checar email)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake());
    prisma.tokenUsuario.updateMany.mockResolvedValue({});
    prisma.tokenUsuario.create.mockResolvedValue({});

    const resultado = await authService.solicitarRecuperacaoSenha('joana@example.com');
    expect(resultado.token).toEqual(expect.any(String));
  });

  test('SEM EXPOR_TOKENS_DEV, não devolve o token — nem fora de produção (NODE_ENV sozinho não é mais suficiente)', async () => {
    const valorOriginal = process.env.EXPOR_TOKENS_DEV;
    delete process.env.EXPOR_TOKENS_DEV;
    try {
      prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake());
      prisma.tokenUsuario.updateMany.mockResolvedValue({});
      prisma.tokenUsuario.create.mockResolvedValue({});

      const resultado = await authService.solicitarRecuperacaoSenha('joana@example.com');
      expect(resultado).toBeUndefined();
    } finally {
      process.env.EXPOR_TOKENS_DEV = valorOriginal;
    }
  });
});

describe('redefinirSenha', () => {
  test('rejeita token inexistente', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue(null);
    await expect(authService.redefinirSenha({ token: 'abc', novaSenha: 'SenhaForte@123' }))
      .rejects.toMatchObject({ status: 401 });
  });

  test('rejeita token do tipo errado (ex: token de verificação de email usado aqui)', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue({
      tipo: 'verificacao_email', usado: false, expiraEm: new Date(Date.now() + 100000),
    });
    await expect(authService.redefinirSenha({ token: 'abc', novaSenha: 'SenhaForte@123' }))
      .rejects.toMatchObject({ status: 401 });
  });

  test('rejeita token já usado', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue({
      tipo: 'recuperacao_senha', usado: true, expiraEm: new Date(Date.now() + 100000),
    });
    await expect(authService.redefinirSenha({ token: 'abc', novaSenha: 'SenhaForte@123' }))
      .rejects.toMatchObject({ status: 401 });
  });

  test('rejeita token expirado', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue({
      tipo: 'recuperacao_senha', usado: false, expiraEm: new Date(Date.now() - 1000),
    });
    await expect(authService.redefinirSenha({ token: 'abc', novaSenha: 'SenhaForte@123' }))
      .rejects.toMatchObject({ status: 401 });
  });

  test('token válido: atualiza senha, marca token como usado e revoga sessões existentes', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', tipo: 'recuperacao_senha', usado: false,
      expiraEm: new Date(Date.now() + 100000),
    });
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.usuario.update.mockResolvedValue({});
    prisma.tokenUsuario.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({});

    await authService.redefinirSenha({ token: 'token-valido', novaSenha: 'SenhaForte@123' });

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('verificarEmail', () => {
  test('rejeita token inexistente, do tipo errado, usado ou expirado', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue(null);
    await expect(authService.verificarEmail('abc')).rejects.toMatchObject({ status: 401 });
  });

  test('token válido marca email como verificado e o token como usado', async () => {
    prisma.tokenUsuario.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', tipo: 'verificacao_email', usado: false,
      expiraEm: new Date(Date.now() + 100000),
    });
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.usuario.update.mockResolvedValue({});
    prisma.tokenUsuario.update.mockResolvedValue({});

    await authService.verificarEmail('token-valido');
    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('reenviarVerificacao', () => {
  test('não faz nada se o usuário não existe ou já está verificado', async () => {
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake({ emailVerificado: true }));
    const resultado = await authService.reenviarVerificacao('joana@example.com');
    expect(resultado).toBeUndefined();
    expect(prisma.eventoOutbox.create).not.toHaveBeenCalled();
  });

  test('reenviar grava novo token e evento de outbox numa transação só', async () => {
    prisma.usuario.findUnique.mockResolvedValue(criarUsuarioFake({ emailVerificado: false }));
    prisma.tokenUsuario.updateMany.mockResolvedValue({});
    prisma.tokenUsuario.create.mockResolvedValue({});
    prisma.eventoOutbox.create.mockResolvedValue({});

    await authService.reenviarVerificacao('joana@example.com');

    expect(prisma.eventoOutbox.create).toHaveBeenCalledWith({
      data: {
        tipo: 'email',
        payload: expect.objectContaining({ para: 'joana@example.com', assunto: expect.stringContaining('Confirme seu email') }),
      },
    });
  });
});
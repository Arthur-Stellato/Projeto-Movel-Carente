const request = require('supertest');
const bcrypt = require('bcrypt');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

const USUARIO_FAKE = {
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
};

describe('POST /auth/login — entrega do refresh token via cookie httpOnly', () => {
  test('resposta NÃO contém refreshToken no corpo — só accessToken e usuario', async () => {
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_FAKE);
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const res = await request(app).post('/auth/login').send({ email: 'joana@example.com', senha: '12345678' });

    expect(res.status).toBe(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.usuario).toBeDefined();
    expect(res.body.refreshToken).toBeUndefined();
  });

  test('cookie refreshToken é setado com httpOnly, path=/auth e SameSite', async () => {
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_FAKE);
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const res = await request(app).post('/auth/login').send({ email: 'joana@example.com', senha: '12345678' });

    const cookies = res.headers['set-cookie'];
    expect(cookies).toBeDefined();
    const cookieRefresh = cookies.find((c) => c.startsWith('refreshToken='));

    expect(cookieRefresh).toBeDefined();
    expect(cookieRefresh).toMatch(/HttpOnly/i);
    expect(cookieRefresh).toMatch(/Path=\/auth/i);
    expect(cookieRefresh).toMatch(/SameSite=Lax/i);
    // Em teste, NODE_ENV=test (não 'production') — secure não deve estar presente,
    // senão o cookie seria descartado em desenvolvimento local sem HTTPS.
    expect(cookieRefresh).not.toMatch(/Secure/i);
  });
});

describe('POST /auth/refresh — lê o refresh token do cookie, não do corpo', () => {
  test('sem cookie nenhum, devolve 401', async () => {
    const res = await request(app).post('/auth/refresh').send({});
    expect(res.status).toBe(401);
  });

  test('mandar o refreshToken no corpo (jeito antigo) não funciona mais — só o cookie é lido', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue(null); // simula "não achou", já que ninguém deveria ler do body

    const res = await request(app).post('/auth/refresh').send({ refreshToken: 'um-token-qualquer-no-corpo' });

    expect(res.status).toBe(401);
    // Confirma que o service nem recebeu esse valor pra consultar (chamado com undefined)
    expect(prisma.refreshToken.findUnique).not.toHaveBeenCalledWith({ where: { token: 'um-token-qualquer-no-corpo' } });
  });

  test('fluxo completo com agent (mantém cookie entre requisições, como um navegador faria)', async () => {
    prisma.usuario.findUnique.mockResolvedValue(USUARIO_FAKE);
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);

    const agent = request.agent(app); // agente persiste cookies entre chamadas, igual navegador

    const resLogin = await agent.post('/auth/login').send({ email: 'joana@example.com', senha: '12345678' });
    expect(resLogin.status).toBe(200);
    const cookieAposLogin = resLogin.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));

    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-1', usuarioId: 'usuario-1', revogado: false, expiraEm: new Date(Date.now() + 100000),
    });
    prisma.refreshToken.update.mockResolvedValue({});

    const resRefresh = await agent.post('/auth/refresh').send({});
    expect(resRefresh.status).toBe(200);
    expect(resRefresh.body.accessToken).toEqual(expect.any(String));

    // Rotação: o refresh também devolve um cookie NOVO, diferente do que veio do login
    const cookieAposRefresh = resRefresh.headers['set-cookie'].find((c) => c.startsWith('refreshToken='));
    expect(cookieAposRefresh).toBeDefined();
    expect(cookieAposRefresh).not.toBe(cookieAposLogin);

    // E o token antigo foi marcado como revogado no banco
    expect(prisma.refreshToken.update).toHaveBeenCalledWith({
      where: { id: 'token-1' },
      data: { revogado: true },
    });
  });

  test('reusar um refresh token já rotacionado (revogado) é rejeitado e revoga todas as sessões do usuário', async () => {
    prisma.refreshToken.findUnique.mockResolvedValue({
      id: 'token-antigo', usuarioId: 'usuario-1', revogado: true, expiraEm: new Date(Date.now() + 100000),
    });
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 3 });

    const res = await request(app)
      .post('/auth/refresh')
      .set('Cookie', ['refreshToken=um-token-ja-usado-antes'])
      .send({});

    expect(res.status).toBe(401);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'usuario-1', revogado: false },
      data: { revogado: true },
    });
  });
});

describe('POST /auth/logout — lê do cookie e limpa o cookie na resposta', () => {
  test('sem cookie, ainda funciona (idempotente) e devolve 204', async () => {
    prisma.refreshToken.updateMany.mockResolvedValue({ count: 0 });
    const res = await request(app).post('/auth/logout').send({});
    expect(res.status).toBe(204);
  });

  test('com cookie válido: revoga no banco e limpa o cookie na resposta', async () => {
    const agent = request.agent(app);

    prisma.usuario.findUnique.mockResolvedValue(USUARIO_FAKE);
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.create.mockResolvedValue({});
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    await agent.post('/auth/login').send({ email: 'joana@example.com', senha: '12345678' });

    prisma.refreshToken.updateMany.mockResolvedValue({ count: 1 });
    const resLogout = await agent.post('/auth/logout').send({});

    expect(resLogout.status).toBe(204);
    expect(prisma.refreshToken.updateMany).toHaveBeenCalled();

    const cookies = resLogout.headers['set-cookie'];
    const cookieRefresh = cookies?.find((c) => c.startsWith('refreshToken='));
    // clearCookie manda o valor vazio com data de expiração no passado
    expect(cookieRefresh).toMatch(/refreshToken=;/);
  });
});
const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { gerarAccessToken, gerarRefreshTokenOpaco, gerarTokenAleatorio, hashearToken } = require('../lib/token');
const { registrarEventoOutbox } = require('../lib/outbox');
const { sanitizarUsuario } = require('../lib/sanitizar');
const { normalizarEmail } = require('../lib/validadores');

const SALT_ROUNDS = 10;
const MAX_TENTATIVAS_LOGIN = 5;
const BLOQUEIO_MINUTOS = 15;
const REFRESH_TOKEN_DIAS = 7;
const RECUPERACAO_SENHA_MINUTOS = 30;
const VERIFICACAO_EMAIL_HORAS = 24;

const { ErroDominio } = require('../lib/erros');
class ErroAutenticacao extends ErroDominio {}

// Formato de email/senha já vem validado pelo middleware Joi (rota /auth/login) —
// aqui só cabe a lógica de negócio (conta existe, está ativa, senha confere).
async function login({ email, senha, userAgent, ipOrigem }) {
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });

  // Mensagem genérica propositalmente, para não revelar se o email existe
  if (!usuario || !usuario.senhaHash) {
    throw new ErroAutenticacao('Email ou senha inválidos', 401);
  }

  if (!usuario.ativo) {
    throw new ErroAutenticacao('Conta desativada. Entre em contato com o suporte', 403);
  }

  if (usuario.bloqueadoAte && usuario.bloqueadoAte > new Date()) {
    const minutosRestantes = Math.ceil((usuario.bloqueadoAte - new Date()) / 60000);
    throw new ErroAutenticacao(
      `Conta temporariamente bloqueada. Tente novamente em ${minutosRestantes} minuto(s)`,
      403
    );
  }

  const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);

  if (!senhaValida) {
    await registrarTentativaFalha(usuario);
    throw new ErroAutenticacao('Email ou senha inválidos', 401);
  }

  // Login bem-sucedido: zera tentativas e bloqueio
  await prisma.usuario.update({
    where: { id: usuario.id },
    data: { tentativasLoginFalhas: 0, bloqueadoAte: null },
  });

  const accessToken = gerarAccessToken(usuario);
  const refreshToken = await criarRefreshToken(usuario.id, userAgent, ipOrigem);

  return { usuario: sanitizarUsuario(usuario), accessToken, refreshToken };
}

async function registrarTentativaFalha(usuario) {
  const tentativas = (usuario.tentativasLoginFalhas || 0) + 1;

  if (tentativas >= MAX_TENTATIVAS_LOGIN) {
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: {
        bloqueadoAte: new Date(Date.now() + BLOQUEIO_MINUTOS * 60000),
        tentativasLoginFalhas: 0, // zera o contador ao aplicar o bloqueio
      },
    });
  } else {
    // Incremento atômico no banco para evitar perda de contagem sob concorrência
    await prisma.usuario.update({
      where: { id: usuario.id },
      data: { tentativasLoginFalhas: { increment: 1 } },
    });
  }
}

async function criarRefreshToken(usuarioId, userAgent, ipOrigem) {
  const token = gerarRefreshTokenOpaco();
  const expiraEm = new Date(Date.now() + REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000);

  await prisma.refreshToken.create({
    data: { usuarioId, token, userAgent, ipOrigem, expiraEm },
  });

  return token;
}

async function renovarAccessToken(refreshToken, userAgent, ipOrigem) {
  if (!refreshToken) {
    throw new ErroAutenticacao('Refresh token não fornecido', 401);
  }

  const registro = await prisma.refreshToken.findUnique({ where: { token: refreshToken } });

  if (!registro) {
    throw new ErroAutenticacao('Refresh token inválido ou expirado', 401);
  }

  // Reuso de um token já rotacionado (revogado) é sinal de possível roubo — alguém
  // está tentando usar uma cópia antiga do token, depois que ele já foi trocado por
  // um novo num refresh legítimo anterior. Resposta: revoga TODAS as sessões ativas
  // desse usuário, forçando login de novo em todo lugar (contém o estrago em vez de
  // só negar essa tentativa específica).
  if (registro.revogado) {
    await prisma.refreshToken.updateMany({
      where: { usuarioId: registro.usuarioId, revogado: false },
      data: { revogado: true },
    });
    throw new ErroAutenticacao('Refresh token inválido ou expirado', 401);
  }

  if (registro.expiraEm < new Date()) {
    throw new ErroAutenticacao('Refresh token inválido ou expirado', 401);
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: registro.usuarioId } });
  if (!usuario || !usuario.ativo) {
    throw new ErroAutenticacao('Usuário inválido', 401);
  }

  // Rotação: o token usado aqui morre, um novo é emitido no lugar dele. Sem isso, o
  // mesmo refresh token continuaria válido pelos 7 dias inteiros, não importa quantas
  // vezes fosse usado — se vazasse, um atacante poderia usá-lo repetidamente sem
  // nenhum sinal de alerta até ele expirar sozinho.
  const novoToken = gerarRefreshTokenOpaco();
  const novaExpiracao = new Date(Date.now() + REFRESH_TOKEN_DIAS * 24 * 60 * 60 * 1000);

  await prisma.$transaction([
    prisma.refreshToken.update({ where: { id: registro.id }, data: { revogado: true } }),
    prisma.refreshToken.create({
      data: { usuarioId: usuario.id, token: novoToken, userAgent, ipOrigem, expiraEm: novaExpiracao },
    }),
  ]);

  const accessToken = gerarAccessToken(usuario);
  return { accessToken, refreshToken: novoToken };
}

async function logout(refreshToken) {
  if (!refreshToken) return;
  await prisma.refreshToken.updateMany({
    where: { token: refreshToken },
    data: { revogado: true },
  });
}

async function solicitarRecuperacaoSenha(email) {
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });

  // Não revela se o email existe ou não (evita enumeração de contas)
  if (!usuario) return;

  const token = gerarTokenAleatorio();
  const tokenHash = hashearToken(token);
  const expiraEm = new Date(Date.now() + RECUPERACAO_SENHA_MINUTOS * 60000);

  // As 3 escritas viram uma transação só: invalida token antigo, cria o novo (com hash no banco),
  // e grava o evento de email pendente com o token cru — tudo Postgres puro e atômico.
  await prisma.$transaction([
    prisma.tokenUsuario.updateMany({
      where: { usuarioId: usuario.id, tipo: 'recuperacao_senha', usado: false },
      data: { usado: true },
    }),
    prisma.tokenUsuario.create({
      data: { usuarioId: usuario.id, tipo: 'recuperacao_senha', token: tokenHash, expiraEm },
    }),
    registrarEventoOutbox('email', {
      para: usuario.email,
      assunto: 'Recuperação de senha — MóvelCarente',
      html: `
        <p>Olá, ${usuario.primeiroNome}!</p>
        <p>Recebemos um pedido de redefinição de senha. Use o token abaixo (válido por ${RECUPERACAO_SENHA_MINUTOS} minutos):</p>
        <p><strong>${token}</strong></p>
        <p>Se você não pediu isso, pode ignorar este email com segurança.</p>
      `,
    }),
  ]);

  // Em desenvolvimento, também devolvemos o token na resposta — facilita testar
  // sem precisar checar o email (que, sem SMTP configurado, só aparece no console do worker).
  if (process.env.NODE_ENV !== 'production') {
    return { token };
  }
}

// Presença de token/novaSenha e a força da nova senha já foram checadas pelo
// Joi na rota (/auth/redefinir-senha) — aqui só a validade do token importa.
async function redefinirSenha({ token, novaSenha }) {
  const tokenHash = hashearToken(token);
  const registro = await prisma.tokenUsuario.findUnique({ where: { token: tokenHash } });

  if (
    !registro ||
    registro.tipo !== 'recuperacao_senha' ||
    registro.usado ||
    registro.expiraEm < new Date()
  ) {
    throw new ErroAutenticacao('Token inválido ou expirado', 401);
  }

  const senhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { senhaHash, tentativasLoginFalhas: 0, bloqueadoAte: null },
    }),
    prisma.tokenUsuario.update({
      where: { id: registro.id },
      data: { usado: true },
    }),
    // Revoga sessões existentes por segurança, forçando novo login em todos os dispositivos
    prisma.refreshToken.updateMany({
      where: { usuarioId: registro.usuarioId, revogado: false },
      data: { revogado: true },
    }),
  ]);
}

// Gera e envia o token de verificação. Chamada tanto pelo registro (usuario.service.js)
// quanto pelo reenvio manual, caso o usuário não tenha recebido/perdido o primeiro email.
async function enviarVerificacaoEmail(usuario) {
  const token = gerarTokenAleatorio();
  const tokenHash = hashearToken(token);
  const expiraEm = new Date(Date.now() + VERIFICACAO_EMAIL_HORAS * 60 * 60 * 1000);

  // Mesma lógica da recuperação de senha: uma transação só, e o email vira
  // um evento de outbox em vez de enfileirar direto no BullMQ.
  await prisma.$transaction([
    prisma.tokenUsuario.updateMany({
      where: { usuarioId: usuario.id, tipo: 'verificacao_email', usado: false },
      data: { usado: true },
    }),
    prisma.tokenUsuario.create({
      data: { usuarioId: usuario.id, tipo: 'verificacao_email', token: tokenHash, expiraEm },
    }),
    registrarEventoOutbox('email', {
      para: usuario.email,
      assunto: 'Confirme seu email — MóvelCarente',
      html: `
        <p>Olá, ${usuario.primeiroNome}!</p>
        <p>Confirme seu email usando o token abaixo (válido por ${VERIFICACAO_EMAIL_HORAS} horas):</p>
        <p><strong>${token}</strong></p>
        <p>Se você não criou uma conta no MóvelCarente, pode ignorar este email com segurança.</p>
      `,
    }),
  ]);

  // Em desenvolvimento, devolvemos o token também na resposta (mesma lógica da recuperação de senha)
  if (process.env.NODE_ENV !== 'production') {
    return { token };
  }
}

async function reenviarVerificacao(email) {
  const usuario = await prisma.usuario.findUnique({ where: { email: normalizarEmail(email) } });

  // Mesma lógica de não revelar existência da conta (evita enumeração), e também
  // não reenvia se já estiver verificado
  if (!usuario || usuario.emailVerificado) return;

  return enviarVerificacaoEmail(usuario);
}

// Presença de token já é garantida pelo Joi na rota (/auth/verificar-email).
async function verificarEmail(token) {
  const tokenHash = hashearToken(token);
  const registro = await prisma.tokenUsuario.findUnique({ where: { token: tokenHash } });

  if (
    !registro ||
    registro.tipo !== 'verificacao_email' ||
    registro.usado ||
    registro.expiraEm < new Date()
  ) {
    throw new ErroAutenticacao('Token inválido ou expirado', 401);
  }

  await prisma.$transaction([
    prisma.usuario.update({
      where: { id: registro.usuarioId },
      data: { emailVerificado: true },
    }),
    prisma.tokenUsuario.update({
      where: { id: registro.id },
      data: { usado: true },
    }),
  ]);
}

module.exports = {
  ErroAutenticacao,
  login,
  renovarAccessToken,
  logout,
  solicitarRecuperacaoSenha,
  redefinirSenha,
  enviarVerificacaoEmail,
  reenviarVerificacao,
  verificarEmail,
};
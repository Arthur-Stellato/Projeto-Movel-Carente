const jwt = require('jsonwebtoken');
const prisma = require('../lib/prisma');

// Fixa o algoritmo aceito na verificação, em vez de deixar o jsonwebtoken inferir
// sozinho a partir do header do token. Não corrige uma vulnerabilidade ativa (a lib já
// bloqueia o ataque clássico de "alg: none" há anos), mas é defesa em profundidade —
// deixa explícito que só HS256 é aceito, sem depender do comportamento padrão da lib.
const ALGORITMOS_JWT_ACEITOS = ['HS256'];

function autenticar(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ erro: 'Token de acesso não fornecido' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ALGORITMOS_JWT_ACEITOS });
    req.usuario = { id: payload.sub, tipo: payload.tipo };
    return next();
  } catch (err) {
    return res.status(401).json({ erro: 'Token de acesso inválido ou expirado' });
  }
}

// Para rotas públicas que se comportam diferente quando o usuário está logado
// (ex: listagem de categorias mostra inativas só pro admin). Nunca bloqueia a requisição.
function autenticarOpcional(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ALGORITMOS_JWT_ACEITOS });
    req.usuario = { id: payload.sub, tipo: payload.tipo };
  } catch (err) {
    // Token inválido numa rota opcional: ignora e segue como visitante anônimo
  }

  return next();
}

function apenasAdmin(req, res, next) {
  if (req.usuario?.tipo !== 'admin') {
    return res.status(403).json({ erro: 'Acesso restrito a administradores' });
  }
  return next();
}

// Para ações que exigem confirmar contato real (anunciar, solicitar, conversar,
// avaliar) — mas sem bloquear o login em si. Consulta o banco em vez de confiar
// numa claim do JWT: emailVerificado é lido aqui sempre fresco, então não existe
// janela de atraso nem dependência de o campo nunca mudar de novo pra false no
// futuro (ver decisão em auth.service.js#login).
async function exigirEmailVerificado(req, res, next) {
  const usuario = await prisma.usuario.findUnique({
    where: { id: req.usuario.id },
    select: { emailVerificado: true },
  });

  if (!usuario?.emailVerificado) {
    return res.status(403).json({
      erro: 'Confirme seu email antes de continuar. Verifique sua caixa de entrada ou peça um novo link de verificação.',
      codigo: 'EMAIL_NAO_VERIFICADO',
    });
  }

  return next();
}

module.exports = { autenticar, autenticarOpcional, apenasAdmin, exigirEmailVerificado };
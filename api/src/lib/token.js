const jwt = require('jsonwebtoken');
const crypto = require('crypto');

function gerarAccessToken(usuario) {
  return jwt.sign(
    { sub: usuario.id, tipo: usuario.tipo },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
}

function gerarRefreshTokenOpaco() {
  // Token opaco (não-JWT) para refresh: mais simples de revogar, guardado no banco.
  return crypto.randomBytes(48).toString('hex');
}

function gerarTokenAleatorio() {
  // Usado para recuperação de senha / verificação de email
  return crypto.randomBytes(32).toString('hex');
}

function hashearToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { gerarAccessToken, gerarRefreshTokenOpaco, gerarTokenAleatorio, hashearToken };

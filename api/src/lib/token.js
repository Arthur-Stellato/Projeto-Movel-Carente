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
  // Gera um número inteiro seguro entre 0 e 999999
  const max = 1000000;
  const randomNumber = crypto.randomInt(0, max);

  // Converte para string e preenche com zeros à esquerda se necessário (ex: 5 vira "000005")
  return randomNumber.toString().padStart(6, '0');
}

function hashearToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports = { gerarAccessToken, gerarRefreshTokenOpaco, gerarTokenAleatorio, hashearToken };

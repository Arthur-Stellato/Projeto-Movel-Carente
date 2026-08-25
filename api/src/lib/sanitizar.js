function sanitizarUsuario(usuario) {
  const { senhaHash, ...resto } = usuario;
  return resto;
}

module.exports = { sanitizarUsuario };
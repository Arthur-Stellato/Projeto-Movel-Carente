const authService = require('../services/auth.service');
const usuarioService = require('../services/usuario.service');
const { definirCookieRefreshToken, limparCookieRefreshToken } = require('../lib/cookies');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function registrar(req, res) {
  try {
    const usuario = await usuarioService.registrar(req.body);
    return res.status(201).json({ usuario });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function login(req, res) {
  try {
    const { email, senha } = req.body;
    const resultado = await authService.login({
      email,
      senha,
      userAgent: req.headers['user-agent'],
      ipOrigem: req.ip,
    });
    definirCookieRefreshToken(res, resultado.refreshToken);
    // O refreshToken NÃO vai no corpo — só existe no cookie httpOnly, inacessível a JS.
    return res.status(200).json({ accessToken: resultado.accessToken, usuario: resultado.usuario });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function refresh(req, res) {
  try {
    const refreshTokenAtual = req.cookies?.refreshToken;
    const resultado = await authService.renovarAccessToken(
      refreshTokenAtual,
      req.headers['user-agent'],
      req.ip
    );
    // Rotação: o cookie é atualizado com o novo refresh token a cada chamada —
    // o antigo já foi revogado dentro de renovarAccessToken.
    definirCookieRefreshToken(res, resultado.refreshToken);
    return res.status(200).json({ accessToken: resultado.accessToken });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function logout(req, res) {
  try {
    const refreshToken = req.cookies?.refreshToken;
    await authService.logout(refreshToken);
    limparCookieRefreshToken(res);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function esqueciSenha(req, res) {
  try {
    const { email } = req.body;
    const resultado = await authService.solicitarRecuperacaoSenha(email);
    // Resposta genérica sempre, independente de o email existir (evita enumeração)
    return res.status(200).json({
      mensagem: 'Se o email existir, enviaremos instruções de recuperação',
      ...(resultado || {}), // em dev, inclui o token pra facilitar teste manual
    });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function redefinirSenha(req, res) {
  try {
    const { token, novaSenha } = req.body;
    await authService.redefinirSenha({ token, novaSenha });
    return res.status(200).json({ mensagem: 'Senha redefinida com sucesso' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function reenviarVerificacao(req, res) {
  try {
    const { email } = req.body;
    const resultado = await authService.reenviarVerificacao(email);
    // Mesma resposta genérica, sempre — não revela se o email existe nem se já foi verificado
    return res.status(200).json({
      mensagem: 'Se o email existir e ainda não estiver verificado, enviaremos um novo link',
      ...(resultado || {}), // em dev, inclui o token pra facilitar teste manual
    });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function verificarEmail(req, res) {
  try {
    const { token } = req.body;
    await authService.verificarEmail(token);
    return res.status(200).json({ mensagem: 'Email verificado com sucesso' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { registrar, login, refresh, logout, esqueciSenha, redefinirSenha, reenviarVerificacao, verificarEmail };
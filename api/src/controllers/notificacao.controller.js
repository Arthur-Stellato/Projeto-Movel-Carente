const notificacaoService = require('../services/notificacao.service');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function listar(req, res) {
  try {
    const { apenasNaoLidas, pagina, tamanho } = req.query;
    const resultado = await notificacaoService.listar(req.usuario.id, { apenasNaoLidas, pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function contarNaoLidas(req, res) {
  try {
    const resultado = await notificacaoService.contarNaoLidas(req.usuario.id);
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function marcarComoLida(req, res) {
  try {
    const notificacao = await notificacaoService.marcarComoLida(req.params.id, req.usuario.id);
    return res.status(200).json({ notificacao });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function marcarTodasComoLidas(req, res) {
  try {
    await notificacaoService.marcarTodasComoLidas(req.usuario.id);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function remover(req, res) {
  try {
    await notificacaoService.remover(req.params.id, req.usuario.id);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { listar, contarNaoLidas, marcarComoLida, marcarTodasComoLidas, remover };
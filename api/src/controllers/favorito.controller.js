const favoritoService = require('../services/favorito.service');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function adicionar(req, res) {
  try {
    const { itemId } = req.body;
    const favorito = await favoritoService.adicionar(req.usuario.id, itemId);
    return res.status(201).json({ favorito });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function remover(req, res) {
  try {
    await favoritoService.remover(req.usuario.id, req.params.itemId);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listar(req, res) {
  try {
    const { pagina, tamanho } = req.query;
    const resultado = await favoritoService.listar(req.usuario.id, { pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function verificar(req, res) {
  try {
    const favoritado = await favoritoService.verificar(req.usuario.id, req.params.itemId);
    return res.status(200).json({ favoritado });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { adicionar, remover, listar, verificar };
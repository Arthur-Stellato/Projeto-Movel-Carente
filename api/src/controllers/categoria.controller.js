const categoriaService = require('../services/categoria.service');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function listar(req, res) {
  try {
    // Só admin pode ver categorias inativas (ex: pra reativar uma depois)
    const incluirInativas = req.usuario?.tipo === 'admin' && req.query.todas === 'true';
    const categorias = await categoriaService.listar({ incluirInativas });
    return res.status(200).json({ categorias });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function buscarPorId(req, res) {
  try {
    const incluirInativas = req.usuario?.tipo === 'admin';
    const categoria = await categoriaService.buscarPorId(req.params.id, { incluirInativas });
    return res.status(200).json({ categoria });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function criar(req, res) {
  try {
    const categoria = await categoriaService.criar(req.body);
    return res.status(201).json({ categoria });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function atualizar(req, res) {
  try {
    const categoria = await categoriaService.atualizar(req.params.id, req.body);
    return res.status(200).json({ categoria });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function desativar(req, res) {
  try {
    await categoriaService.desativar(req.params.id);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { listar, buscarPorId, criar, atualizar, desativar };
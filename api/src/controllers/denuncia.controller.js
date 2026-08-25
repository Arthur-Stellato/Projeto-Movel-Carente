const denunciaService = require('../services/denuncia.service');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function criar(req, res) {
  try {
    const denuncia = await denunciaService.criar(req.usuario.id, req.body);
    return res.status(201).json({ denuncia });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarMinhas(req, res) {
  try {
    const { pagina, tamanho } = req.query;
    const resultado = await denunciaService.listarMinhas(req.usuario.id, { pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarTodas(req, res) {
  try {
    const { status, tipo, pagina, tamanho } = req.query;
    const resultado = await denunciaService.listarTodas({ status, tipo, pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function buscarPorId(req, res) {
  try {
    const denuncia = await denunciaService.buscarPorId(req.params.id);
    return res.status(200).json({ denuncia });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function analisar(req, res) {
  try {
    const { status, desativarItem, desativarUsuario } = req.body;
    const denuncia = await denunciaService.analisar(req.params.id, req.usuario.id, { status, desativarItem, desativarUsuario });
    return res.status(200).json({ denuncia });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { criar, listarMinhas, listarTodas, buscarPorId, analisar };
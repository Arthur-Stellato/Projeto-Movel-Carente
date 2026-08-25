const avaliacaoService = require('../services/avaliacao.service');
const { tratarErroController: tratarErro } = require('../lib/erros');

async function criar(req, res) {
  try {
    const avaliacao = await avaliacaoService.criar(req.usuario.id, req.params.id, req.body);
    return res.status(201).json({ avaliacao });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarPorSolicitacao(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    const resultado = await avaliacaoService.listarPorSolicitacao(req.params.id, req.usuario.id, ehAdmin);
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarRecebidas(req, res) {
  try {
    const { pagina, tamanho } = req.query;
    const resultado = await avaliacaoService.listarRecebidas(req.params.id, { pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { criar, listarPorSolicitacao, listarRecebidas };

const solicitacaoService = require('../services/solicitacao.service');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function criar(req, res) {
  try {
    const { itemId, mensagem } = req.body;
    const solicitacao = await solicitacaoService.criar(req.usuario.id, itemId, mensagem);
    return res.status(201).json({ solicitacao });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarPorItem(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    const { pagina, tamanho } = req.query;
    const resultado = await solicitacaoService.listarPorItem(req.params.itemId, req.usuario.id, ehAdmin, { pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function minhasSolicitacoes(req, res) {
  try {
    const { pagina, tamanho } = req.query;
    const resultado = await solicitacaoService.minhasSolicitacoes(req.usuario.id, { pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function aceitar(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    await solicitacaoService.aceitar(req.params.id, req.usuario.id, ehAdmin);
    return res.status(200).json({ mensagem: 'Solicitação aceita' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function recusar(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    await solicitacaoService.recusar(req.params.id, req.usuario.id, ehAdmin);
    return res.status(200).json({ mensagem: 'Solicitação recusada' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function cancelar(req, res) {
  try {
    await solicitacaoService.cancelar(req.params.id, req.usuario.id);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function concluir(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    await solicitacaoService.concluir(req.params.id, req.usuario.id, ehAdmin);
    return res.status(200).json({ mensagem: 'Doação concluída com sucesso' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { criar, listarPorItem, minhasSolicitacoes, aceitar, recusar, cancelar, concluir };
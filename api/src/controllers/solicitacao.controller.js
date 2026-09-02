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

const mensagemService = require('../services/mensagem.service');

async function listarMensagens(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    const resultado = await mensagemService.listarMensagens(req.params.id, req.usuario.id, ehAdmin, {
      limite: req.query.limite,
      antesDe: req.query.antesDe,
    });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function enviarMensagem(req, res) {
  try {
    const resultado = await mensagemService.enviarMensagem(req.params.id, req.usuario.id, req.body);
    return res.status(201).json({ mensagem: resultado });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function editarMensagem(req, res) {
  try {
    const resultado = await mensagemService.editarMensagem(req.params.id, req.params.mensagemId, req.usuario.id, req.body.conteudo);
    return res.status(200).json({ mensagem: resultado });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function deletarMensagem(req, res) {
  try {
    const resultado = await mensagemService.deletarMensagem(req.params.id, req.params.mensagemId, req.usuario.id);
    return res.status(200).json({ mensagem: resultado });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = {
  criar,
  listarPorItem,
  minhasSolicitacoes,
  aceitar,
  recusar,
  cancelar,
  concluir,
  listarMensagens,
  enviarMensagem,
  editarMensagem,
  deletarMensagem,
};

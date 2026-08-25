const usuarioService = require('../services/usuario.service');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function buscarPerfil(req, res) {
  try {
    const usuario = await usuarioService.buscarPerfil(req.usuario.id);
    return res.status(200).json({ usuario });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function atualizarPerfil(req, res) {
  try {
    const usuario = await usuarioService.atualizarPerfil(req.usuario.id, req.body);
    return res.status(200).json({ usuario });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function alterarSenha(req, res) {
  try {
    await usuarioService.alterarSenha(req.usuario.id, req.body);
    return res.status(200).json({ mensagem: 'Senha alterada com sucesso' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarEnderecos(req, res) {
  try {
    const enderecos = await usuarioService.listarEnderecos(req.usuario.id);
    return res.status(200).json({ enderecos });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function criarEndereco(req, res) {
  try {
    const endereco = await usuarioService.criarEndereco(req.usuario.id, req.body);
    return res.status(201).json({ endereco });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function atualizarEndereco(req, res) {
  try {
    const endereco = await usuarioService.atualizarEndereco(req.params.id, req.usuario.id, req.body);
    return res.status(200).json({ endereco });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function removerEndereco(req, res) {
  try {
    await usuarioService.removerEndereco(req.params.id, req.usuario.id);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function listarTodos(req, res) {
  try {
    const { ativo, tipo, pagina, tamanho } = req.query;
    const resultado = await usuarioService.listarTodos({ ativo, tipo, pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function desativarConta(req, res) {
  try {
    await usuarioService.desativarConta(req.params.id, req.usuario.id);
    return res.status(200).json({ mensagem: 'Conta desativada com sucesso' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function reativarConta(req, res) {
  try {
    await usuarioService.reativarConta(req.params.id, req.usuario.id);
    return res.status(200).json({ mensagem: 'Conta reativada com sucesso' });
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = {
  buscarPerfil,
  atualizarPerfil,
  alterarSenha,
  listarEnderecos,
  criarEndereco,
  atualizarEndereco,
  removerEndereco,
  listarTodos,
  desativarConta,
  reativarConta,
};
const itemService = require('../services/item.service');
const { removerArquivoFisico } = require('../lib/uploads');

const { tratarErroController: tratarErro } = require('../lib/erros');

async function listar(req, res) {
  try {
    const { categoriaId, cidade, estado, busca, lat, lng, raioKm, pagina, tamanho } = req.query;
    const resultado = await itemService.listar({ categoriaId, cidade, estado, busca, lat, lng, raioKm, pagina, tamanho });
    return res.status(200).json(resultado);
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function meusItens(req, res) {
  try {
    const itens = await itemService.meusItens(req.usuario.id);
    return res.status(200).json({ itens });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function buscarPorId(req, res) {
  try {
    const item = await itemService.buscarPorId(req.params.id, req.usuario?.id ?? null);
    return res.status(200).json({ item });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function criar(req, res) {
  try {
    const item = await itemService.criar(req.usuario.id, req.body);
    return res.status(201).json({ item });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function atualizar(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    const item = await itemService.atualizar(req.params.id, req.usuario.id, ehAdmin, req.body);
    return res.status(200).json({ item });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function cancelar(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    await itemService.cancelar(req.params.id, req.usuario.id, ehAdmin);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function adicionarImagens(req, res) {
  try {
    const { urls } = req.body;
    const ehAdmin = req.usuario.tipo === 'admin';
    const imagens = await itemService.adicionarImagens(req.params.id, req.usuario.id, ehAdmin, urls);
    return res.status(201).json({ imagens });
  } catch (err) {
    return tratarErro(err, res);
  }
}

async function uploadImagens(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    const imagens = await itemService.adicionarImagensUpload(req.params.id, req.usuario.id, ehAdmin, req.files);
    return res.status(201).json({ imagens });
  } catch (err) {
    // O multer já gravou os arquivos em disco ANTES desse controller rodar — se a
    // validação falhar aqui por qualquer motivo (item de outro usuário sem ser admin,
    // status errado, limite excedido...), os arquivos ficam órfãos se ninguém os apagar.
    if (req.files?.length) {
      await Promise.all(req.files.map((arquivo) => removerArquivoFisico(arquivo.filename)));
    }
    return tratarErro(err, res);
  }
}

async function removerImagem(req, res) {
  try {
    const ehAdmin = req.usuario.tipo === 'admin';
    await itemService.removerImagem(req.params.id, req.params.imagemId, req.usuario.id, ehAdmin);
    return res.status(204).send();
  } catch (err) {
    return tratarErro(err, res);
  }
}

module.exports = { listar, meusItens, buscarPorId, criar, atualizar, cancelar, adicionarImagens, uploadImagens, removerImagem };
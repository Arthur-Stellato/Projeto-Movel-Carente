const mensagemService = require('../services/mensagem.service');
const { PREFIXO_URL_UPLOADS_MENSAGENS, removerArquivoFisicoMensagem } = require('../lib/uploads');
const { tipoAnexo } = require('../middlewares/uploadMensagem.middleware');
const { tratarErroController: tratarErro } = require('../lib/erros');

async function enviarAnexo(req, res) {
  try {
    if (!req.file) {
      return res.status(400).json({ erro: 'Nenhum arquivo enviado' });
    }

    await mensagemService.validarAcessoParaAnexo(req.params.id, req.usuario.id);
    return res.status(201).json({
      url: `${PREFIXO_URL_UPLOADS_MENSAGENS}${req.file.filename}`,
      tipo: tipoAnexo(req.file.mimetype),
    });
  } catch (err) {
    if (req.file) await removerArquivoFisicoMensagem(req.file.filename);
    return tratarErro(err, res);
  }
}

module.exports = { enviarAnexo };

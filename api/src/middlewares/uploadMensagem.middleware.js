const multer = require('multer');
const crypto = require('crypto');
const logger = require('../lib/logger');
const { DIRETORIO_UPLOADS_MENSAGENS, removerArquivoFisicoMensagem } = require('../lib/uploads');

const TIPOS_IMAGEM = new Set(['image/jpeg', 'image/png', 'image/webp']);
const TIPOS_VIDEO = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const EXTENSOES_POR_MIMETYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'video/mp4': '.mp4',
  'video/webm': '.webm',
  'video/quicktime': '.mov',
};
const LIMITE_IMAGEM = 5 * 1024 * 1024;
const LIMITE_VIDEO = 50 * 1024 * 1024;

function tipoAnexo(mimetype) {
  if (TIPOS_IMAGEM.has(mimetype)) return 'imagem';
  if (TIPOS_VIDEO.has(mimetype)) return 'video';
  return null;
}

const armazenamento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIRETORIO_UPLOADS_MENSAGENS),
  filename: (req, file, cb) => cb(null, `${crypto.randomUUID()}${EXTENSOES_POR_MIMETYPE[file.mimetype]}`),
});

function filtrarTipoDeArquivo(req, file, cb) {
  if (!tipoAnexo(file.mimetype)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Tipo de anexo não permitido'));
  }
  return cb(null, true);
}

const upload = multer({
  storage: armazenamento,
  fileFilter: filtrarTipoDeArquivo,
  // O teto geral é o de vídeo; imagens são verificadas abaixo depois de gravar.
  limits: { fileSize: LIMITE_VIDEO, files: 1 },
});

const MENSAGENS_ERRO_MULTER = {
  LIMIT_FILE_SIZE: 'O vídeo excede o limite de 50MB',
  LIMIT_FILE_COUNT: 'Envie apenas um arquivo por vez',
  LIMIT_UNEXPECTED_FILE: 'Apenas imagens JPEG, PNG ou WebP e vídeos MP4, WebM ou MOV são permitidos',
};

function uploadAnexoMensagem(req, res, next) {
  upload.single('arquivo')(req, res, async (err) => {
    if (err instanceof multer.MulterError) {
      if (req.file) await removerArquivoFisicoMensagem(req.file.filename);
      return res.status(400).json({ erro: MENSAGENS_ERRO_MULTER[err.code] || err.message });
    }
    if (err) {
      logger.error({ err }, 'Erro inesperado no upload de anexo de mensagem');
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }

    // O Multer aceita até 50MB para atender vídeos; imagens têm o teto menor.
    if (req.file && tipoAnexo(req.file.mimetype) === 'imagem' && req.file.size > LIMITE_IMAGEM) {
      await removerArquivoFisicoMensagem(req.file.filename);
      return res.status(400).json({ erro: 'A imagem excede o limite de 5MB' });
    }
    return next();
  });
}

module.exports = { uploadAnexoMensagem, tipoAnexo };

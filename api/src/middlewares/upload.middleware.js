const multer = require('multer');
const crypto = require('crypto');
const path = require('path');
const logger = require('../lib/logger');
const { DIRETORIO_UPLOADS_ITENS } = require('../lib/uploads');

const TIPOS_PERMITIDOS = new Set(['image/jpeg', 'image/png', 'image/webp']);
const EXTENSOES_POR_MIMETYPE = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};
const TAMANHO_MAXIMO_BYTES = 5 * 1024 * 1024; // 5MB por imagem
const MAX_ARQUIVOS_POR_ENVIO = 10; // mesmo teto de MAX_IMAGENS_POR_ITEM em item.service.js

const armazenamento = multer.diskStorage({
  destination: (req, file, cb) => cb(null, DIRETORIO_UPLOADS_ITENS),
  filename: (req, file, cb) => {
    // Extensão fixada a partir do MIME type validado — NUNCA do originalname do cliente,
    // o que previne upload de extensões executáveis (.html, .svg, .php etc).
    const extensao = EXTENSOES_POR_MIMETYPE[file.mimetype] || '.jpg';
    cb(null, `${crypto.randomUUID()}${extensao}`);
  },
});

function filtrarTipoDeArquivo(req, file, cb) {
  if (!TIPOS_PERMITIDOS.has(file.mimetype)) {
    return cb(new multer.MulterError('LIMIT_UNEXPECTED_FILE', 'Apenas imagens JPEG, PNG ou WebP são permitidas'));
  }
  return cb(null, true);
}

const upload = multer({
  storage: armazenamento,
  fileFilter: filtrarTipoDeArquivo,
  limits: { fileSize: TAMANHO_MAXIMO_BYTES, files: MAX_ARQUIVOS_POR_ENVIO },
});

const MENSAGENS_ERRO_MULTER = {
  LIMIT_FILE_SIZE: `Cada imagem deve ter no máximo ${TAMANHO_MAXIMO_BYTES / (1024 * 1024)}MB`,
  LIMIT_FILE_COUNT: `No máximo ${MAX_ARQUIVOS_POR_ENVIO} imagens por envio`,
  LIMIT_UNEXPECTED_FILE: 'Apenas imagens JPEG, PNG ou WebP são permitidas',
};

// O multer usa callback em vez de lançar/rejeitar, então não dá pra usar um try/catch
// comum no controller. Esse wrapper intercepta o callback e transforma o erro numa
// resposta JSON de verdade (400 pra erro de validação do próprio upload), em vez de
// deixar cair no handler de erro genérico (que devolveria 500 pra algo que na
// verdade é erro esperado de entrada do cliente).
function uploadImagensItem(req, res, next) {
  upload.array('imagens', MAX_ARQUIVOS_POR_ENVIO)(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      return res.status(400).json({ erro: MENSAGENS_ERRO_MULTER[err.code] || err.message });
    }
    if (err) {
      logger.error({ err }, 'Erro inesperado no upload de imagem');
      return res.status(500).json({ erro: 'Erro interno do servidor' });
    }
    return next();
  });
}

module.exports = { uploadImagensItem };
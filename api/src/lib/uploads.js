const fs = require('fs');
const fsPromises = require('fs/promises');
const path = require('path');

// Pasta em disco onde as imagens de item enviadas por upload ficam salvas.
// Criada na hora que esse módulo é carregado, caso ainda não exista.
const DIRETORIO_UPLOADS_ITENS = path.join(__dirname, '..', '..', 'uploads', 'itens');
fs.mkdirSync(DIRETORIO_UPLOADS_ITENS, { recursive: true });

// Prefixo de URL correspondente, servido estaticamente pelo Express (ver app.js:
// app.use('/uploads', express.static(...))). Uma ImagemItem cuja url começa com
// esse prefixo é um upload local — qualquer outra URL é externa (ex: link colado
// manualmente) e não deve ter arquivo físico removido do disco.
const PREFIXO_URL_UPLOADS_ITENS = '/uploads/itens/';

// Anexos de chat não compartilham pasta com imagens de itens: têm tipos e
// limites próprios e nunca podem ser usados como URL externa.
const DIRETORIO_UPLOADS_MENSAGENS = path.join(__dirname, '..', '..', 'uploads', 'mensagens');
fs.mkdirSync(DIRETORIO_UPLOADS_MENSAGENS, { recursive: true });

const PREFIXO_URL_UPLOADS_MENSAGENS = '/uploads/mensagens/';

// Apaga o arquivo físico de uma imagem de item. Tolerante a arquivo já não existir
// (ENOENT) — isso pode acontecer de forma legítima (ex: remoção duplicada, arquivo
// já limpo manualmente) e não deve virar erro 500 pro usuário.
async function removerArquivoFisico(nomeArquivo) {
  try {
    await fsPromises.unlink(path.join(DIRETORIO_UPLOADS_ITENS, nomeArquivo));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[uploads] Falha ao remover arquivo físico:', err.message);
    }
  }
}

async function removerArquivoFisicoMensagem(nomeArquivo) {
  try {
    await fsPromises.unlink(path.join(DIRETORIO_UPLOADS_MENSAGENS, nomeArquivo));
  } catch (err) {
    if (err.code !== 'ENOENT') {
      console.error('[uploads] Falha ao remover anexo de mensagem:', err.message);
    }
  }
}

module.exports = {
  DIRETORIO_UPLOADS_ITENS,
  PREFIXO_URL_UPLOADS_ITENS,
  removerArquivoFisico,
  DIRETORIO_UPLOADS_MENSAGENS,
  PREFIXO_URL_UPLOADS_MENSAGENS,
  removerArquivoFisicoMensagem,
};

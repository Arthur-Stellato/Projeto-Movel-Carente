const TAMANHO_MAXIMO = 100;

// Extraído de normalizarPaginacao pra ser reaproveitado também pela paginação
// por cursor do chat (fase 9), que não tem conceito de "página", só de
// "quantos por vez" — mesmas proteções (NaN, zero/negativo, teto de 100).
function normalizarLimite(valor, valorPadrao) {
  return Math.min(TAMANHO_MAXIMO, Math.max(1, parseInt(valor, 10) || valorPadrao));
}

// Normaliza pagina/tamanho vindos da query string (sempre strings ou undefined).
// Protege contra: valores não numéricos (NaN quebraria o skip do Prisma), página
// zero/negativa, e tamanho de página absurdamente grande (?tamanho=999999 viraria
// uma consulta pesada sem necessidade — nunca deixamos passar de TAMANHO_MAXIMO).
function normalizarPaginacao(pagina, tamanho, tamanhoPadrao) {
  const paginaNum = Math.max(1, parseInt(pagina, 10) || 1);
  const tamanhoNum = normalizarLimite(tamanho, tamanhoPadrao);
  const skip = (paginaNum - 1) * tamanhoNum;

  return { pagina: paginaNum, tamanho: tamanhoNum, skip };
}

module.exports = { normalizarPaginacao, normalizarLimite, TAMANHO_MAXIMO };
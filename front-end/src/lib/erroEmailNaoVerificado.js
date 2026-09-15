// Único ponto que sabe o formato exato da resposta de erro (err.response.data.codigo)
// pra esse caso específico — se o backend mudar o formato um dia, só este arquivo muda.
export function ehEmailNaoVerificado(erro) {
  return erro?.response?.data?.codigo === 'EMAIL_NAO_VERIFICADO';
}

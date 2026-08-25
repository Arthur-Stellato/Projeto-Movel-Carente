import { api } from './api';

async function listar({ apenasNaoLidas, pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get('/notificacoes', { params: { apenasNaoLidas, pagina, tamanho } });
  return data;
}

async function contarNaoLidas() {
  const { data } = await api.get('/notificacoes/contagem-nao-lidas');
  return data.naoLidas;
}

async function marcarComoLida(id) {
  const { data } = await api.patch(`/notificacoes/${id}/lida`);
  return data.notificacao;
}

async function marcarTodasComoLidas() {
  await api.patch('/notificacoes/marcar-todas-lidas');
}

async function remover(id) {
  await api.delete(`/notificacoes/${id}`);
}

export const notificacaoService = { listar, contarNaoLidas, marcarComoLida, marcarTodasComoLidas, remover };

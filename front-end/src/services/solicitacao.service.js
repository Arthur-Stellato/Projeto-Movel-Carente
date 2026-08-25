import { api } from './api';

async function criar(itemId, mensagem) {
  const { data } = await api.post('/solicitacoes', { itemId, mensagem: mensagem || undefined });
  return data.solicitacao;
}

async function minhas({ pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get('/solicitacoes/minhas', { params: { pagina, tamanho } });
  return data;
}

async function listarPorItem(itemId, { pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get(`/solicitacoes/item/${itemId}`, { params: { pagina, tamanho } });
  return data;
}

async function aceitar(id) {
  await api.post(`/solicitacoes/${id}/aceitar`);
}

async function recusar(id) {
  await api.post(`/solicitacoes/${id}/recusar`);
}

async function cancelar(id) {
  await api.post(`/solicitacoes/${id}/cancelar`);
}

async function concluir(id) {
  await api.post(`/solicitacoes/${id}/concluir`);
}

export const solicitacaoService = { criar, minhas, listarPorItem, aceitar, recusar, cancelar, concluir };

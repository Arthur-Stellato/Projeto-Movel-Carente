import { api } from './api';

async function criar(solicitacaoId, { nota, comentario }) {
  const { data } = await api.post(`/solicitacoes/${solicitacaoId}/avaliacoes`, { nota, comentario: comentario || undefined });
  return data.avaliacao;
}

async function statusPorSolicitacao(solicitacaoId) {
  const { data } = await api.get(`/solicitacoes/${solicitacaoId}/avaliacoes`);
  return data;
}

async function recebidasPorUsuario(usuarioId, { pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get(`/usuarios/${usuarioId}/avaliacoes`, { params: { pagina, tamanho } });
  return data;
}

export const avaliacaoService = { criar, statusPorSolicitacao, recebidasPorUsuario };

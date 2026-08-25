import { api } from './api';

async function listar({ pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get('/favoritos', { params: { pagina, tamanho } });
  return data;
}

async function adicionar(itemId) {
  await api.post('/favoritos', { itemId });
}

async function verificar(itemId) {
  const { data } = await api.get(`/favoritos/${itemId}`);
  return data.favoritado;
}

async function remover(itemId) {
  await api.delete(`/favoritos/${itemId}`);
}

export const favoritoService = { listar, adicionar, verificar, remover };

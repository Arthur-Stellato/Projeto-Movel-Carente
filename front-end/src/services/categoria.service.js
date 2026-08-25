import { api } from './api';

async function listar(todas = false) {
  const { data } = await api.get('/categorias', { params: todas ? { todas: true } : undefined });
  return data.categorias;
}

async function buscarPorId(id) {
  const { data } = await api.get(`/categorias/${id}`);
  return data.categoria;
}

async function criar({ nome, icone }) {
  const { data } = await api.post('/categorias', { nome, icone });
  return data.categoria;
}

async function atualizar(id, dados) {
  const { data } = await api.put(`/categorias/${id}`, dados);
  return data.categoria;
}

async function desativar(id) {
  await api.delete(`/categorias/${id}`);
}

export const categoriaService = { listar, buscarPorId, criar, atualizar, desativar };

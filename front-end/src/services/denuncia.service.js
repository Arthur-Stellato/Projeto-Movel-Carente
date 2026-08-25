import { api } from './api';

async function criar(dados) {
  const { data } = await api.post('/denuncias', dados);
  return data.denuncia;
}

async function minhas({ pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get('/denuncias/minhas', { params: { pagina, tamanho } });
  return data;
}

async function listarTodas({ status, tipo, pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get('/denuncias', { params: { status, tipo, pagina, tamanho } });
  return data;
}

async function buscarPorId(id) {
  const { data } = await api.get(`/denuncias/${id}`);
  return data.denuncia;
}

async function analisar(id, dados) {
  const { data } = await api.patch(`/denuncias/${id}/analisar`, dados);
  return data.denuncia;
}

export const denunciaService = { criar, minhas, listarTodas, buscarPorId, analisar };

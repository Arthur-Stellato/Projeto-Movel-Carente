import { api } from './api';

async function listar(filtros = {}) {
  const { data } = await api.get('/itens', { params: filtros });
  return data;
}

async function meusItens() {
  const { data } = await api.get('/itens/meus');
  return data.itens;
}

async function buscarPorId(id) {
  const { data } = await api.get(`/itens/${id}`);
  return data.item;
}

async function criar(dados) {
  const { data } = await api.post('/itens', dados);
  return data.item;
}

async function atualizar(id, dados) {
  const { data } = await api.put(`/itens/${id}`, dados);
  return data.item;
}

async function cancelar(id) {
  await api.delete(`/itens/${id}`);
}

async function adicionarImagensPorUrl(id, urls) {
  const { data } = await api.post(`/itens/${id}/imagens`, { urls });
  return data.imagens;
}

// multipart/form-data — até 10 arquivos, JPEG/PNG/WebP, 5MB cada (ver
// ../../api/src/middlewares/upload.middleware.js). O campo do formulário
// precisa se chamar exatamente "imagens".
async function enviarImagens(id, arquivos, onProgress) {
  const formData = new FormData();
  Array.from(arquivos).forEach((arquivo) => formData.append('imagens', arquivo));

  const { data } = await api.post(`/itens/${id}/imagens/upload`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (evento) => {
      if (onProgress && evento.total) {
        onProgress(Math.round((evento.loaded * 100) / evento.total));
      }
    },
  });
  return data.imagens;
}

async function removerImagem(itemId, imagemId) {
  await api.delete(`/itens/${itemId}/imagens/${imagemId}`);
}

export const itemService = {
  listar,
  meusItens,
  buscarPorId,
  criar,
  atualizar,
  cancelar,
  adicionarImagensPorUrl,
  enviarImagens,
  removerImagem,
};

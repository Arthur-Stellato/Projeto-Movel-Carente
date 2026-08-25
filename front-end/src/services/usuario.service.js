import { api } from './api';

async function buscarPerfil() {
  const { data } = await api.get('/usuarios/me');
  return data.usuario;
}

async function atualizarPerfil(dados) {
  const { data } = await api.put('/usuarios/me', dados);
  return data.usuario;
}

async function alterarSenha(senhaAtual, novaSenha) {
  const { data } = await api.patch('/usuarios/me/senha', { senhaAtual, novaSenha });
  return data;
}

async function listarEnderecos() {
  const { data } = await api.get('/usuarios/me/enderecos');
  return data.enderecos;
}

async function criarEndereco(endereco) {
  const { data } = await api.post('/usuarios/me/enderecos', endereco);
  return data.endereco;
}

async function atualizarEndereco(id, endereco) {
  const { data } = await api.put(`/usuarios/me/enderecos/${id}`, endereco);
  return data.endereco;
}

async function removerEndereco(id) {
  await api.delete(`/usuarios/me/enderecos/${id}`);
}

async function listarTodos({ ativo, tipo, pagina = 1, tamanho = 20 } = {}) {
  const { data } = await api.get('/usuarios', { params: { ativo, tipo, pagina, tamanho } });
  return data;
}

async function desativarConta(id) {
  const { data } = await api.patch(`/usuarios/${id}/desativar`);
  return data;
}

async function reativarConta(id) {
  const { data } = await api.patch(`/usuarios/${id}/reativar`);
  return data;
}

export const usuarioService = {
  buscarPerfil,
  atualizarPerfil,
  alterarSenha,
  listarEnderecos,
  criarEndereco,
  atualizarEndereco,
  removerEndereco,
  listarTodos,
  desativarConta,
  reativarConta,
};

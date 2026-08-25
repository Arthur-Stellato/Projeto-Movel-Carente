import { api, setAccessToken } from './api';

async function registrar(dados) {
  const { data } = await api.post('/auth/registro', dados);
  return data.usuario;
}

async function login(email, senha) {
  const { data } = await api.post('/auth/login', { email, senha });
  setAccessToken(data.accessToken);
  return data.usuario;
}

async function refresh() {
  const { data } = await api.post('/auth/refresh');
  setAccessToken(data.accessToken);
  return data.accessToken;
}

async function logout() {
  try {
    await api.post('/auth/logout');
  } finally {
    setAccessToken(null);
  }
}

async function esqueciSenha(email) {
  const { data } = await api.post('/auth/esqueci-senha', { email });
  return data.mensagem;
}

async function redefinirSenha(token, novaSenha) {
  const { data } = await api.post('/auth/redefinir-senha', { token, novaSenha });
  return data;
}

async function reenviarVerificacao(email) {
  const { data } = await api.post('/auth/reenviar-verificacao', { email });
  return data.mensagem;
}

async function verificarEmail(token) {
  const { data } = await api.post('/auth/verificar-email', { token });
  return data;
}

export const authService = {
  registrar,
  login,
  refresh,
  logout,
  esqueciSenha,
  redefinirSenha,
  reenviarVerificacao,
  verificarEmail,
};

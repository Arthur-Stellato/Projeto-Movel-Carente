import axios from 'axios';

// Base URL do backend real (ver ../../api). Configurável via VITE_API_URL (.env).
export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

// Token de acesso mantido só em memória (nunca em localStorage): é curto (15min)
// e, se um XSS conseguisse ler localStorage, pegaria o token de qualquer sessão
// aberta. O refreshToken (o que importa manter em sigilo por mais tempo) já vive
// num cookie httpOnly, inacessível a JavaScript — ver ../../api/src/lib/cookies.js.
let accessToken = null;
const ouvintesDeLogout = new Set();

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token) {
  accessToken = token;
}

// AuthContext se inscreve aqui pra saber quando uma sessão morreu por dentro do
// interceptor (refresh falhou) e precisa limpar o estado de usuário logado.
export function aoDeslogar(callback) {
  ouvintesDeLogout.add(callback);
  return () => ouvintesDeLogout.delete(callback);
}

function notificarLogout() {
  accessToken = null;
  ouvintesDeLogout.forEach((cb) => cb());
}

export const api = axios.create({
  baseURL: API_URL,
  // Necessário para o cookie httpOnly refreshToken ser enviado/recebido nas
  // chamadas de /auth/* — ver CORS em ../../api/src/app.js (credentials: true).
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

// Fila de requisições que chegaram enquanto um refresh já estava em andamento —
// evita disparar vários POST /auth/refresh em paralelo. Isso importa mais do
// que parece: o refresh token do backend usa ROTAÇÃO (cada /auth/refresh
// invalida o token antigo e emite um novo) com detecção de reuso — se duas
// chamadas concorrentes chegarem com o MESMO token ainda não rotacionado (ex:
// duas abas abertas, ou o StrictMode do React invocando um efeito duas vezes
// em desenvolvimento), a segunda usaria um token já "gasto" pela primeira, o
// backend entenderia isso como possível roubo de token e revogaria a sessão
// inteira — exatamente o "desloga a cada F5" que esse cache evita. Por isso
// esta função (não `api.post('/auth/refresh')` direto) é o único ponto de
// entrada pra renovar sessão em todo o front-end — usada tanto aqui no
// interceptor quanto no bootstrap do AuthContext.
let refreshEmAndamento = null;

export async function tentarRenovarToken() {
  if (!refreshEmAndamento) {
    refreshEmAndamento = api
      .post('/auth/refresh')
      .then((resposta) => {
        setAccessToken(resposta.data.accessToken);
        return resposta.data.accessToken;
      })
      .finally(() => {
        refreshEmAndamento = null;
      });
  }
  return refreshEmAndamento;
}

api.interceptors.response.use(
  (resposta) => resposta,
  async (erro) => {
    const requisicaoOriginal = erro.config;
    const rotaDeAuth = requisicaoOriginal?.url?.startsWith('/auth/');

    if (erro.response?.status === 401 && !requisicaoOriginal._tentouRenovar && !rotaDeAuth) {
      requisicaoOriginal._tentouRenovar = true;
      try {
        const novoToken = await tentarRenovarToken();
        requisicaoOriginal.headers.Authorization = `Bearer ${novoToken}`;
        return api(requisicaoOriginal);
      } catch (erroRefresh) {
        notificarLogout();
        return Promise.reject(erroRefresh);
      }
    }

    return Promise.reject(erro);
  }
);

// Toda mensagem de erro da API vem no formato { erro: "texto" } — ver
// ../../api/src/middlewares/errorHandler.middleware.js e validar.middleware.js.
export function mensagemDeErro(erro) {
  return erro?.response?.data?.erro || 'Não foi possível completar a operação. Tente novamente.';
}

// Resolve a URL de uma imagem salva pelo backend (ex: "/uploads/itens/x.jpg")
// para uma URL absoluta apontando pro servidor da API.
export function resolverUrlImagem(url) {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  return `${API_URL}${url}`;
}

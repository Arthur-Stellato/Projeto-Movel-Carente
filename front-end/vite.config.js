import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Prefixos de rota reais da API (ver ../api/src/app.js) — usados abaixo pelo
// proxy do Vite. Mantenha esta lista em dia se novas rotas de topo forem
// adicionadas na API.
const PREFIXOS_API = [
  '/auth', '/itens', '/categorias', '/usuarios',
  '/solicitacoes', '/favoritos', '/notificacoes',
  '/denuncias', '/cep', '/uploads', '/docs',
];

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Por padrão, o Vite recusa qualquer requisição cujo cabeçalho Host não
    // seja localhost/127.0.0.1 (proteção contra DNS rebinding). Isso inclui o
    // domínio de um túnel (ngrok, Cloudflare Tunnel etc) quando alguém em
    // outra rede acessa o front-end por ele — sem isso, a pessoa veria a
    // página de erro "Blocked request. This host is not allowed" do Vite.
    // `true` desativa essa checagem — ok para destravar uma demo temporária
    // com alguém de confiança; não é recomendado deixar assim indefinidamente
    // num ambiente exposto por muito tempo.
    allowedHosts: true,

    // Encaminha as chamadas da API pro backend real em localhost:3000 —
    // permite servir front-end + API pelo MESMO túnel/origem (útil com uma
    // conta ngrok gratuita, que só permite 1 túnel simultâneo). Isso também
    // elimina qualquer problema de CORS ou de cookie cross-site nesse cenário,
    // porque do ponto de vista do navegador tudo é a mesma origem — o proxy
    // acontece só entre o Vite e o Express, nunca passando pelo navegador.
    // Ativo só quando VITE_API_URL estiver vazio (ver .env) — se
    // VITE_API_URL apontar direto pro backend, o axios nem chega a usar esse
    // proxy, e este bloco fica sem efeito.
    proxy: Object.fromEntries(
      PREFIXOS_API.map((prefixo) => [prefixo, { target: 'http://localhost:3000', changeOrigin: true }])
    ),
  },
})

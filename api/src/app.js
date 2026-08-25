require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const pinoHttp = require('pino-http');
const path = require('path');
const swaggerUi = require('swagger-ui-express');
const swaggerSpec = require('./config/swagger');
const logger = require('./lib/logger');
const prisma = require('./lib/prisma');
const { limitadorGeral, clienteRedis } = require('./config/rateLimiter');
const { autenticarOpcional } = require('./middlewares/auth.middleware');
const authRoutes = require('./routes/auth.routes');
const categoriaRoutes = require('./routes/categoria.routes');
const itemRoutes = require('./routes/item.routes');
const solicitacaoRoutes = require('./routes/solicitacao.routes');
const favoritoRoutes = require('./routes/favorito.routes');
const notificacaoRoutes = require('./routes/notificacao.routes');
const denunciaRoutes = require('./routes/denuncia.routes');
const cepRoutes = require('./routes/cep.routes');
const usuarioRoutes = require('./routes/usuario.routes');
const { rotaNaoEncontrada, manipuladorErroGlobal } = require('./middlewares/errorHandler.middleware');

const app = express();

// Necessário para o rate limiting identificar o IP real do cliente quando a API
// roda atrás de um proxy/load balancer (Nginx, Heroku, Render, Cloudflare etc).
// Ajuste o número conforme quantos proxies existem entre o cliente e essa API
// (1 = confia no primeiro proxy imediatamente na frente). Sem isso, todo mundo
// pode acabar contando como "o mesmo IP" aos olhos do rate limiter.
app.set('trust proxy', 1);

// Cabeçalhos de segurança padrão com Content Security Policy (CSP) ativo globalmente.
app.use(helmet());

// Loga toda requisição HTTP automaticamente (método, rota, status, tempo de resposta).
// Silencioso em teste (ver src/lib/logger.js) — não polui a saída do Jest.
app.use(pinoHttp({ logger }));

// origin explícito (não '*') é obrigatório aqui: navegador recusa cookie em
// requisição cross-origin se o servidor responder com Access-Control-Allow-Origin: *
// junto de Access-Control-Allow-Credentials: true — as duas juntas não são permitidas.
// CORS_ORIGIN aceita uma ou mais origens separadas por vírgula (ex:
// "http://localhost:3000,http://localhost:5173") — o localhost:3000 cobre o
// próprio Swagger UI (/docs, que roda "Try it out" a partir da própria API),
// e o localhost:5173 é o padrão do Vite, usado pelo frontend em desenvolvimento.
// Passar um array pro pacote `cors` (em vez de uma string fixa) faz ele refletir
// de volta a origem que bate com a requisição de verdade — uma string fixa
// sempre devolveria o MESMO valor pra qualquer origem, o que faria o navegador
// bloquear qualquer origem diferente da configurada (foi exatamente esse o bug:
// CORS_ORIGIN fixo em localhost:3000 bloqueava o frontend rodando em localhost:5173).
const origensPermitidas = (process.env.CORS_ORIGIN || 'http://localhost:3000,https://pills-california-needs-seems.trycloudflare.com')
  .split(',')
  .map((origem) => origem.trim())
  .filter(Boolean);

app.use(cors({
  origin: origensPermitidas,
  credentials: true,
}));
app.use(cookieParser());
// Limite explícito de tamanho do corpo JSON — nenhuma rota deste projeto espera JSON
// grande (uploads de arquivo de verdade passam pelo multer, com seu próprio limite de
// 5MB por arquivo, não por aqui). Sem esse limite, o padrão do Express aceita corpos
// bem maiores, o que é uma superfície de negação de serviço fácil de evitar.
app.use(express.json({ limit: '1mb' }));

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Readiness real: confere se as dependências de verdade (Postgres, Redis) estão
// acessíveis, não só se o processo Node está de pé (isso o /health acima já cobre).
// Postgres é crítico — sem ele a API não consegue responder quase nada, então 503.
// Redis é best-effort — sem ele a API ainda funciona (rate limiting cai em fail-open,
// como já validado), então mesmo indisponível a resposta continua 200, só marcando
// "degradado" pra quem estiver observando.
app.get('/health/ready', async (req, res) => {
  const resultado = { status: 'ok', postgres: 'ok', redis: 'ok' };
  let httpStatus = 200;

  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    logger.error({ err }, 'Health check: Postgres inacessível');
    resultado.postgres = 'erro';
    resultado.status = 'indisponivel';
    httpStatus = 503;
  }

  try {
    await clienteRedis.ping();
  } catch (err) {
    resultado.redis = 'degradado';
    if (resultado.status === 'ok') resultado.status = 'degradado';
  }

  return res.status(httpStatus).json(resultado);
});

// Documentação interativa da API — relaxa CSP apenas na rota /docs para os scripts inline do Swagger UI
app.use(
  '/docs',
  (req, res, next) => {
    res.removeHeader('Content-Security-Policy');
    next();
  },
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec)
);
app.get('/docs.json', (req, res) => res.json(swaggerSpec));

// Serve os arquivos de imagem enviados por upload (ver src/lib/uploads.js e
// src/middlewares/upload.middleware.js). Protegido com nosniff e sandbox.
app.use(
  '/uploads',
  express.static(path.join(__dirname, '..', 'uploads'), {
    setHeaders: (res) => {
      res.setHeader('X-Content-Type-Options', 'nosniff');
      res.setHeader('Content-Security-Policy', "default-src 'none'; sandbox");
    },
  })
);

// Rate limiting geral, aplicado a partir daqui (não conta health check nem docs).
// autenticarOpcional roda antes só pra popular req.usuario quando o Bearer token
// já veio na requisição — o rate limiter usa isso pra liberar administradores do
// limite (ver skip em config/rateLimiter.js). Nunca bloqueia por si só: quem não
// mandar token nenhum, ou mandar um inválido, segue como visitante anônimo normal
// e cai no limite padrão igual antes.
app.use(autenticarOpcional);
app.use(limitadorGeral);

app.use('/auth', authRoutes);
app.use('/categorias', categoriaRoutes);
app.use('/itens', itemRoutes);
app.use('/solicitacoes', solicitacaoRoutes);
app.use('/favoritos', favoritoRoutes);
app.use('/notificacoes', notificacaoRoutes);
app.use('/denuncias', denunciaRoutes);
app.use('/cep', cepRoutes);
app.use('/usuarios', usuarioRoutes);

app.use(rotaNaoEncontrada);
app.use(manipuladorErroGlobal);

module.exports = app;
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis').default;
const Redis = require('ioredis');
const conexaoRedis = require('../lib/redis');
const logger = require('../lib/logger');

// Cliente Redis dedicado ao rate limiting (conexão própria, separada da usada pelo BullMQ).
//
// Configurado para FALHAR RÁPIDO em vez de enfileirar comandos esperando o Redis voltar:
// por padrão o ioredis enfileira comandos indefinidamente enquanto está desconectado
// (enableOfflineQueue: true), o que faria cada requisição travar esperando uma resposta
// que só viria quando o Redis voltasse. Aqui, se o Redis estiver fora do ar, o comando
// rejeita na hora — e o fail-open abaixo (passOnStoreError) garante que a requisição
// segue em frente mesmo assim, sem limite, em vez de derrubar a API inteira.
//
// NOTA sobre o log "async error during store initialization" que aparece na subida do
// servidor: é esperado e inofensivo. O RedisStore tenta carregar seu script Lua de
// inicialização no exato momento em que o middleware é criado — quase sempre antes da
// conexão TCP com o Redis terminar de se estabelecer (é assíncrona). Com a fila offline
// desligada, esse comando específico é rejeitado na hora só por ter chegado cedo demais.
// Cheguei a testar ligar a fila offline pra evitar esse log, mas isso troca um log
// cosmético por um problema de verdade: numa queda sustentada, cada requisição passa a
// esperar o ciclo de reconexão em andamento antes de desistir, e esse tempo de espera
// CRESCE a cada tentativa (o backoff do retryStrategy vai aumentando) — medido em teste,
// a resposta foi de ~1.2s pra ~1.8s pra ~2.6s em requisições sucessivas durante a queda.
// Prefiro o log inofensivo no boot a um rate limiter que fica cada vez mais lento durante
// uma queda real. A lógica de retry do próprio rate-limit-redis (retryableIncrement) já
// recarrega o script sozinha na primeira requisição real, então isso nunca afeta o
// funcionamento — só aparece no log uma vez (ou duas, uma por limitador) na subida.
const clienteRedis = new Redis({
  host: conexaoRedis.host,
  port: conexaoRedis.port,
  enableOfflineQueue: false, // não enfileira comando enquanto desconectado — rejeita na hora
  connectTimeout: 3000, // não fica preso tentando conectar por muito tempo
  disconnectTimeout: 200, // ao desconectar explicitamente, não espera muito pra forçar o fechamento
  maxRetriesPerRequest: 1, // no máximo 1 retry por comando antes de desistir e rejeitar
  retryStrategy(tentativas) {
    // Backoff da reconexão em segundo plano (não bloqueia requisições, só controla
    // de quanto em quanto tempo o ioredis tenta se reconectar sozinho ao Redis).
    return Math.min(tentativas * 200, 2000);
  },
});

// Sem um listener de 'error', uma falha de conexão do ioredis pode ser tratada pelo Node
// como exceção não capturada (comportamento padrão de EventEmitter quando ninguém escuta
// 'error') e derrubar o processo inteiro. Aqui só registramos o erro no log — quem garante
// que a API continua respondendo é o fail-open (passOnStoreError) configurado abaixo.
clienteRedis.on('error', (err) => {
  logger.error({ err }, '[rateLimiter] Erro na conexão com o Redis');
});

function criarStore(prefixo) {
  return new RedisStore({
    sendCommand: (...args) => clienteRedis.call(...args),
    prefix: `rl:${prefixo}:`,
  });
}

// Limite geral: aplicado a toda a API, protege contra abuso genérico/scraping
const limitadorGeral = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  limit: 300,
  standardHeaders: true,
  legacyHeaders: false,
  store: criarStore('geral'),
  passOnStoreError: true, // fail-open: Redis fora do ar não deve travar nem derrubar a API
  message: { erro: 'Muitas requisições. Tente novamente em alguns minutos.' },
});

// Limite estrito: aplicado só nas rotas mais visadas por força bruta (login, registro, recuperação de senha).
// Isso complementa o bloqueio por tentativas já existente em usuarios.tentativas_login_falhas — aquele
// protege UMA conta específica; este protege contra alguém varrendo MUITAS contas a partir do mesmo IP.
const limitadorAuth = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  store: criarStore('auth'),
  passOnStoreError: true, // fail-open: mesma lógica do limitador geral
  message: { erro: 'Muitas tentativas. Tente novamente em alguns minutos.' },
});

module.exports = { limitadorGeral, limitadorAuth, clienteRedis };
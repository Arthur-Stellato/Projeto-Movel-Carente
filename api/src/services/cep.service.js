const prisma = require('../lib/prisma');
const logger = require('../lib/logger');
const { ErroDominio } = require('../lib/erros');
const { validarCep, apenasDigitos } = require('../lib/validadores');

class ErroCep extends ErroDominio {}

const TIMEOUT_MS = 5000;

// Qual provedor externo consultar na camada 2 (ver buscarCep abaixo) —
// controlado por CEP_PROVIDER (lido em consultarProvedorExterno). ViaCEP é
// o padrão — gratuita, sem cadastro/chave de API, adequada pro contexto deste
// projeto. BrasilAPI fica pronta e implementada (ver consultarBrasilApi),
// só não é o padrão agora — trocar de volta é mudar essa env var, nenhum
// código precisa mudar. Única diferença funcional real entre as duas: BrasilAPI
// devolve latitude/longitude quando disponível; ViaCEP não devolve
// geolocalização de jeito nenhum (é só um lookup de endereço via Correios,
// sem geocodificação) — ver a nota em consultarViaCep.

// Consulta um CEP em 3 camadas:
//   1. Cache local (Postgres) — se já consultamos esse CEP antes, nem saímos daqui.
//   2. Provedor externo (ViaCEP por padrão) — só quando é CEP novo pro nosso cache.
//   3. Persistência — o resultado é salvo pra próxima consulta do mesmo CEP
//      nunca mais precisar sair da camada 1.
//
// Lança ErroCep(404) pra CEP inexistente/mal formado, ou ErroCep(502) se o
// provedor estiver fora do ar/instável — quem chama decide se isso deve
// bloquear a operação (ver GET /cep/:cep) ou só ser engolido, deixando as
// coordenadas em branco (ver uso em usuario.service.js: criarEndereco/atualizarEndereco).
async function buscarCep(cepBruto) {
  const cep = apenasDigitos(cepBruto);
  if (!validarCep(cep)) {
    throw new ErroCep('CEP inválido. Deve conter 8 dígitos', 400);
  }

  const doCache = await prisma.cepCache.findUnique({ where: { cep } });
  if (doCache) {
    return doCache;
  }

  const resolvido = await consultarProvedorExterno(cep);

  // Upsert em vez de create puro: dois requests concorrentes pro mesmo CEP
  // novo não devem colidir numa violação de chave primária.
  return prisma.cepCache.upsert({
    where: { cep },
    create: { cep, ...resolvido },
    update: resolvido,
  });
}

// Ponto único de despacho pro provedor configurado — trocar de provedor no
// futuro é só mudar CEP_PROVIDER, sem tocar em buscarCep. Lida a cada chamada
// (não cacheada num const no topo do módulo) de propósito: torna as duas
// implementações testáveis lado a lado no mesmo arquivo de teste, sem precisar
// resetar e reimportar o módulo pra cada cenário.
async function consultarProvedorExterno(cep) {
  const provedor = process.env.CEP_PROVIDER || 'viacep';
  if (provedor === 'brasilapi') {
    return consultarBrasilApi(cep);
  }
  return consultarViaCep(cep);
}

// Roda um fetch com timeout via AbortController — comum às duas implementações,
// pra não duplicar essa parte (só a URL e o parse de resposta mudam entre provedores).
async function fetchComTimeout(url, nomeProvedor) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (err) {
    logger.error({ url, err }, `[cep.service] ${nomeProvedor} inacessível`);
    throw new ErroCep('Não foi possível consultar o CEP no momento. Tente novamente em instantes.', 502);
  } finally {
    clearTimeout(timeout);
  }
}

// --- ViaCEP (provedor padrão) -------------------------------------------
//
// Gratuita e sem chave de API — adequada pro contexto deste projeto. Duas
// diferenças de comportamento em relação à BrasilAPI que exigem tratamento
// específico:
//
// 1. CEP de formato válido mas inexistente NÃO devolve HTTP 404 — devolve
//    200 OK com o corpo `{ erro: true }`. Só CEP malformado (tamanho errado,
//    letras, espaço) devolve 400 de verdade. Por isso a checagem de
//    "não encontrado" aqui é no corpo JSON, não no status HTTP.
// 2. ViaCEP não faz geocodificação — não existe NENHUM campo de
//    latitude/longitude na resposta. latitude/longitude sempre voltam null
//    daqui (o resto do sistema já lida bem com isso — endereço/item ficam
//    sem coordenada até ganharem uma via endereço vinculado ou centroide de
//    cidade, ou até o projeto voltar a usar um provedor com geocodificação).
async function consultarViaCep(cep) {
  const resposta = await fetchComTimeout(`https://viacep.com.br/ws/${cep}/json/`, 'ViaCEP');

  if (resposta.status === 400) {
    throw new ErroCep('CEP inválido. Deve conter 8 dígitos', 400);
  }
  if (!resposta.ok) {
    logger.error({ cep, status: resposta.status }, '[cep.service] ViaCEP devolveu status inesperado');
    throw new ErroCep('Não foi possível consultar o CEP no momento. Tente novamente em instantes.', 502);
  }

  const dados = await resposta.json();

  if (dados.erro) {
    throw new ErroCep('CEP não encontrado', 404);
  }

  return {
    logradouro: dados.logradouro || null,
    bairro: dados.bairro || null,
    cidade: dados.localidade,
    estado: dados.uf,
    latitude: null,
    longitude: null,
  };
}

// --- BrasilAPI (alternativa — não é o padrão agora) ---------------------
//
// Preservada implementada e funcional: pra voltar a usar, só setar
// CEP_PROVIDER=brasilapi (env var) — nenhuma outra mudança de código
// necessária. Devolve latitude/longitude quando a BrasilAPI conseguir
// geolocalizar o CEP (nem sempre acontece — não é erro quando não vem).
async function consultarBrasilApi(cep) {
  const resposta = await fetchComTimeout(`https://brasilapi.com.br/api/cep/v2/${cep}`, 'BrasilAPI');

  if (resposta.status === 404) {
    throw new ErroCep('CEP não encontrado', 404);
  }
  if (!resposta.ok) {
    logger.error({ cep, status: resposta.status }, '[cep.service] BrasilAPI devolveu status inesperado');
    throw new ErroCep('Não foi possível consultar o CEP no momento. Tente novamente em instantes.', 502);
  }

  const dados = await resposta.json();
  const coordenadas = dados.location?.coordinates || {};

  return {
    logradouro: dados.street || null,
    bairro: dados.neighborhood || null,
    cidade: dados.city,
    estado: dados.state,
    latitude: coordenadas.latitude != null ? Number(coordenadas.latitude) : null,
    longitude: coordenadas.longitude != null ? Number(coordenadas.longitude) : null,
  };
}

module.exports = { ErroCep, buscarCep };

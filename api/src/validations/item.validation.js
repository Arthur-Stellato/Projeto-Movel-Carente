const Joi = require('joi');
const { uuid, uf } = require('./comuns');
const { UFS_VALIDAS } = require('../lib/validadores');

const CONDICOES_VALIDAS = ['novo', 'seminovo', 'usado'];

const condicao = Joi.string().valid(...CONDICOES_VALIDAS).messages({
  'any.only': `Condição inválida. Use: ${CONDICOES_VALIDAS.join(', ')}`,
});

// Mesma regra de sempre pra imagem: só http/https. O Joi já cobre isso nativamente
// com .uri(), sem precisar do validarUrl manual (new URL() + checagem de protocolo).
const urlImagem = Joi.string().uri({ scheme: ['http', 'https'] }).messages({
  'string.uri': 'Uma ou mais URLs de imagem são inválidas',
  'string.uriCustomScheme': 'Uma ou mais URLs de imagem são inválidas',
});

// POST /itens
const criar = Joi.object({
  titulo: Joi.string().trim().min(1).max(150).required().messages({
    'string.empty': 'O título é obrigatório',
    'any.required': 'O título é obrigatório',
    'string.max': 'O título deve ter no máximo 150 caracteres',
  }),
  descricao: Joi.string().trim().min(1).required().messages({
    'string.empty': 'A descrição é obrigatória',
    'any.required': 'A descrição é obrigatória',
  }),
  categoriaId: uuid.required().messages({
    'any.required': 'A categoria é obrigatória',
    'string.empty': 'A categoria é obrigatória',
  }),
  condicao,
  cidade: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Cidade e estado são obrigatórios',
    'any.required': 'Cidade e estado são obrigatórios',
    'string.max': 'A cidade deve ter no máximo 100 caracteres',
  }),
  estado: uf.required().messages({
    'string.empty': 'Cidade e estado são obrigatórios',
    'any.required': 'Cidade e estado são obrigatórios',
  }),
  imagens: Joi.array().items(urlImagem).max(10).messages({
    'array.max': 'No máximo 10 imagens por item',
  }),
  // Obrigatório: um item sem endereço vinculado cai no centroide da cidade (impreciso
  // pra busca por raio/PostGIS) e o doador nunca recebe o endereço de fato pra combinar
  // a retirada. Vem depois de `imagens` na ordem do schema de propósito — o Joi (com
  // abortEarly, o padrão) reporta o primeiro erro na ordem em que os campos aparecem
  // aqui, e os testes de validação de imagens em tests/integration/validacao.test.js
  // não passam enderecoId por não ser o que estão testando; se enderecoId viesse antes,
  // esses testes passariam a falhar reportando "endereço obrigatório" em vez do erro de
  // imagens que realmente querem verificar.
  enderecoId: uuid.required().messages({
    'any.required': 'Selecione um endereço cadastrado para o item',
    'string.empty': 'Selecione um endereço cadastrado para o item',
    'string.guid': 'Endereço inválido',
  }),
});

// PUT /itens/:id — atualização parcial, mesmas regras de formato do criar
const atualizar = Joi.object({
  titulo: Joi.string().trim().min(1).max(150).messages({
    'string.empty': 'O título é obrigatório',
    'string.max': 'O título deve ter no máximo 150 caracteres',
  }),
  descricao: Joi.string().trim().min(1),
  categoriaId: uuid,
  condicao,
  cidade: Joi.string().trim().max(100).messages({
    'string.max': 'A cidade deve ter no máximo 100 caracteres',
  }),
  estado: uf,
  enderecoId: uuid,
});

// GET /itens — filtros de query. Só rejeita (400); não reescreve req.query
// (ver comentário em middlewares/validar.middleware.js sobre Express 5).
const listar = Joi.object({
  categoriaId: uuid.messages({ 'string.guid': 'categoriaId inválido no filtro' }),
  cidade: Joi.string(),
  estado: uf.messages({ 'any.only': `Estado inválido no filtro. Use uma UF válida: ${UFS_VALIDAS.join(', ')}` }),
  busca: Joi.string(),
  // Busca por raio (PostGIS) — os 3 juntos ou nenhum; mandar só 1 ou 2 não faz
  // sentido (não dá pra desenhar um círculo sem centro E raio).
  lat: Joi.number().min(-90).max(90).messages({ 'number.base': 'lat deve ser um número entre -90 e 90' }),
  lng: Joi.number().min(-180).max(180).messages({ 'number.base': 'lng deve ser um número entre -180 e 180' }),
  raioKm: Joi.number().positive().max(500).messages({
    'number.base': 'raioKm deve ser um número positivo',
    'number.max': 'raioKm máximo é 500km',
  }),
  pagina: Joi.any(),
  tamanho: Joi.any(),
}).and('lat', 'lng', 'raioKm').messages({
  'object.and': 'Pra buscar por raio, informe lat, lng e raioKm juntos (não dá pra desenhar um círculo sem os três)',
});

// POST /itens/:id/imagens
const adicionarImagens = Joi.object({
  urls: Joi.array().items(urlImagem).min(1).max(10).required().messages({
    'array.min': 'Nenhuma URL de imagem fornecida',
    'array.max': 'No máximo 10 imagens por item',
    'any.required': 'Nenhuma URL de imagem fornecida',
  }),
});

module.exports = { criar, atualizar, listar, adicionarImagens };
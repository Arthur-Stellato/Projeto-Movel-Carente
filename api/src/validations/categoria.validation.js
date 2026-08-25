const Joi = require('joi');

// POST /categorias
const criar = Joi.object({
  nome: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'O nome da categoria é obrigatório',
    'any.required': 'O nome da categoria é obrigatório',
    'string.max': 'O nome deve ter no máximo 100 caracteres',
  }),
  icone: Joi.string().trim().max(100).allow('', null).messages({
    'string.max': 'O ícone deve ter no máximo 100 caracteres',
  }),
});

// PUT /categorias/:id — atualização parcial
const atualizar = Joi.object({
  nome: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'O nome da categoria não pode ser vazio',
    'string.min': 'O nome da categoria não pode ser vazio',
    'string.max': 'O nome deve ter no máximo 100 caracteres',
  }),
  icone: Joi.string().trim().max(100).allow('', null).messages({
    'string.max': 'O ícone deve ter no máximo 100 caracteres',
  }),
  ativo: Joi.boolean(),
});

module.exports = { criar, atualizar };

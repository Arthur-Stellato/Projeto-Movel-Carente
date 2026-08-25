const Joi = require('joi');

// GET /cep/:cep — só formato (8 dígitos, com ou sem hífen); o checksum "existe
// de verdade" é responsabilidade da consulta em si (cep.service.js), não do Joi.
const cepParam = Joi.object({
  cep: Joi.string()
    .pattern(/^\d{5}-?\d{3}$/)
    .required()
    .messages({
      'string.pattern.base': 'CEP inválido. Deve conter 8 dígitos',
      'any.required': 'CEP é obrigatório',
    }),
});

module.exports = { cepParam };

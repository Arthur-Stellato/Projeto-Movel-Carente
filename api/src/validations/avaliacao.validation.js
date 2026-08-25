const Joi = require('joi');

// POST /solicitacoes/:id/avaliacoes
const criar = Joi.object({
  nota: Joi.number().integer().min(1).max(5).required().messages({
    'any.required': 'A nota é obrigatória',
    'number.base': 'A nota deve ser um número inteiro de 1 a 5',
    'number.integer': 'A nota deve ser um número inteiro de 1 a 5',
    'number.min': 'A nota deve ser de 1 a 5',
    'number.max': 'A nota deve ser de 1 a 5',
  }),
  comentario: Joi.string().trim().max(1000).allow('', null).messages({
    'string.max': 'O comentário deve ter no máximo 1000 caracteres',
  }),
});

module.exports = { criar };

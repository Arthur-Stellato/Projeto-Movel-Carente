const Joi = require('joi');
const { uuid } = require('./comuns');

// POST /favoritos
const adicionar = Joi.object({
  itemId: uuid.required().messages({
    'any.required': 'O itemId é obrigatório',
    'string.empty': 'O itemId é obrigatório',
  }),
});

module.exports = { adicionar };

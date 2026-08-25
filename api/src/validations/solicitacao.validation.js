const Joi = require('joi');
const { uuid } = require('./comuns');

// POST /solicitacoes — validação nova (antes o service nem checava o formato
// de itemId; um id malformado só quebraria mais tarde na consulta ao Prisma).
const criar = Joi.object({
  itemId: uuid.required().messages({
    'any.required': 'O itemId é obrigatório',
    'string.empty': 'O itemId é obrigatório',
  }),
  mensagem: Joi.string().trim().max(2000).allow('', null),
});

module.exports = { criar };

const Joi = require('joi');
const { uuid } = require('./comuns');
const { MOTIVOS_DENUNCIA_VALIDOS: MOTIVOS_VALIDOS } = require('../lib/validadores');

// POST /denuncias — mesma regra do CHECK que existe no banco (tipo item XOR
// tipo usuário): qual campo é obrigatório depende do valor de `tipo`, e o
// outro precisa vir ausente. Isso é uma regra de FORMATO do payload (não
// depende de consultar o banco), então cabe no Joi via `.when()`.
const criar = Joi.object({
  tipo: Joi.string().valid('item', 'usuario').required().messages({
    'any.only': 'Tipo de denúncia inválido. Use "item" ou "usuario"',
    'any.required': 'Tipo de denúncia inválido. Use "item" ou "usuario"',
    'string.empty': 'Tipo de denúncia inválido. Use "item" ou "usuario"',
  }),
  motivo: Joi.string().valid(...MOTIVOS_VALIDOS).required().messages({
    'any.only': `Motivo inválido. Use um de: ${MOTIVOS_VALIDOS.join(', ')}`,
    'any.required': `Motivo inválido. Use um de: ${MOTIVOS_VALIDOS.join(', ')}`,
    'string.empty': `Motivo inválido. Use um de: ${MOTIVOS_VALIDOS.join(', ')}`,
  }),
  itemId: uuid.when('tipo', {
    is: 'item',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }).messages({
    'any.unknown': 'itemId não deve ser informado quando o tipo da denúncia é "usuario"',
    'any.required': 'itemId é obrigatório quando o tipo da denúncia é "item"',
  }),
  usuarioDenunciadoId: uuid.when('tipo', {
    is: 'usuario',
    then: Joi.required(),
    otherwise: Joi.forbidden(),
  }).messages({
    'any.unknown': 'usuarioDenunciadoId não deve ser informado quando o tipo da denúncia é "item"',
    'any.required': 'usuarioDenunciadoId é obrigatório quando o tipo da denúncia é "usuario"',
  }),
  descricao: Joi.string().trim().max(2000).allow('', null),
});

// PATCH /denuncias/:id/analisar
const analisar = Joi.object({
  status: Joi.string().valid('procedente', 'improcedente').required().messages({
    'any.only': 'Status final deve ser "procedente" ou "improcedente"',
    'any.required': 'Status final deve ser "procedente" ou "improcedente"',
    'string.empty': 'Status final deve ser "procedente" ou "improcedente"',
  }),
  desativarItem: Joi.boolean(),
  desativarUsuario: Joi.boolean(),
});

module.exports = { criar, analisar };

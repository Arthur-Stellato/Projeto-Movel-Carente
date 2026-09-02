const Joi = require('joi');

const enviar = Joi.object({
  conteudo: Joi.string().trim().min(1).max(2000).messages({
    'string.empty': 'A mensagem não pode ser vazia',
    'string.min': 'A mensagem não pode ser vazia',
    'string.max': 'A mensagem deve ter no máximo 2000 caracteres',
  }),
  anexoUrl: Joi.string()
    .pattern(/^\/uploads\/mensagens\//)
    .messages({ 'string.pattern.base': 'anexoUrl inválido' }),
  anexoTipo: Joi.string().valid('imagem', 'video'),
})
  .and('anexoUrl', 'anexoTipo')
  .or('conteudo', 'anexoUrl')
  .messages({ 'object.missing': 'A mensagem precisa ter texto ou um anexo' });

// Fase 6: só o texto pode ser editado (o anexo é imutável — pra trocar de
// anexo, a ideia é apagar a mensagem e mandar outra). Por isso `conteudo` é
// obrigatório aqui, mesmo pra uma mensagem que hoje só tem anexo: editar
// significa sempre "definir/mudar o texto", nunca esvaziá-lo por completo.
const editar = Joi.object({
  conteudo: Joi.string().trim().min(1).max(2000).required().messages({
    'string.empty': 'A mensagem não pode ser vazia',
    'string.min': 'A mensagem não pode ser vazia',
    'string.max': 'A mensagem deve ter no máximo 2000 caracteres',
    'any.required': 'O conteúdo é obrigatório para editar a mensagem',
  }),
});

module.exports = { enviar, editar };

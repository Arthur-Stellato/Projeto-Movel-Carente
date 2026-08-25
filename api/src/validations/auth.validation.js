const Joi = require('joi');
const { senhaForte } = require('./comuns');

// POST /auth/login — só checa presença aqui. Formato de email e força de
// senha NÃO se aplicam no login: a senha pode ter sido criada sob regras
// antigas, e a mensagem de erro é sempre genérica por segurança (não revela
// se o problema foi o email ou a senha) — quem faz essa checagem final é o
// próprio auth.service, comparando o hash.
const login = Joi.object({
  email: Joi.string().trim().required(),
  senha: Joi.string().required(),
}).messages({
  'any.required': 'Email e senha são obrigatórios',
  'string.empty': 'Email e senha são obrigatórios',
});

// POST /auth/esqueci-senha e /auth/reenviar-verificacao — mesmo formato.
// Validação de formato aqui é só uma melhoria de UX (erro imediato em vez de
// esperar a resposta genérica); a resposta em si continua genérica de
// propósito nos dois casos, pra não revelar se a conta existe.
const emailParaAcao = Joi.object({
  email: Joi.string().trim().email({ tlds: false }).required().messages({
    'any.required': 'Email é obrigatório',
    'string.empty': 'Email é obrigatório',
    'string.email': 'Email inválido',
  }),
});

// POST /auth/redefinir-senha
const redefinirSenha = Joi.object({
  token: Joi.string().required(),
  novaSenha: senhaForte.required(),
}).messages({
  'any.required': 'Token e nova senha são obrigatórios',
  'string.empty': 'Token e nova senha são obrigatórios',
});

// POST /auth/verificar-email
const verificarEmail = Joi.object({
  token: Joi.string().required(),
}).messages({
  'any.required': 'Token é obrigatório',
  'string.empty': 'Token é obrigatório',
});

module.exports = { login, emailParaAcao, redefinirSenha, verificarEmail };

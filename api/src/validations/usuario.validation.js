const Joi = require('joi');
const { cpf, cnpj, cep, uf, email, senhaForte, telefone, genero } = require('./comuns');

// POST /auth/registro
const registro = Joi.object({
  email: email.required(),
  cpf,
  cnpj,
  senha: senhaForte.required(),
  primeiroNome: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Campos obrigatórios ausentes',
    'any.required': 'Campos obrigatórios ausentes',
    'string.max': 'Primeiro nome deve ter no máximo 100 caracteres',
  }),
  ultimoNome: Joi.string().trim().min(1).max(100).required().messages({
    'string.empty': 'Campos obrigatórios ausentes',
    'any.required': 'Campos obrigatórios ausentes',
    'string.max': 'Último nome deve ter no máximo 100 caracteres',
  }),
  telefone: telefone.allow('', null),
  // Opcional de propósito: quem não informar cai no default do banco
  // (prefiro_nao_dizer) — ninguém é obrigado a preencher isso pra se cadastrar.
  genero,
}).xor('cpf', 'cnpj').messages({
  'any.required': 'Campos obrigatórios ausentes',
  'string.empty': 'Campos obrigatórios ausentes',
  'object.missing': 'Informe CPF ou CNPJ',
  'object.xor': 'Informe CPF ou CNPJ, não os dois',
});

// PUT /usuarios/me — atualização parcial: qualquer campo pode ser omitido,
// mas se vier, precisa respeitar o mesmo limite de sempre. Vazio explícito
// ("") é rejeitado pro nome (não faz sentido apagar o próprio nome).
const atualizarPerfil = Joi.object({
  primeiroNome: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'Nome não pode ser vazio',
    'string.min': 'Nome não pode ser vazio',
    'string.max': 'Primeiro nome deve ter no máximo 100 caracteres',
  }),
  ultimoNome: Joi.string().trim().min(1).max(100).messages({
    'string.empty': 'Nome não pode ser vazio',
    'string.min': 'Nome não pode ser vazio',
    'string.max': 'Último nome deve ter no máximo 100 caracteres',
  }),
  telefone: telefone.allow('', null),
  genero,
});

// PATCH /usuarios/me/senha
const alterarSenha = Joi.object({
  senhaAtual: Joi.string().required().messages({
    'string.empty': 'Senha atual e nova senha são obrigatórias',
    'any.required': 'Senha atual e nova senha são obrigatórias',
  }),
  novaSenha: senhaForte.required().messages({
    'string.empty': 'Senha atual e nova senha são obrigatórias',
    'any.required': 'Senha atual e nova senha são obrigatórias',
  }),
});

// Campos de endereço compartilhados entre criar (tudo obrigatório) e atualizar
// (tudo opcional) — construídos a partir do mesmo bloco-base pra não divergir.
const camposEndereco = {
  cep,
  logradouro: Joi.string().trim().max(255).messages({ 'string.max': 'Campo "logradouro" deve ter no máximo 255 caracteres' }),
  numero: Joi.string().trim().max(20).allow('', null).messages({ 'string.max': 'Campo "numero" deve ter no máximo 20 caracteres' }),
  complemento: Joi.string().trim().max(100).allow('', null).messages({ 'string.max': 'Campo "complemento" deve ter no máximo 100 caracteres' }),
  bairro: Joi.string().trim().max(100).allow('', null).messages({ 'string.max': 'Campo "bairro" deve ter no máximo 100 caracteres' }),
  cidade: Joi.string().trim().max(100).messages({ 'string.max': 'Campo "cidade" deve ter no máximo 100 caracteres' }),
  estado: uf,
  pais: Joi.string().trim().max(50).allow('', null).messages({ 'string.max': 'Campo "pais" deve ter no máximo 50 caracteres' }),
  tipo: Joi.string().trim().max(20).allow('', null).messages({ 'string.max': 'Campo "tipo" deve ter no máximo 20 caracteres' }),
  principal: Joi.boolean(),
};

// POST /usuarios/me/enderecos
const criarEndereco = Joi.object({
  ...camposEndereco,
  cep: camposEndereco.cep.required(),
  logradouro: camposEndereco.logradouro.required(),
  cidade: camposEndereco.cidade.required(),
  estado: camposEndereco.estado.required(),
}).messages({
  'any.required': 'CEP, logradouro, cidade e estado são obrigatórios',
  'string.empty': 'CEP, logradouro, cidade e estado são obrigatórios',
});

// PUT /usuarios/me/enderecos/:id — todo campo é opcional (atualização parcial)
const atualizarEndereco = Joi.object(camposEndereco);

// GET /usuarios (admin) — filtros de query
const listarTodos = Joi.object({
  ativo: Joi.boolean(),
  tipo: Joi.string().valid('usuario', 'admin').messages({
    'any.only': 'Tipo inválido. Use "usuario" ou "admin"',
  }),
  pagina: Joi.any(),
  tamanho: Joi.any(),
});

module.exports = { registro, atualizarPerfil, alterarSenha, criarEndereco, atualizarEndereco, listarTodos };

const Joi = require('joi');
const { validarCpf, validarCnpj, validarCep, validarForcaSenha, ehEmailDescartavel, validarTelefone, UFS_VALIDAS, GENEROS_VALIDOS } = require('../lib/validadores');

// ============================================================
// Blocos reutilizáveis de Joi — cada um encapsula uma regra de formato usada
// em mais de um schema (email, CPF, senha, CEP, UF, UUID). Sempre que a regra
// já existia como função em lib/validadores.js (CPF, CEP, força de senha,
// domínio descartável), o schema aqui chama a MESMA função por baixo — evita
// duas implementações divergentes da mesma regra de negócio.
// ============================================================

// UUID de referência a outro recurso, vindo do corpo da requisição (ex: itemId
// dentro de POST /favoritos). Os :id de rota continuam validados pelo
// middleware validarUuidParam existente — esse aqui cobre os que vêm no body.
const uuid = Joi.string().guid({ version: ['uuidv1', 'uuidv4', 'uuidv5'] }).messages({
  // Joi já envolve {#label} em aspas por padrão — não duplicar aqui.
  'string.guid': '{#label} deve ser um identificador válido',
});

// Reaproveita o dígito verificador oficial (não é só checagem de tamanho).
const cpf = Joi.string()
  .custom((valor, helpers) => {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (!validarCpf(digitos)) return helpers.error('any.invalid');
    return digitos;
  })
  .messages({ 'any.invalid': 'CPF inválido' });

const cnpj = Joi.string()
  .custom((valor, helpers) => {
    const digitos = String(valor || '').replace(/\D/g, '');
    if (!validarCnpj(digitos)) return helpers.error('any.invalid');
    return digitos;
  })
  .messages({ 'any.invalid': 'CNPJ inválido' });

// Aceita CEP formatado (00000-000) ou só dígitos — validarCep já normaliza.
const cep = Joi.string()
  .custom((valor, helpers) => {
    if (!validarCep(valor)) return helpers.error('any.invalid');
    return valor;
  })
  .messages({ 'any.invalid': 'CEP inválido. Deve conter 8 dígitos' });

// Aceita minúscula/maiúscula e converte pra maiúscula antes de validar contra a lista de UFs.
const uf = Joi.string()
  .uppercase()
  .valid(...UFS_VALIDAS)
  .messages({
    'any.only': `Estado inválido. Use uma UF válida: ${UFS_VALIDAS.join(', ')}`,
  });

// Email: formato via validador embutido do Joi (mais completo que a regex manual
// que existia antes), + a mesma checagem de provedor descartável de sempre.
// tlds desativado de propósito — a checagem antiga não exigia um TLD "conhecido"
// (ex: domínios .local em ambiente de teste continuam passando).
const email = Joi.string()
  .trim()
  .lowercase()
  .email({ tlds: false })
  .max(255)
  .custom((valor, helpers) => {
    if (ehEmailDescartavel(valor)) return helpers.error('any.invalid');
    return valor;
  })
  .messages({
    'string.email': 'Email inválido',
    'string.max': 'Email deve ter no máximo 255 caracteres',
    'any.invalid': 'Não aceitamos emails de provedores temporários/descartáveis. Use um email de verdade.',
  });

// Mesma composição de senha de sempre (maiúscula+minúscula+número+especial+8 chars),
// centralizada em validarForcaSenha — aqui só plugamos ela no Joi.
const senhaForte = Joi.string()
  .custom((valor, helpers) => {
    const erro = validarForcaSenha(valor);
    if (erro) return helpers.error('any.invalid', { erro });
    return valor;
  })
  .messages({ 'any.invalid': '{{#erro}}' });

// Aceita fixo/celular brasileiro formatado ou não, com ou sem +55 — sempre
// devolve normalizado em E.164 (ver validarTelefone). Rejeita número válido
// de OUTRO país (ex: alguém digita um número americano) — o "DDD" mencionado
// no pedido original é conceito exclusivamente brasileiro, então essa
// validação é propositalmente restrita a números do Brasil.
const telefone = Joi.string()
  .custom((valor, helpers) => {
    const formatado = validarTelefone(valor);
    if (!formatado) return helpers.error('any.invalid');
    return formatado;
  })
  .messages({ 'any.invalid': 'Telefone inválido. Use um número brasileiro válido, com DDD' });

// "prefiro_nao_dizer" é um valor tão válido quanto os outros — nunca opcional
// aqui só por si (quem quer omitir/recusar responder usa esse valor, não
// deixa o campo de fora). Cada schema que usa este bloco decide se o campo em
// si é obrigatório ou opcional (registro x atualização de perfil, por exemplo).
const genero = Joi.string()
  .valid(...GENEROS_VALIDOS)
  .messages({
    'any.only': `Gênero inválido. Use um destes: ${GENEROS_VALIDOS.join(', ')}`,
  });

module.exports = { uuid, cpf, cnpj, cep, uf, email, senhaForte, telefone, genero };

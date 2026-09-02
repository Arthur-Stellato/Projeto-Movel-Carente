// Valida CPF pelo algoritmo oficial do dígito verificador — não apenas o formato/tamanho.
// Retorna true/false. Não confirma que o CPF existe de verdade na Receita Federal,
// só que a sequência de dígitos é matematicamente consistente (o que já barra a
// esmagadora maioria de tentativas de cadastro com CPF inventado).
function validarCpf(cpf) {
  const digitos = String(cpf || '').replace(/\D/g, '');

  if (digitos.length !== 11) return false;

  // Sequências repetidas (00000000000, 11111111111, ...) passam no cálculo do dígito
  // verificador, mas nunca são CPFs reais — precisam ser rejeitadas à parte.
  if (/^(\d)\1{10}$/.test(digitos)) return false;

  const calcularDigitoVerificador = (quantidadeDigitosBase) => {
    let soma = 0;
    for (let i = 0; i < quantidadeDigitosBase; i++) {
      soma += parseInt(digitos[i], 10) * (quantidadeDigitosBase + 1 - i);
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiroDigito = calcularDigitoVerificador(9);
  if (primeiroDigito !== parseInt(digitos[9], 10)) return false;

  const segundoDigito = calcularDigitoVerificador(10);
  if (segundoDigito !== parseInt(digitos[10], 10)) return false;

  return true;
}

// Valida CNPJ pelo algoritmo oficial dos dois dígitos verificadores. Assim
// como o CPF, isso confirma a consistência matemática, não a existência do
// cadastro na Receita Federal.
function validarCnpj(cnpj) {
  const digitos = String(cnpj || '').replace(/\D/g, '');

  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;

  const calcularDigitoVerificador = (pesos) => {
    const soma = pesos.reduce((total, peso, indice) => total + (Number(digitos[indice]) * peso), 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };

  const primeiroDigito = calcularDigitoVerificador([5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  if (primeiroDigito !== Number(digitos[12])) return false;

  const segundoDigito = calcularDigitoVerificador([6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return segundoDigito === Number(digitos[13]);
}

// Checagem pragmática de formato — não tenta cobrir toda a complexidade do RFC 5322
// (isso é notoriamente sobrecarregado e permite endereços tecnicamente válidos mas
// inúteis na prática). O objetivo aqui é só barrar erro de digitação óbvio (sem @,
// sem domínio) antes de gastar um envio de email de verificação com ele. A validação
// que realmente importa é a própria verificação por email, que o projeto já faz.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validarEmail(email) {
  return EMAIL_REGEX.test(String(email || '').trim());
}

// Sem isso, "Joana@Exemplo.com" no cadastro e "joana@exemplo.com" no login seriam
// tratados como contas diferentes (comparação de string é case-sensitive por padrão
// no Postgres) — um bug real de usabilidade, não só um detalhe cosmético. Usado tanto
// na hora de gravar quanto na hora de consultar, pra manter os dois lados consistentes.
function normalizarEmail(email) {
  return String(email || '').trim().toLowerCase();
}

// Domínios de serviços feitos especificamente pra gerar email temporário/descartável
// (a caixa de entrada expira em minutos, sem dono de verdade) — usados quase sempre
// pra burlar cadastro, nunca pra comunicação real. Lista não exaustiva por natureza
// (novos serviços desse tipo aparecem o tempo todo), mas cobre os mais conhecidos.
//
// Escolha deliberada: BLOQUEIA só provedores conhecidos por serem descartáveis, em vez
// de PERMITIR só uma lista fechada de provedores "confiáveis" (gmail, hotmail...) —
// a segunda abordagem recusaria gente legítima usando domínio próprio, email
// corporativo/institucional ou qualquer provedor fora da lista, sem realmente barrar
// quem quer abusar (é trivial criar um Gmail de verdade em minutos).
const DOMINIOS_EMAIL_DESCARTAVEL = new Set([
  'mailinator.com', 'mailinator.net', 'mailinator.org',
  'guerrillamail.com', 'guerrillamail.info', 'guerrillamail.net', 'guerrillamail.org',
  'sharklasers.com', 'grr.la',
  '10minutemail.com', '10minutemail.net',
  'tempmail.com', 'temp-mail.org', 'temp-mail.io',
  'throwawaymail.com', 'trashmail.com', 'fakeinbox.com',
  'yopmail.com', 'yopmail.net', 'yopmail.fr',
  'getnada.com', 'dispostable.com', 'maildrop.cc',
  'mintemail.com', 'mailnesia.com', 'moakt.com', 'emailondeck.com',
  'discard.email', 'discardmail.com',
]);

// Confere só o domínio (o que vem depois do @) contra a lista de descartáveis —
// não valida formato (isso é papel de validarEmail); espera receber um email já
// validado/normalizado.
function ehEmailDescartavel(email) {
  const dominio = String(email || '').trim().toLowerCase().split('@')[1];
  return dominio ? DOMINIOS_EMAIL_DESCARTAVEL.has(dominio) : false;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validarUuid(valor) {
  return UUID_REGEX.test(valor);
}

const { parsePhoneNumberFromString } = require('libphonenumber-js');

function apenasDigitos(valor) {
  return String(valor || '').replace(/\D/g, '');
}

// Diferente dos outros validarX (que devolvem só true/false — quem chama faz
// a formatação à parte, ex: apenasDigitos pro CPF), aqui devolver só um
// boolean obrigaria reprocessar o número duas vezes: uma pra validar, outra
// pra formatar — as duas coisas saem do MESMO parse. Por isso esse aqui
// devolve o número já em E.164 quando válido, ou null quando não é um
// telefone brasileiro válido. Mesmo espírito do validarForcaSenha (que
// também devolve mais que um boolean pelo mesmo motivo: uma chamada só).
//
// Aceita fixo (8 dígitos) ou celular (9 dígitos) com DDD, formatado ou não,
// com ou sem o +55 na frente — tudo isso o libphonenumber-js já resolve
// sozinho ao assumir 'BR' como região padrão.
function validarTelefone(valor) {
  const numero = parsePhoneNumberFromString(String(valor || ''), 'BR');
  if (!numero || !numero.isValid() || numero.country !== 'BR') {
    return null;
  }
  return numero.number; // formato E.164, ex: +5511999998888
}

function validarCep(cep) {
  const digitos = String(cep || '').replace(/\D/g, '');
  return digitos.length === 8;
}

// Lista fixa das 27 UFs (26 estados + DF), espelhando o enum `UF` do schema.prisma.
// Mantida como constante aqui (em vez de `Object.values(require('@prisma/client').UF)`)
// para não depender do Prisma Client gerado — os services que validam UF importam
// dessa constante, o que permite rodar os testes sem `prisma generate`.
const UFS_VALIDAS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

// Motivos fixos de denúncia — mesma ideia do UFS_VALIDAS acima: uma única fonte
// da verdade usada tanto pela validação Joi (formato do payload) quanto pelo
// denuncia.service.js (montagem do filtro/mensagem), sem duplicar a lista.
const MOTIVOS_DENUNCIA_VALIDOS = [
  'conteudo_impropio',
  'golpe',
  'spam',
  'item_nao_condiz',
  'comportamento_abusivo',
  'outro',
];

// Mesma ideia de novo: fonte única, sem depender de `{ Genero } from '@prisma/client'`
// (que não existe gerado no sandbox de testes — ver comentário do UFS_VALIDAS acima
// sobre esse mesmo problema já ter mordido este projeto antes com UF).
const GENEROS_VALIDOS = ['masculino', 'feminino', 'prefiro_nao_dizer', 'outro'];

const REGRAS_SENHA = {
  tamanhoMinimo: 8,
  maiuscula: /[A-Z]/,
  minuscula: /[a-z]/,
  numero: /[0-9]/,
  // Qualquer caractere que não seja letra ou número conta como "especial"
  // (pontuação, símbolo, espaço, acento, emoji...) — não exige um conjunto fixo.
  especial: /[^A-Za-z0-9]/,
};

// Valida a força da senha e devolve a mensagem de erro pronta pra jogar na exceção
// do domínio (ou `null` se a senha atende todas as regras). Centralizado aqui porque
// as mesmas regras valem em três lugares diferentes: cadastro, troca de senha, e
// redefinição de senha esquecida — sem isso, seria fácil os três divergirem com o
// tempo (ex: alguém corrige a regra num lugar e esquece dos outros dois).
//
// NOTA: exigir maiúscula+especial (composição) é uma escolha de produto, não uma
// recomendação de segurança sem ressalvas — o NIST SP 800-63B hoje recomenda o
// oposto (senha longa + checagem contra vazamentos conhecidos, sem regra de
// composição obrigatória, já que isso empurra pra padrões previsíveis tipo
// "Senha123!"). Mantido assim porque foi uma decisão explícita do projeto.
function validarForcaSenha(senha) {
  if (!senha) return 'A senha é obrigatória';

  const requisitosFaltando = [];
  if (senha.length < REGRAS_SENHA.tamanhoMinimo) {
    requisitosFaltando.push(`no mínimo ${REGRAS_SENHA.tamanhoMinimo} caracteres`);
  }
  if (!REGRAS_SENHA.maiuscula.test(senha)) requisitosFaltando.push('uma letra maiúscula');
  if (!REGRAS_SENHA.minuscula.test(senha)) requisitosFaltando.push('uma letra minúscula');
  if (!REGRAS_SENHA.numero.test(senha)) requisitosFaltando.push('um número');
  if (!REGRAS_SENHA.especial.test(senha)) requisitosFaltando.push('um caractere especial');

  if (requisitosFaltando.length === 0) return null;
  return `A senha deve ter ${requisitosFaltando.join(', ')}`;
}

module.exports = {
  apenasDigitos,
  validarCpf,
  validarCnpj,
  validarTelefone,
  validarCep,
  validarUuid,
  validarForcaSenha,
  validarEmail,
  normalizarEmail,
  ehEmailDescartavel,
  UFS_VALIDAS,
  MOTIVOS_DENUNCIA_VALIDOS,
  GENEROS_VALIDOS,
};

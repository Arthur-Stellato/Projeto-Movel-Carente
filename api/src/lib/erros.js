const logger = require('./logger');

// Classe base para os erros "esperados" de cada domínio de negócio (usuário, item,
// categoria, solicitação, etc). Antes, cada service tinha sua própria classe com o
// mesmo corpo copiado 8 vezes:
//
//   class ErroX extends Error {
//     constructor(mensagem, status = 400) { super(mensagem); this.status = status; }
//   }
//
// Agora cada service só declara `class ErroX extends ErroDominio {}` — mantém a
// identidade própria (ErroItem !== ErroUsuario, então dá pra checar tipo específico
// se algum dia precisar), mas sem repetir o construtor.
class ErroDominio extends Error {
  constructor(mensagem, status = 400) {
    super(mensagem);
    this.status = status;
  }
}

// Mapeia os códigos de erro mais comuns do Prisma (violação de constraint) pra
// respostas HTTP sensatas, em vez de cair sempre no 500 genérico. Isso só entra em
// ação quando uma constraint do BANCO pega algo que a validação manual do service
// não pegou antes (ex: condição de corrida entre duas requisições simultâneas) —
// hoje isso não deveria acontecer, já que cada service confere duplicidade/posse
// manualmente antes de escrever, mas é uma rede de segurança caso algum caso passe
// batido no futuro.
//
// Detecção por `err.name` (em vez de `instanceof Prisma.PrismaClientKnownRequestError`)
// de propósito: o Prisma define esse `name` diretamente na instância do erro, então
// funciona independente de como o `@prisma/client` gerado reexporta o namespace `Prisma`.
function tratarErroPrisma(err, res) {
  switch (err.code) {
    case 'P2002': {
      // Violação de unique constraint
      const campos = err.meta?.target;
      const campoTexto = Array.isArray(campos) ? campos.join(', ') : campos || 'um campo único';
      return res.status(409).json({ erro: `Já existe um registro com ${campoTexto} igual a esse` });
    }
    case 'P2003':
      // Violação de foreign key (referência a um registro que não existe/foi removido)
      return res.status(409).json({ erro: 'Referência inválida: o registro relacionado não existe' });
    case 'P2025':
      // Registro que a operação esperava encontrar (update/delete) não existe
      return res.status(404).json({ erro: 'Registro não encontrado' });
    default:
      logger.error({ err }, 'Erro do Prisma não mapeado explicitamente');
      return res.status(500).json({ erro: 'Erro interno do servidor' });
  }
}

// Handler de erro genérico usado por todo controller — antes, cada um dos 8
// controllers tinha sua própria cópia disso, checando só a classe do seu domínio:
//
//   function tratarErro(err, res) {
//     if (err instanceof itemService.ErroItem) return res.status(err.status).json({erro: err.message});
//     console.error(err);
//     return res.status(500).json({ erro: 'Erro interno do servidor' });
//   }
//
// Como todo ErroX agora herda de ErroDominio, um único `instanceof ErroDominio` cobre
// os 8 domínios de uma vez — não precisa mais saber qual classe específica checar.
function tratarErroController(err, res) {
  if (err instanceof ErroDominio) {
    return res.status(err.status).json({ erro: err.message });
  }
  if (err && err.name === 'PrismaClientKnownRequestError') {
    return tratarErroPrisma(err, res);
  }
  logger.error({ err }, 'Erro não tratado');
  return res.status(500).json({ erro: 'Erro interno do servidor' });
}

module.exports = { ErroDominio, tratarErroController };
// Validação de variáveis de ambiente obrigatórias, rodada uma vez na subida do
// servidor (chamada em server.js, ANTES de app.js ser carregado). O objetivo é
// falhar rápido e com mensagem clara — sem isso, o servidor sobe normalmente
// ("Servidor rodando na porta 3000") e só quebra de um jeito confuso na primeira
// requisição que realmente precisar da variável faltando (foi exatamente o que
// aconteceu com um DATABASE_URL malformado: o app subiu limpo, e só o primeiro
// GET /categorias revelou o problema, com um erro do Prisma difícil de rastrear
// até a causa real).
const OBRIGATORIAS = ['DATABASE_URL', 'JWT_SECRET'];

function validarVariaveisDeAmbiente() {
  const faltando = OBRIGATORIAS.filter((chave) => !process.env[chave] || !process.env[chave].trim());

  if (faltando.length > 0) {
    console.error('Variáveis de ambiente obrigatórias ausentes ou vazias:');
    faltando.forEach((chave) => console.error(`   - ${chave}`));
    console.error('Confira o arquivo .env (use .env.example como referência) e tente novamente.');
    process.exit(1);
    return; // process.exit() não interrompe o fluxo da função sozinho — só agenda o encerramento do processo
  }

  // Aviso, não trava a subida — em desenvolvimento pode ser aceitável ter um
  // segredo mais curto só pra testar rápido, mas nunca deveria ir assim pra produção.
  if (process.env.JWT_SECRET.length < 16) {
    console.warn('JWT_SECRET está curto (menos de 16 caracteres) — use um valor mais forte em produção.');
  }
}

module.exports = { validarVariaveisDeAmbiente };
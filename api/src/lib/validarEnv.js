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

  // Um HMAC-SHA256 (o algoritmo usado para assinar o JWT, ver src/lib/token.js)
  // se beneficia de pelo menos 32 caracteres de segredo (~256 bits, quando bem
  // aleatório) — abaixo disso, o aviso sempre aparece. Em produção isso vira
  // motivo de travar a subida de verdade: um JWT_SECRET fraco permite forjar
  // token de acesso por força bruta, e um `console.warn` sozinho é fácil
  // demais de passar despercebido num log de deploy.
  const TAMANHO_MINIMO_RECOMENDADO = 32;
  if (process.env.JWT_SECRET.length < TAMANHO_MINIMO_RECOMENDADO) {
    if (process.env.NODE_ENV === 'production') {
      console.error(`JWT_SECRET tem menos de ${TAMANHO_MINIMO_RECOMENDADO} caracteres — inseguro para produção.`);
      console.error('Gere um valor forte, por exemplo: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
      process.exit(1);
      return;
    }
    console.warn(`JWT_SECRET está curto (menos de ${TAMANHO_MINIMO_RECOMENDADO} caracteres) — use um valor mais forte em produção.`);
  }
}

module.exports = { validarVariaveisDeAmbiente };
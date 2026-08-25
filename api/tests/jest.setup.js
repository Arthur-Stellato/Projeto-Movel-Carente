// Carregado automaticamente antes de cada arquivo de teste (setupFilesAfterEnv, ver jest.config.js).
//
// jest.mock() aqui, sem factory, faz o Jest resolver automaticamente o mock manual
// que mora em __mocks__ ao lado de cada módulo real (src/lib/__mocks__/prisma.js etc).
// Isso vale pra todo teste da suíte, sem precisar repetir o jest.mock(...) em cada arquivo.
jest.mock('../src/lib/prisma');
jest.mock('../src/config/rateLimiter');
jest.mock('../src/queues/email.queue');

// Variáveis de ambiente que o código espera existir (JWT, principalmente).
// NODE_ENV=test faz auth.service devolver o token de recuperação/verificação
// direto na resposta (mesma branch usada em dev), o que os testes usam pra
// não precisar inspecionar e-mail nenhum.
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'segredo-de-teste-nao-usar-em-producao';
process.env.JWT_EXPIRES_IN = '15m';

const prisma = require('../src/lib/prisma');
const { enfileirarEmail } = require('../src/queues/email.queue');

// Garante que nenhum retorno/chamada configurado (mockResolvedValue, chamadas
// registradas etc.) de um teste vaze para o próximo — cada teste começa "limpo".
afterEach(() => {
  prisma.__resetTodosOsMocks();
  enfileirarEmail.mockClear();
});
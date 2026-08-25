// Mock manual do Prisma Client, usado automaticamente sempre que um teste (via
// tests/jest.setup.js) chama jest.mock('../../src/lib/prisma'). Isso contorna a
// limitação de o @prisma/client não conseguir gerar binário no sandbox, e também
// é a prática correta para testes de unidade/integração rápidos, sem banco real.
//
// Cada método de cada model é um jest.fn() — por padrão resolve `undefined`.
// Cada teste configura o retorno específico com .mockResolvedValue(...) /
// .mockRejectedValue(...) antes de exercitar o service.

function criarModelMock(metodos) {
  const model = {};
  for (const metodo of metodos) {
    model[metodo] = jest.fn();
  }
  return model;
}

const METODOS_PADRAO = ['findUnique', 'findFirst', 'findMany', 'create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'count'];

const prisma = {
  usuario: criarModelMock(METODOS_PADRAO),
  endereco: criarModelMock(METODOS_PADRAO),
  tokenUsuario: criarModelMock(METODOS_PADRAO),
  refreshToken: criarModelMock(METODOS_PADRAO),
  contaOauth: criarModelMock(METODOS_PADRAO),
  logAuditoria: criarModelMock(METODOS_PADRAO),
  categoria: criarModelMock(METODOS_PADRAO),
  itemDoacao: criarModelMock(METODOS_PADRAO),
  imagemItem: criarModelMock(METODOS_PADRAO),
  solicitacaoItem: criarModelMock(METODOS_PADRAO),
  notificacao: criarModelMock(METODOS_PADRAO),
  denuncia: criarModelMock(METODOS_PADRAO),
  favorito: criarModelMock(METODOS_PADRAO),
  avaliacao: criarModelMock(METODOS_PADRAO),
  eventoOutbox: criarModelMock(METODOS_PADRAO),
  cepCache: criarModelMock(METODOS_PADRAO),
  cidadeCentroide: criarModelMock(METODOS_PADRAO),

  // Suporta os dois estilos de uso do Prisma: array de operações (o único usado
  // neste projeto — ex: `prisma.$transaction([prisma.x.update(...), prisma.y.count(...)])`)
  // e a forma de callback interativo, por segurança caso apareça no futuro.
  $transaction: jest.fn(async (arg) => {
    if (typeof arg === 'function') {
      return arg(prisma);
    }
    return Promise.all(arg);
  }),
  // Usado só pelo /health/ready pra checar se o Postgres está acessível. Chamado
  // como template tag (prisma.$queryRaw`SELECT 1`) — um jest.fn() comum funciona
  // normalmente como tag function, recebendo o array de strings como argumento.
  $queryRaw: jest.fn(),
  // Usado pela busca geográfica por raio (PostGIS) — SQL construído como string
  // (ver src/services/item.service.js: listarPorRaio) porque Prisma.sql/join não
  // ficam disponíveis sem o client gerado (não gera nesse sandbox). Os valores
  // são sempre passados como parâmetros posicionais separados, nunca interpolados
  // direto na string — protege contra SQL injection do mesmo jeito que Prisma.sql faria.
  $queryRawUnsafe: jest.fn(),
  $disconnect: jest.fn(),
  $connect: jest.fn(),
};

// Reseta todas as chamadas/retornos configurados entre testes (chamado pelo jest.setup.js
// em um afterEach global, pra um teste nunca herdar mock de retorno configurado por outro).
prisma.__resetTodosOsMocks = () => {
  for (const chave of Object.keys(prisma)) {
    const model = prisma[chave];
    if (model && typeof model === 'object') {
      for (const metodo of Object.keys(model)) {
        if (typeof model[metodo]?.mockReset === 'function') {
          model[metodo].mockReset();
        }
      }
    }
  }
  prisma.$transaction.mockClear();
  prisma.$queryRaw.mockReset();
  prisma.$queryRawUnsafe.mockReset();
};

module.exports = prisma;
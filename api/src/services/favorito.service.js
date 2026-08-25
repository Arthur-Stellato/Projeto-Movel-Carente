const prisma = require('../lib/prisma');
const { normalizarPaginacao } = require('../lib/paginacao');

const PAGINA_TAMANHO_PADRAO = 20;

const { ErroDominio } = require('../lib/erros');
class ErroFavorito extends ErroDominio {}

// Presença/formato de itemId já são checados pelo Joi na rota (POST /favoritos).
async function adicionar(usuarioId, itemId) {
  const item = await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } });
  if (!item) throw new ErroFavorito('Item não encontrado', 404);

  const jaExiste = await prisma.favorito.findUnique({
    where: { usuarioId_itemId: { usuarioId, itemId } },
  });
  if (jaExiste) {
    throw new ErroFavorito('Este item já está nos seus favoritos', 409);
  }

  return prisma.favorito.create({ data: { usuarioId, itemId } });
}

async function remover(usuarioId, itemId) {
  const favorito = await prisma.favorito.findUnique({
    where: { usuarioId_itemId: { usuarioId, itemId } },
  });
  if (!favorito) {
    throw new ErroFavorito('Este item não está nos seus favoritos', 404);
  }

  await prisma.favorito.delete({ where: { id: favorito.id } });
}

async function listar(usuarioId, { pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [favoritos, total] = await prisma.$transaction([
    prisma.favorito.findMany({
      where: { usuarioId },
      include: {
        item: {
          include: {
            categoria: true,
            imagens: { orderBy: { ordem: 'asc' }, take: 1 },
            doador: { select: { id: true, primeiroNome: true, ultimoNome: true } },
          },
        },
      },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.favorito.count({ where: { usuarioId } }),
  ]);

  return { favoritos, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function verificar(usuarioId, itemId) {
  const favorito = await prisma.favorito.findUnique({
    where: { usuarioId_itemId: { usuarioId, itemId } },
  });
  return Boolean(favorito);
}

module.exports = { ErroFavorito, adicionar, remover, listar, verificar };
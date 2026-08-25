const prisma = require('../lib/prisma');
const { normalizarPaginacao } = require('../lib/paginacao');

const PAGINA_TAMANHO_PADRAO = 20;

const { ErroDominio } = require('../lib/erros');
class ErroNotificacao extends ErroDominio {}

async function listar(usuarioId, { apenasNaoLidas = false, pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const where = { usuarioId };
  if (apenasNaoLidas === true || apenasNaoLidas === 'true') where.lida = false;

  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [notificacoes, total] = await prisma.$transaction([
    prisma.notificacao.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.notificacao.count({ where }),
  ]);

  return { notificacoes, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function contarNaoLidas(usuarioId) {
  const total = await prisma.notificacao.count({ where: { usuarioId, lida: false } });
  return { naoLidas: total };
}

async function marcarComoLida(notificacaoId, usuarioId) {
  const notificacao = await prisma.notificacao.findUnique({ where: { id: notificacaoId } });
  if (!notificacao) throw new ErroNotificacao('Notificação não encontrada', 404);
  if (notificacao.usuarioId !== usuarioId) {
    throw new ErroNotificacao('Você não tem permissão para alterar essa notificação', 403);
  }

  return prisma.notificacao.update({ where: { id: notificacaoId }, data: { lida: true } });
}

async function marcarTodasComoLidas(usuarioId) {
  await prisma.notificacao.updateMany({
    where: { usuarioId, lida: false },
    data: { lida: true },
  });
}

async function remover(notificacaoId, usuarioId) {
  const notificacao = await prisma.notificacao.findUnique({ where: { id: notificacaoId } });
  if (!notificacao) throw new ErroNotificacao('Notificação não encontrada', 404);
  if (notificacao.usuarioId !== usuarioId) {
    throw new ErroNotificacao('Você não tem permissão para remover essa notificação', 403);
  }

  await prisma.notificacao.delete({ where: { id: notificacaoId } });
}

module.exports = {
  ErroNotificacao,
  listar,
  contarNaoLidas,
  marcarComoLida,
  marcarTodasComoLidas,
  remover,
};
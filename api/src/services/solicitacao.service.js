const prisma = require('../lib/prisma');
const { normalizarPaginacao } = require('../lib/paginacao');

const PAGINA_TAMANHO_PADRAO = 20;

const { ErroDominio } = require('../lib/erros');
class ErroSolicitacao extends ErroDominio {}

// Cria uma notificação simples (a listagem/marcação como lida vem no módulo de notificações,
// mas já gravamos aqui pra não perder o evento — quando aquele módulo existir, isso já funciona).
async function notificar(usuarioId, tipo, titulo, mensagem, referenciaId) {
  await prisma.notificacao.create({
    data: { usuarioId, tipo, titulo, mensagem, referenciaId },
  });
}

async function criar(solicitanteId, itemId, mensagem) {
  const item = await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } });
  if (!item) throw new ErroSolicitacao('Item não encontrado', 404);

  if (item.doadorId === solicitanteId) {
    throw new ErroSolicitacao('Você não pode solicitar o próprio item', 403);
  }
  if (item.status !== 'disponivel') {
    throw new ErroSolicitacao(`Este item não está mais disponível (status: ${item.status})`, 409);
  }

  const jaSolicitou = await prisma.solicitacaoItem.findUnique({
    where: { itemId_solicitanteId: { itemId, solicitanteId } },
  });
  if (jaSolicitou) {
    throw new ErroSolicitacao('Você já solicitou esse item', 409);
  }

  const solicitacao = await prisma.solicitacaoItem.create({
    data: { itemId, solicitanteId, mensagem },
  });

  await notificar(
    item.doadorId,
    'nova_solicitacao',
    'Nova solicitação recebida',
    `Alguém se interessou pelo seu item "${item.titulo}"`,
    solicitacao.id
  );

  return solicitacao;
}

async function listarPorItem(itemId, usuarioId, ehAdmin, { pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const item = await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } });
  if (!item) throw new ErroSolicitacao('Item não encontrado', 404);
  if (item.doadorId !== usuarioId && !ehAdmin) {
    throw new ErroSolicitacao('Você não tem permissão para ver as solicitações desse item', 403);
  }

  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [solicitacoes, total] = await prisma.$transaction([
    prisma.solicitacaoItem.findMany({
      where: { itemId },
      include: { solicitante: { select: { id: true, primeiroNome: true, ultimoNome: true } } },
      orderBy: { criadoEm: 'asc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.solicitacaoItem.count({ where: { itemId } }),
  ]);

  return { solicitacoes, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function minhasSolicitacoes(usuarioId, { pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [solicitacoes, total] = await prisma.$transaction([
    prisma.solicitacaoItem.findMany({
      where: { solicitanteId: usuarioId },
      include: {
        item: { include: { imagens: { orderBy: { ordem: 'asc' }, take: 1 }, categoria: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.solicitacaoItem.count({ where: { solicitanteId: usuarioId } }),
  ]);

  return { solicitacoes, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function buscarSolicitacaoComItem(solicitacaoId) {
  const solicitacao = await prisma.solicitacaoItem.findUnique({
    where: { id: solicitacaoId },
    include: { item: true },
  });
  if (!solicitacao) throw new ErroSolicitacao('Solicitação não encontrada', 404);
  return solicitacao;
}

async function aceitar(solicitacaoId, usuarioId, ehAdmin) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  const item = solicitacao.item;

  if (item.doadorId !== usuarioId && !ehAdmin) {
    throw new ErroSolicitacao('Você não tem permissão para responder essa solicitação', 403);
  }
  if (solicitacao.status !== 'pendente') {
    throw new ErroSolicitacao(`Essa solicitação já foi respondida (status: ${solicitacao.status})`, 409);
  }
  if (item.status !== 'disponivel') {
    throw new ErroSolicitacao('Este item não está mais disponível para aceitar solicitações', 409);
  }

  const outrasPendentes = await prisma.solicitacaoItem.findMany({
    where: { itemId: item.id, status: 'pendente', id: { not: solicitacaoId } },
  });

  const [resSolicitacao, resItem] = await prisma.$transaction([
    prisma.solicitacaoItem.updateMany({
      where: { id: solicitacaoId, status: 'pendente' },
      data: { status: 'aceita', respondidoEm: new Date() },
    }),
    prisma.itemDoacao.updateMany({
      where: { id: item.id, status: 'disponivel' },
      data: { status: 'reservado' },
    }),
    prisma.solicitacaoItem.updateMany({
      where: { itemId: item.id, status: 'pendente', id: { not: solicitacaoId } },
      data: { status: 'recusada', respondidoEm: new Date() },
    }),
  ]);

  if ((resSolicitacao?.count ?? 1) === 0 || (resItem?.count ?? 1) === 0) {
    throw new ErroSolicitacao('Este item ou solicitação não está mais disponível', 409);
  }

  await notificar(
    solicitacao.solicitanteId,
    'solicitacao_aceita',
    'Sua solicitação foi aceita!',
    `O doador aceitou sua solicitação para "${item.titulo}". Combine a retirada.`,
    solicitacao.id
  );

  for (const outra of outrasPendentes) {
    await notificar(
      outra.solicitanteId,
      'solicitacao_recusada',
      'Solicitação não aceita',
      `O item "${item.titulo}" foi reservado para outra pessoa.`,
      outra.id
    );
  }
}

async function recusar(solicitacaoId, usuarioId, ehAdmin) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  const item = solicitacao.item;

  if (item.doadorId !== usuarioId && !ehAdmin) {
    throw new ErroSolicitacao('Você não tem permissão para responder essa solicitação', 403);
  }
  if (solicitacao.status !== 'pendente') {
    throw new ErroSolicitacao(`Essa solicitação já foi respondida (status: ${solicitacao.status})`, 409);
  }

  await prisma.solicitacaoItem.update({
    where: { id: solicitacaoId },
    data: { status: 'recusada', respondidoEm: new Date() },
  });

  await notificar(
    solicitacao.solicitanteId,
    'solicitacao_recusada',
    'Solicitação recusada',
    `O doador recusou sua solicitação para "${item.titulo}".`,
    solicitacao.id
  );
}

async function cancelar(solicitacaoId, solicitanteId) {
  const solicitacao = await prisma.solicitacaoItem.findUnique({ where: { id: solicitacaoId } });
  if (!solicitacao) throw new ErroSolicitacao('Solicitação não encontrada', 404);

  if (solicitacao.solicitanteId !== solicitanteId) {
    throw new ErroSolicitacao('Você não tem permissão para cancelar essa solicitação', 403);
  }
  if (solicitacao.status !== 'pendente') {
    throw new ErroSolicitacao('Só é possível cancelar solicitações pendentes', 409);
  }

  await prisma.solicitacaoItem.update({
    where: { id: solicitacaoId },
    data: { status: 'cancelada', respondidoEm: new Date() },
  });
}

async function concluir(solicitacaoId, usuarioId, ehAdmin) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  const item = solicitacao.item;

  if (item.doadorId !== usuarioId && !ehAdmin) {
    throw new ErroSolicitacao('Você não tem permissão para concluir essa doação', 403);
  }
  if (solicitacao.status !== 'aceita') {
    throw new ErroSolicitacao('Só é possível concluir uma solicitação já aceita', 409);
  }
  if (item.status !== 'reservado') {
    throw new ErroSolicitacao(`O item precisa estar "reservado" para ser concluído (status atual: ${item.status})`, 409);
  }

  await prisma.itemDoacao.update({ where: { id: item.id }, data: { status: 'doado' } });

  await notificar(
    solicitacao.solicitanteId,
    'sistema',
    'Doação concluída',
    `A doação de "${item.titulo}" foi marcada como concluída. Obrigado por fazer parte disso!`,
    item.id
  );
}

module.exports = {
  ErroSolicitacao,
  criar,
  listarPorItem,
  minhasSolicitacoes,
  aceitar,
  recusar,
  cancelar,
  concluir,
};
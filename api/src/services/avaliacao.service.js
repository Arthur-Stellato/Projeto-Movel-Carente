const prisma = require('../lib/prisma');
const { normalizarPaginacao } = require('../lib/paginacao');
const { ErroDominio } = require('../lib/erros');

class ErroAvaliacao extends ErroDominio {}

const PAGINA_TAMANHO_PADRAO = 20;

// Janela de revelação do double-blind: se só um dos lados avaliou, a nota dele
// fica escondida do outro por até esse tempo — depois disso é revelada mesmo
// que a contraparte nunca avalie. Combinado com Yakino: 3 dias (mais rápido
// que os 14 dias "padrão de mercado" pra não travar o fluxo de teste/demo).
const JANELA_REVELACAO_DIAS = 3;
const JANELA_REVELACAO_MS = JANELA_REVELACAO_DIAS * 24 * 60 * 60 * 1000;

async function buscarSolicitacaoComItem(solicitacaoId) {
  const solicitacao = await prisma.solicitacaoItem.findUnique({
    where: { id: solicitacaoId },
    include: { item: true },
  });
  if (!solicitacao) throw new ErroAvaliacao('Solicitação não encontrada', 404);
  return solicitacao;
}

function ehParticipante(solicitacao, usuarioId) {
  return usuarioId === solicitacao.item.doadorId || usuarioId === solicitacao.solicitanteId;
}

// Devolve quem RECEBE a avaliação (a outra parte), ou lança 403 se quem está
// pedindo nem é o doador nem o solicitante dessa solicitação.
function identificarAvaliado(solicitacao, avaliadorId) {
  if (avaliadorId === solicitacao.item.doadorId) return solicitacao.solicitanteId;
  if (avaliadorId === solicitacao.solicitanteId) return solicitacao.item.doadorId;
  throw new ErroAvaliacao('Você não participou dessa solicitação', 403);
}

// As duas avaliações de uma solicitação só ficam visíveis pra ambos os lados
// quando as DUAS já foram enviadas, ou quando JANELA_REVELACAO_DIAS passou
// desde a mais antiga das que existem — o que vier primeiro. Evita retaliação
// ou nota inflada por quem avalia depois de já ver a nota do outro lado.
function calcularRevelacao(avaliacoesDoPar) {
  if (avaliacoesDoPar.length >= 2) return true;
  if (avaliacoesDoPar.length === 0) return false;
  const [unica] = avaliacoesDoPar;
  return Date.now() - new Date(unica.criadoEm).getTime() >= JANELA_REVELACAO_MS;
}

// Nota/comentário já validados pelo Joi na rota (POST /solicitacoes/:id/avaliacoes).
async function criar(avaliadorId, solicitacaoId, { nota, comentario }) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);

  // Não existe status "concluída" na SolicitacaoItem — a doação concluída é
  // "aceita" + item "doado" (ver solicitacao.service.js: função concluir()).
  if (solicitacao.status !== 'aceita' || solicitacao.item.status !== 'doado') {
    throw new ErroAvaliacao('Só é possível avaliar depois que a doação for concluída', 409);
  }

  const avaliadoId = identificarAvaliado(solicitacao, avaliadorId);

  const jaAvaliou = await prisma.avaliacao.findUnique({
    where: { solicitacaoId_avaliadorId: { solicitacaoId, avaliadorId } },
  });
  if (jaAvaliou) {
    throw new ErroAvaliacao('Você já avaliou essa solicitação', 409);
  }

  return prisma.avaliacao.create({
    data: { solicitacaoId, avaliadorId, avaliadoId, nota, comentario: comentario || null },
  });
}

// Visão de uma solicitação específica: a própria avaliação de quem pergunta
// sempre aparece (confirma o que a pessoa mandou); a do outro lado só aparece
// quando calcularRevelacao liberar. Admin vê as duas sempre — a regra de
// double-blind existe pra imparcialidade ENTRE os dois usuários, não deveria
// travar moderação.
async function listarPorSolicitacao(solicitacaoId, usuarioId, ehAdmin) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  if (!ehAdmin && !ehParticipante(solicitacao, usuarioId)) {
    throw new ErroAvaliacao('Você não participou dessa solicitação', 403);
  }

  const avaliacoes = await prisma.avaliacao.findMany({ where: { solicitacaoId } });
  const revelado = calcularRevelacao(avaliacoes);

  if (ehAdmin) {
    return { avaliacoes, revelado };
  }

  const minhaAvaliacao = avaliacoes.find((a) => a.avaliadorId === usuarioId) || null;
  const avaliacaoRecebida = revelado ? avaliacoes.find((a) => a.avaliadorId !== usuarioId) || null : null;
  return { minhaAvaliacao, avaliacaoRecebida, revelado };
}

// Avaliações RECEBIDAS por um usuário (perfil público) — só entram as que já
// passaram pela regra de revelação. Duas consultas, sem SQL bruto: primeiro as
// avaliações recebidas, depois todas as avaliações das MESMAS solicitações,
// pra descobrir por solicitação se o par já revelou.
async function listarRecebidas(usuarioId, { pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const recebidas = await prisma.avaliacao.findMany({
    where: { avaliadoId: usuarioId },
    orderBy: { criadoEm: 'desc' },
  });

  if (recebidas.length === 0) {
    return { avaliacoes: [], total: 0, media: null, pagina: paginaNorm, tamanho: tamanhoNorm };
  }

  const solicitacaoIds = [...new Set(recebidas.map((a) => a.solicitacaoId))];
  const doMesmoPar = await prisma.avaliacao.findMany({ where: { solicitacaoId: { in: solicitacaoIds } } });

  const porSolicitacao = new Map();
  for (const a of doMesmoPar) {
    if (!porSolicitacao.has(a.solicitacaoId)) porSolicitacao.set(a.solicitacaoId, []);
    porSolicitacao.get(a.solicitacaoId).push(a);
  }

  const visiveis = recebidas.filter((a) => calcularRevelacao(porSolicitacao.get(a.solicitacaoId) || [a]));
  const pagina_resultado = visiveis.slice(skip, skip + tamanhoNorm);
  const media = visiveis.length
    ? Number((visiveis.reduce((soma, a) => soma + a.nota, 0) / visiveis.length).toFixed(2))
    : null;

  return { avaliacoes: pagina_resultado, total: visiveis.length, media, pagina: paginaNorm, tamanho: tamanhoNorm };
}

module.exports = { ErroAvaliacao, JANELA_REVELACAO_DIAS, criar, listarPorSolicitacao, listarRecebidas };

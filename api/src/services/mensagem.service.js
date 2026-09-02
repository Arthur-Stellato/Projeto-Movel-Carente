const path = require('path');
const prisma = require('../lib/prisma');
const { ErroDominio } = require('../lib/erros');
const { buscarSolicitacaoComItem, ehParticipante } = require('../lib/participanteSolicitacao');
const { removerArquivoFisicoMensagem } = require('../lib/uploads');
const { normalizarLimite } = require('../lib/paginacao');
const { validarUuid } = require('../lib/validadores');

class ErroMensagem extends ErroDominio {}

// Fase 9: tamanho padrão/máximo da página de histórico. Chat é o único
// recurso do projeto cuja listagem cresce em tempo real enquanto está
// sendo consultada — por isso usa cursor, não pagina/tamanho como o resto
// (ver listarMensagens).
const LIMITE_MENSAGENS_PADRAO = 30;

// Fase 6: janela de edição. Depois desse prazo, a mensagem fica congelada —
// mesma lógica de "prazo de arrependimento" usada em apps de chat em geral.
// Deletar não tem esse limite de propósito (ver editarMensagem/deletarMensagem
// abaixo): apagar o que foi dito é uma questão de privacidade do remetente,
// não deveria expirar.
const JANELA_EDICAO_MS = 15 * 60 * 1000;

function paraRespostaPublica(mensagem) {
  return {
    ...mensagem,
    deletada: Boolean(mensagem.deletadoEm),
    editada: Boolean(mensagem.editadoEm),
  };
}

async function enviarMensagem(solicitacaoId, remetenteId, dados) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);

  if (!ehParticipante(solicitacao, remetenteId)) {
    throw new ErroMensagem('Você não participa desta solicitação', 403);
  }

  if (solicitacao.status === 'recusada' || solicitacao.status === 'cancelada') {
    throw new ErroMensagem('Essa conversa não aceita mais mensagens', 409);
  }

  const mensagemCriada = await prisma.mensagem.create({
    data: {
      solicitacaoId,
      remetenteId,
      conteudo: dados.conteudo,
      anexoUrl: dados.anexoUrl,
      anexoTipo: dados.anexoTipo,
    },
    include: {
      remetente: {
        select: { id: true, primeiroNome: true, ultimoNome: true },
      },
    },
  });

  const destinatarioId = remetenteId === solicitacao.item.doadorId ? solicitacao.solicitanteId : solicitacao.item.doadorId;

  await prisma.notificacao.create({
    data: {
      usuarioId: destinatarioId,
      tipo: 'nova_mensagem',
      titulo: 'Nova mensagem recebida',
      mensagem: `Nova mensagem sobre o item "${solicitacao.item.titulo}"`,
      referenciaId: solicitacao.id,
    },
  });

  return paraRespostaPublica(mensagemCriada);
}

async function buscarMensagemDoRemetente(solicitacaoId, mensagemId, remetenteId) {
  const mensagem = await prisma.mensagem.findUnique({ where: { id: mensagemId } });

  if (!mensagem || mensagem.solicitacaoId !== solicitacaoId) {
    throw new ErroMensagem('Mensagem não encontrada', 404);
  }
  if (mensagem.remetenteId !== remetenteId) {
    throw new ErroMensagem('Você só pode alterar suas próprias mensagens', 403);
  }
  return mensagem;
}

async function editarMensagem(solicitacaoId, mensagemId, remetenteId, conteudo) {
  const mensagemAtual = await buscarMensagemDoRemetente(solicitacaoId, mensagemId, remetenteId);

  if (mensagemAtual.deletadoEm) {
    throw new ErroMensagem('Uma mensagem apagada não pode ser editada', 409);
  }

  const decorridoMs = Date.now() - new Date(mensagemAtual.criadoEm).getTime();
  if (decorridoMs > JANELA_EDICAO_MS) {
    throw new ErroMensagem('O prazo de 15 minutos para editar esta mensagem expirou', 409);
  }

  // Mesma trava de "conversa encerrada" usada pra mandar mensagem nova —
  // editar o que foi dito numa negociação já resolvida não faz sentido.
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  if (solicitacao.status === 'recusada' || solicitacao.status === 'cancelada') {
    throw new ErroMensagem('Essa conversa não aceita mais edições', 409);
  }

  const mensagemAtualizada = await prisma.mensagem.update({
    where: { id: mensagemId },
    data: { conteudo, editadoEm: new Date() },
    include: {
      remetente: {
        select: { id: true, primeiroNome: true, ultimoNome: true },
      },
    },
  });

  return paraRespostaPublica(mensagemAtualizada);
}

async function deletarMensagem(solicitacaoId, mensagemId, remetenteId) {
  const mensagemAtual = await buscarMensagemDoRemetente(solicitacaoId, mensagemId, remetenteId);

  if (mensagemAtual.deletadoEm) {
    throw new ErroMensagem('Essa mensagem já foi apagada', 409);
  }

  // Apaga o conteúdo/anexo de verdade (privacidade) em vez de só marcar um
  // flag e esconder na resposta — a linha continua existindo (com
  // deletadoEm preenchido) só pra não quebrar a ordem cronológica da
  // conversa, mas o que foi dito de fato deixa de existir no banco. Isso
  // exige que o CHECK "conteudo OU anexo_url" da fase 1 abra uma exceção
  // pra deletadoEm (ver migration desta fase).
  const mensagemApagada = await prisma.mensagem.update({
    where: { id: mensagemId },
    data: { conteudo: null, anexoUrl: null, anexoTipo: null, deletadoEm: new Date() },
    include: {
      remetente: {
        select: { id: true, primeiroNome: true, ultimoNome: true },
      },
    },
  });

  if (mensagemAtual.anexoUrl) {
    await removerArquivoFisicoMensagem(path.basename(mensagemAtual.anexoUrl));
  }

  return paraRespostaPublica(mensagemApagada);
}

async function validarAcessoParaAnexo(solicitacaoId, usuarioId) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  if (!ehParticipante(solicitacao, usuarioId)) {
    throw new ErroMensagem('Você não participa desta solicitação', 403);
  }
}

// Fase 8: confirmação de leitura. Como o chat é sempre 1:1 (doador x
// solicitante), "lida" é um boolean simples na própria mensagem — não
// precisa de uma tabela separada de "quem leu" por usuário, que só faria
// sentido em conversa em grupo.
async function marcarMensagensComoLidas(solicitacaoId, usuarioId) {
  const resultado = await prisma.mensagem.updateMany({
    where: { solicitacaoId, remetenteId: { not: usuarioId }, lida: false },
    data: { lida: true },
  });
  return resultado.count;
}

// Usada pelo evento de socket 'mensagem:marcar_lida' — faz o próprio check
// de participante porque, diferente de listarMensagens, essa é uma entrada
// nova e independente (não tem a solicitação já carregada de antes).
async function marcarComoLida(solicitacaoId, usuarioId) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);
  if (!ehParticipante(solicitacao, usuarioId)) {
    throw new ErroMensagem('Você não participa desta solicitação', 403);
  }

  const marcadas = await marcarMensagensComoLidas(solicitacaoId, usuarioId);
  return { marcadas };
}

// Usada pelas listagens de solicitação (minhasSolicitacoes / listarPorItem)
// pra mostrar um contador tipo "3 novas" sem precisar abrir cada conversa.
// Uma query só (groupBy) pra página inteira, em vez de uma query por item.
async function contarNaoLidasPorSolicitacao(solicitacaoIds, usuarioId) {
  if (!solicitacaoIds || solicitacaoIds.length === 0) return {};

  const grupos = await prisma.mensagem.groupBy({
    by: ['solicitacaoId'],
    where: {
      solicitacaoId: { in: solicitacaoIds },
      remetenteId: { not: usuarioId },
      lida: false,
    },
    _count: { _all: true },
  });

  const contagem = {};
  for (const grupo of grupos) {
    contagem[grupo.solicitacaoId] = grupo._count._all;
  }
  return contagem;
}

async function listarMensagens(solicitacaoId, usuarioId, ehAdmin, opcoes = {}) {
  const solicitacao = await buscarSolicitacaoComItem(solicitacaoId);

  if (!ehAdmin && !ehParticipante(solicitacao, usuarioId)) {
    throw new ErroMensagem('Você não participa desta solicitação', 403);
  }

  // Abrir a conversa marca como lida — mesmo modelo mental do WhatsApp/
  // Telegram. Admin só está espiando pra suporte/moderação, então a visita
  // dele não deve mexer no estado de leitura real da conversa.
  if (!ehAdmin) {
    await marcarMensagensComoLidas(solicitacaoId, usuarioId);
  }

  const limite = normalizarLimite(opcoes.limite, LIMITE_MENSAGENS_PADRAO);
  const antesDe = opcoes.antesDe;

  const consulta = {
    where: { solicitacaoId },
    include: {
      remetente: {
        select: { id: true, primeiroNome: true, ultimoNome: true },
      },
    },
    // DESC pra paginar "de trás pra frente" a partir da mais recente — pega
    // um a mais (limite + 1) só pra saber se ainda tem mais sem precisar de
    // um count() separado.
    orderBy: { criadoEm: 'desc' },
    take: limite + 1,
  };

  if (antesDe !== undefined) {
    if (!validarUuid(antesDe)) {
      throw new ErroMensagem('Parâmetro "antesDe" inválido: deve ser um identificador válido', 400);
    }
    // Confirma que o cursor é uma mensagem de VERDADE desta conversa antes
    // de usá-lo — o comportamento do cursor do Prisma não é garantido se o
    // registro-âncora não bater com o "where" da consulta.
    const mensagemCursor = await prisma.mensagem.findUnique({ where: { id: antesDe } });
    if (!mensagemCursor || mensagemCursor.solicitacaoId !== solicitacaoId) {
      throw new ErroMensagem('Parâmetro "antesDe" não corresponde a uma mensagem desta conversa', 400);
    }
    consulta.cursor = { id: antesDe };
    consulta.skip = 1;
  }

  const paginaDesc = await prisma.mensagem.findMany(consulta);

  const temMais = paginaDesc.length > limite;
  const paginaCortada = temMais ? paginaDesc.slice(0, limite) : paginaDesc;
  // Devolve em ordem cronológica (mais antiga primeiro) — é assim que a tela
  // de chat renderiza; a busca em si roda em DESC só pelo motivo do cursor.
  const mensagensAsc = [...paginaCortada].reverse();

  return {
    solicitacao: {
      id: solicitacao.id,
      status: solicitacao.status,
      item: solicitacao.item,
      solicitante: solicitacao.solicitante,
    },
    mensagens: mensagensAsc.map(paraRespostaPublica),
    paginacao: {
      limite,
      temMais,
      // Cursor pra buscar a PRÓXIMA leva (mais antiga) — é o id da mensagem
      // mais antiga desta página. null quando não tem mais nada pra trás.
      proximoCursor: temMais ? paginaCortada[paginaCortada.length - 1].id : null,
    },
  };
}

module.exports = {
  ErroMensagem,
  enviarMensagem,
  listarMensagens,
  validarAcessoParaAnexo,
  editarMensagem,
  deletarMensagem,
  marcarComoLida,
  contarNaoLidasPorSolicitacao,
};

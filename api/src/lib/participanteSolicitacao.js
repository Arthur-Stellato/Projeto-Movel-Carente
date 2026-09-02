const prisma = require('./prisma');
const { ErroDominio } = require('./erros');

class ErroParticipanteSolicitacao extends ErroDominio {}

async function buscarSolicitacaoComItem(solicitacaoId) {
  const solicitacao = await prisma.solicitacaoItem.findUnique({
    where: { id: solicitacaoId },
    include: {
      item: {
        include: {
          doador: { select: { id: true, primeiroNome: true, ultimoNome: true, email: true } },
          imagens: { orderBy: { ordem: 'asc' }, take: 1 },
        },
      },
      solicitante: { select: { id: true, primeiroNome: true, ultimoNome: true, email: true } },
    },
  });
  if (!solicitacao) throw new ErroParticipanteSolicitacao('Solicitação não encontrada', 404);
  return solicitacao;
}

function ehParticipante(solicitacao, usuarioId) {
  if (!solicitacao || !solicitacao.item) return false;
  return usuarioId === solicitacao.item.doadorId || usuarioId === solicitacao.solicitanteId;
}

module.exports = {
  buscarSolicitacaoComItem,
  ehParticipante,
  ErroParticipanteSolicitacao,
};


const prisma = require('./prisma');

// Usado por qualquer serviço que precise registrar uma ação administrativa relevante
// (ex: desativar usuário, analisar denúncia). Centralizado aqui para não duplicar
// a mesma chamada Prisma em cada módulo.
async function registrarAuditoria(adminId, acao, entidadeAfetada, entidadeId, detalhes) {
  await prisma.logAuditoria.create({
    data: { adminId, acao, entidadeAfetada, entidadeId, detalhes },
  });
}

module.exports = { registrarAuditoria };
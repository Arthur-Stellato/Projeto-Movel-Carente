const prisma = require('../lib/prisma');
const { normalizarPaginacao } = require('../lib/paginacao');
const itemService = require('./item.service');
const usuarioService = require('./usuario.service');
const { registrarAuditoria } = require('../lib/auditoria');
const { MOTIVOS_DENUNCIA_VALIDOS: MOTIVOS_VALIDOS } = require('../lib/validadores');

const PAGINA_TAMANHO_PADRAO = 20;

const { ErroDominio } = require('../lib/erros');
class ErroDenuncia extends ErroDominio {}

// Tipo/motivo válidos e a regra XOR (item xor usuário, dependendo de `tipo`)
// já são checados pelo Joi na rota (POST /denuncias) — o que sobra é o que só
// o banco/contexto autenticado pode responder: o alvo existe? é a própria pessoa?
async function criar(denuncianteId, { tipo, itemId, usuarioDenunciadoId, motivo, descricao }) {
  if (tipo === 'item') {
    const item = await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } });
    if (!item) throw new ErroDenuncia('Item não encontrado', 404);
  } else {
    if (usuarioDenunciadoId === denuncianteId) {
      throw new ErroDenuncia('Você não pode denunciar a si mesmo', 403);
    }
    const usuario = await prisma.usuario.findUnique({ where: { id: usuarioDenunciadoId } });
    if (!usuario) throw new ErroDenuncia('Usuário não encontrado', 404);
  }

  // Evita spam: bloqueia nova denúncia do mesmo alvo enquanto já existir uma pendente do mesmo denunciante
  const jaExistePendente = await prisma.denuncia.findFirst({
    where: {
      denuncianteId,
      status: 'pendente',
      ...(tipo === 'item' ? { itemId } : { usuarioDenunciadoId }),
    },
  });
  if (jaExistePendente) {
    throw new ErroDenuncia('Você já tem uma denúncia pendente para esse mesmo alvo', 409);
  }

  return prisma.denuncia.create({
    data: { denuncianteId, tipo, itemId: itemId || null, usuarioDenunciadoId: usuarioDenunciadoId || null, motivo, descricao },
  });
}

async function listarMinhas(denuncianteId, { pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [denuncias, total] = await prisma.$transaction([
    prisma.denuncia.findMany({
      where: { denuncianteId },
      include: { item: { select: { id: true, titulo: true } }, usuarioDenunciado: { select: { id: true, primeiroNome: true, ultimoNome: true } } },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.denuncia.count({ where: { denuncianteId } }),
  ]);

  return { denuncias, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function listarTodas({ status, tipo, pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO }) {
  const where = {};
  if (status) where.status = status;
  if (tipo) where.tipo = tipo;

  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [denuncias, total] = await prisma.$transaction([
    prisma.denuncia.findMany({
      where,
      include: {
        denunciante: { select: { id: true, primeiroNome: true, ultimoNome: true, email: true } },
        item: { select: { id: true, titulo: true, status: true } },
        usuarioDenunciado: { select: { id: true, primeiroNome: true, ultimoNome: true, email: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.denuncia.count({ where }),
  ]);

  return { denuncias, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function buscarPorId(id) {
  const denuncia = await prisma.denuncia.findUnique({
    where: { id },
    include: {
      denunciante: { select: { id: true, primeiroNome: true, ultimoNome: true, email: true } },
      item: true,
      usuarioDenunciado: { select: { id: true, primeiroNome: true, ultimoNome: true, email: true, ativo: true } },
      admin: { select: { id: true, primeiroNome: true, ultimoNome: true } },
    },
  });
  if (!denuncia) throw new ErroDenuncia('Denúncia não encontrada', 404);
  return denuncia;
}

// Valor de status já é checado pelo Joi na rota (PATCH /denuncias/:id/analisar).
async function analisar(id, adminId, { status, desativarItem = false, desativarUsuario = false }) {
  const denuncia = await prisma.denuncia.findUnique({ where: { id } });
  if (!denuncia) throw new ErroDenuncia('Denúncia não encontrada', 404);
  if (denuncia.status !== 'pendente') {
    throw new ErroDenuncia(`Essa denúncia já foi analisada (status: ${denuncia.status})`, 409);
  }

  await prisma.denuncia.update({
    where: { id },
    data: { status, analisadoPor: adminId, analisadoEm: new Date() },
  });

  await registrarAuditoria(adminId, 'analisou_denuncia', 'denuncias', id, {
    status,
    tipo: denuncia.tipo,
    itemId: denuncia.itemId,
    usuarioDenunciadoId: denuncia.usuarioDenunciadoId,
  });

  // Ações opcionais: ficam a critério de quem está analisando, via flag explícita —
  // nunca automáticas, já que nem toda denúncia procedente merece a mesma punição.
  if (status === 'procedente' && denuncia.tipo === 'item' && desativarItem) {
    await itemService.cancelar(denuncia.itemId, adminId, true);
  }
  if (status === 'procedente' && denuncia.tipo === 'usuario' && desativarUsuario) {
    await usuarioService.desativarConta(denuncia.usuarioDenunciadoId, adminId);
  }

  return buscarPorId(id);
}

module.exports = { ErroDenuncia, MOTIVOS_VALIDOS, criar, listarMinhas, listarTodas, buscarPorId, analisar };
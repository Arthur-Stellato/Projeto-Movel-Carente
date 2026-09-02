const bcrypt = require('bcrypt');
const prisma = require('../lib/prisma');
const { sanitizarUsuario } = require('../lib/sanitizar');
const { registrarAuditoria } = require('../lib/auditoria');
const { normalizarEmail, apenasDigitos } = require('../lib/validadores');
const { normalizarPaginacao } = require('../lib/paginacao');
const logger = require('../lib/logger');

const authService = require('./auth.service');
const cepService = require('./cep.service');

const SALT_ROUNDS = 10;
const PAGINA_TAMANHO_PADRAO = 20;

const { ErroDominio } = require('../lib/erros');
class ErroUsuario extends ErroDominio {}

// ============================================================
// Registro (movido do auth.service.js — criar um usuário é uma
// operação sobre usuário, não sobre autenticação em si)
// ============================================================

// Formato de email/CPF/CNPJ/senha e limites de tamanho já foram checados pelo Joi
// na rota (/auth/registro) — o que sobra aqui é a regra que só o banco pode
// responder: email ou documento já cadastrado.
async function registrar({ email, cpf, cnpj, senha, primeiroNome, ultimoNome, telefone, genero }) {
  const cpfLimpo = apenasDigitos(cpf);
  const cnpjLimpo = apenasDigitos(cnpj);
  const emailNormalizado = normalizarEmail(email);
  const documento = cpfLimpo ? { cpf: cpfLimpo } : { cnpj: cnpjLimpo };

  const jaExiste = await prisma.usuario.findFirst({
    where: { OR: [{ email: emailNormalizado }, documento] },
  });
  if (jaExiste) {
    throw new ErroUsuario('Email ou documento já cadastrado', 409);
  }

  const senhaHash = await bcrypt.hash(senha, SALT_ROUNDS);

  let usuario;
  try {
    usuario = await prisma.usuario.create({
      // genero: undefined faz o Prisma cair no @default(prefiro_nao_dizer) do
      // schema — não precisa de um `|| 'prefiro_nao_dizer'` manual aqui.
      data: { email: emailNormalizado, ...documento, senhaHash, primeiroNome, ultimoNome, telefone, genero },
    });
  } catch (err) {
    // Cobre a corrida rara de dois registros com o mesmo email/documento chegando ao
    // mesmo tempo: os dois passam pelo findFirst acima (nenhum vê o outro
    // ainda), e só um consegue criar — o outro esbarra na constraint UNIQUE do
    // banco. Sem esse catch, esse caminho cairia no handler genérico de erro
    // do Prisma (src/lib/erros.js), que revela QUAL campo colidiu — quebrando
    // de propósito a mensagem genérica de cima, que existe justamente pra não
    // revelar isso. Convertemos pra mesma mensagem genérica aqui também.
    if (err && err.name === 'PrismaClientKnownRequestError' && err.code === 'P2002') {
      throw new ErroUsuario('Email ou documento já cadastrado', 409);
    }
    throw err;
  }

  // Dispara o email de verificação (não bloqueia o registro por causa disso —
  // enviarVerificacaoEmail só grava um evento de outbox, nunca toca o Redis
  // direto; ver src/lib/outbox.js). Envolvido em try/catch por segurança extra:
  // mesmo que essa gravação falhe por algum motivo, o registro (já salvo no
  // banco) não deve falhar — o usuário pode pedir reenvio depois.
  try {
    await authService.enviarVerificacaoEmail(usuario);
  } catch (err) {
    logger.error({ err }, 'Falha ao enfileirar email de verificação');
  }

  return sanitizarUsuario(usuario);
}

// ============================================================
// Perfil próprio
// ============================================================

async function buscarPerfil(usuarioId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErroUsuario('Usuário não encontrado', 404);
  return sanitizarUsuario(usuario);
}

// Vazio explícito e limites de tamanho já são barrados pelo Joi na rota
// (PUT /usuarios/me) — aqui só filtramos quais campos são editáveis.
async function atualizarPerfil(usuarioId, dados) {
  // Propositalmente NÃO incluímos email/cpf/cnpj aqui: email exigiria reverificação,
  // e o documento não deve mudar depois de cadastrado. Todos ficam de fora por segurança.
  const permitido = ['primeiroNome', 'ultimoNome', 'telefone', 'genero'];
  const atualizacao = {};
  for (const campo of permitido) {
    if (dados[campo] !== undefined) {
      atualizacao[campo] = typeof dados[campo] === 'string' ? dados[campo].trim() : dados[campo];
    }
  }

  const usuario = await prisma.usuario.update({ where: { id: usuarioId }, data: atualizacao });
  return sanitizarUsuario(usuario);
}

// Presença de senhaAtual/novaSenha e a força da nova senha já vêm checadas
// pelo Joi na rota (PATCH /usuarios/me/senha).
async function alterarSenha(usuarioId, { senhaAtual, novaSenha }) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario || !usuario.senhaHash) throw new ErroUsuario('Usuário inválido', 404);

  const senhaValida = await bcrypt.compare(senhaAtual, usuario.senhaHash);
  if (!senhaValida) throw new ErroUsuario('Senha atual incorreta', 403);

  const novaSenhaHash = await bcrypt.hash(novaSenha, SALT_ROUNDS);

  // Mesma política do "esqueci minha senha": trocar a senha revoga as demais sessões.
  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuarioId }, data: { senhaHash: novaSenhaHash } }),
    prisma.refreshToken.updateMany({ where: { usuarioId, revogado: false }, data: { revogado: true } }),
  ]);
}

// ============================================================
// Endereços do usuário
// ============================================================

async function listarEnderecos(usuarioId) {
  return prisma.endereco.findMany({
    where: { usuarioId },
    orderBy: [{ principal: 'desc' }, { criadoEm: 'asc' }],
  });
}

// Obrigatoriedade de CEP/logradouro/cidade/estado, formato do CEP, UF válida e
// limites de tamanho já são checados pelo Joi na rota (POST /usuarios/me/enderecos).
// Resolve coordenadas a partir do CEP sem nunca bloquear a escrita do
// endereço em si — se a BrasilAPI estiver fora do ar, ou o CEP não tiver
// geolocalização, o endereço é salvo normalmente, só sem lat/lng (ver
// cep.service.js: buscarCep). O mesmo princípio de resiliência do Outbox:
// uma dependência externa não pode travar uma escrita que não depende dela.
async function resolverCoordenadasPorCep(cep) {
  try {
    const resolvido = await cepService.buscarCep(cep);
    return { latitude: resolvido.latitude, longitude: resolvido.longitude };
  } catch (err) {
    logger.warn({ cep, err: err.message }, '[usuario.service] Não foi possível resolver coordenadas do CEP — endereço será salvo sem elas');
    return { latitude: null, longitude: null };
  }
}

// Obrigatoriedade de CEP/logradouro/cidade/estado, formato do CEP, UF válida e
// limites de tamanho já são checados pelo Joi na rota (POST /usuarios/me/enderecos).
async function criarEndereco(usuarioId, dados) {
  const { cep, logradouro, numero, complemento, bairro, cidade, estado, pais, tipo, principal } = dados;

  const totalExistente = await prisma.endereco.count({ where: { usuarioId } });
  // O primeiro endereço cadastrado vira principal automaticamente, sem precisar o usuário marcar
  const seraPrincipal = totalExistente === 0 ? true : Boolean(principal);

  if (seraPrincipal && totalExistente > 0) {
    await prisma.endereco.updateMany({ where: { usuarioId, principal: true }, data: { principal: false } });
  }

  const { latitude, longitude } = await resolverCoordenadasPorCep(cep);

  return prisma.endereco.create({
    data: {
      usuarioId,
      cep: apenasDigitos(cep),
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado: estado.toUpperCase(),
      pais: pais || 'Brasil',
      tipo: tipo || 'residencial',
      principal: seraPrincipal,
      latitude,
      longitude,
    },
  });
}

// Formato de CEP/UF e limites de tamanho já são checados pelo Joi na rota
// (PUT /usuarios/me/enderecos/:id) — aqui só sobra normalizar (UF maiúscula,
// CEP só dígitos) e a lógica de posse + campo "principal".
async function atualizarEndereco(enderecoId, usuarioId, dados) {
  const endereco = await prisma.endereco.findFirst({ where: { id: enderecoId, usuarioId } });
  if (!endereco) throw new ErroUsuario('Endereço não encontrado', 404);

  const permitido = ['cep', 'logradouro', 'numero', 'complemento', 'bairro', 'cidade', 'estado', 'pais', 'tipo', 'principal'];
  const atualizacao = {};
  for (const campo of permitido) {
    if (dados[campo] !== undefined) atualizacao[campo] = dados[campo];
  }

  if (atualizacao.estado) {
    atualizacao.estado = atualizacao.estado.toUpperCase();
  }
  if (atualizacao.cep) {
    // CEP mudou: re-resolve coordenadas pra esse endereço não ficar com
    // lat/lng do endereço antigo. dados.cep (o valor original, não formatado)
    // é o que vai pra consulta — apenasDigitos() só formata o que é salvo.
    const { latitude, longitude } = await resolverCoordenadasPorCep(dados.cep);
    atualizacao.latitude = latitude;
    atualizacao.longitude = longitude;
    atualizacao.cep = apenasDigitos(atualizacao.cep);
  }

  if (atualizacao.principal === true) {
    await prisma.endereco.updateMany({
      where: { usuarioId, principal: true, id: { not: enderecoId } },
      data: { principal: false },
    });
  }

  return prisma.endereco.update({ where: { id: enderecoId }, data: atualizacao });
}

async function removerEndereco(enderecoId, usuarioId) {
  const endereco = await prisma.endereco.findFirst({ where: { id: enderecoId, usuarioId } });
  if (!endereco) throw new ErroUsuario('Endereço não encontrado', 404);

  const emUso = await prisma.itemDoacao.findFirst({ where: { enderecoId, deletadoEm: null } });
  if (emUso) {
    throw new ErroUsuario('Não é possível remover: existe um item de doação usando esse endereço', 409);
  }

  await prisma.endereco.delete({ where: { id: enderecoId } });
}

// ============================================================
// Administração de usuários
// ============================================================

async function listarTodos({ ativo, tipo, pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO } = {}) {
  const where = {};
  if (ativo !== undefined) where.ativo = ativo === true || ativo === 'true';
  if (tipo) where.tipo = tipo;

  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [usuarios, total] = await prisma.$transaction([
    prisma.usuario.findMany({
      where,
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
      select: {
        id: true, email: true, primeiroNome: true, ultimoNome: true,
        tipo: true, ativo: true, emailVerificado: true, criadoEm: true,
      },
    }),
    prisma.usuario.count({ where }),
  ]);

  return { usuarios, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function desativarConta(usuarioId, adminId) {
  if (usuarioId === adminId) {
    throw new ErroUsuario('Você não pode desativar sua própria conta por aqui', 400);
  }

  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErroUsuario('Usuário não encontrado', 404);

  await prisma.$transaction([
    prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: false } }),
    prisma.refreshToken.updateMany({ where: { usuarioId, revogado: false }, data: { revogado: true } }),
  ]);

  await registrarAuditoria(adminId, 'desativou_usuario', 'usuarios', usuarioId, { email: usuario.email });
}

async function reativarConta(usuarioId, adminId) {
  const usuario = await prisma.usuario.findUnique({ where: { id: usuarioId } });
  if (!usuario) throw new ErroUsuario('Usuário não encontrado', 404);

  await prisma.usuario.update({ where: { id: usuarioId }, data: { ativo: true } });
  await registrarAuditoria(adminId, 'reativou_usuario', 'usuarios', usuarioId, { email: usuario.email });
}

module.exports = {
  ErroUsuario,
  registrar,
  buscarPerfil,
  atualizarPerfil,
  alterarSenha,
  listarEnderecos,
  criarEndereco,
  atualizarEndereco,
  removerEndereco,
  listarTodos,
  desativarConta,
  reativarConta,
};

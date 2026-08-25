const prisma = require('../lib/prisma');
const { gerarSlug } = require('../lib/slugify');

const { ErroDominio } = require('../lib/erros');
class ErroCategoria extends ErroDominio {}

async function listar({ incluirInativas = false } = {}) {
  return prisma.categoria.findMany({
    where: incluirInativas ? {} : { ativo: true },
    orderBy: { nome: 'asc' },
  });
}

async function buscarPorId(id) {
  const categoria = await prisma.categoria.findUnique({ where: { id } });
  if (!categoria) {
    throw new ErroCategoria('Categoria não encontrada', 404);
  }
  return categoria;
}

// Obrigatoriedade e tamanho máximo de nome/ícone já são checados pelo Joi na
// rota (POST /categorias) — aqui sobra gerar o slug e checar duplicidade no banco.
async function criar({ nome, icone }) {
  const slug = gerarSlug(nome);
  if (!slug) {
    throw new ErroCategoria('Não foi possível gerar um identificador válido para esse nome');
  }

  const jaExiste = await prisma.categoria.findFirst({
    where: { OR: [{ nome: nome.trim() }, { slug }] },
  });
  if (jaExiste) {
    throw new ErroCategoria('Já existe uma categoria com esse nome', 409);
  }

  return prisma.categoria.create({
    data: { nome: nome.trim(), slug, icone },
  });
}

// Vazio explícito e tamanho máximo de nome/ícone já são checados pelo Joi na
// rota (PUT /categorias/:id) — aqui sobra o slug e a checagem de duplicidade.
async function atualizar(id, { nome, icone, ativo }) {
  await buscarPorId(id); // dispara 404 se não existir

  const dados = {};

  if (nome !== undefined) {
    const novoSlug = gerarSlug(nome);
    const conflito = await prisma.categoria.findFirst({
      where: {
        id: { not: id },
        OR: [{ nome: nome.trim() }, { slug: novoSlug }],
      },
    });
    if (conflito) {
      throw new ErroCategoria('Já existe outra categoria com esse nome', 409);
    }
    dados.nome = nome.trim();
    dados.slug = novoSlug;
  }

  if (icone !== undefined) dados.icone = icone;
  if (ativo !== undefined) dados.ativo = ativo;

  return prisma.categoria.update({ where: { id }, data: dados });
}

async function desativar(id) {
  await buscarPorId(id);
  // Soft delete: mantém a categoria (itens já cadastrados continuam íntegros),
  // só deixa de aparecer para novos cadastros.
  return prisma.categoria.update({ where: { id }, data: { ativo: false } });
}

module.exports = { ErroCategoria, listar, buscarPorId, criar, atualizar, desativar };
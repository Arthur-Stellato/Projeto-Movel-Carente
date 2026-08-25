const prisma = require('../lib/prisma');
const { normalizarPaginacao } = require('../lib/paginacao');
const { PREFIXO_URL_UPLOADS_ITENS, removerArquivoFisico } = require('../lib/uploads');

const STATUS_EDITAVEIS = ['disponivel', 'reservado'];
const STATUS_CANCELAVEIS = ['disponivel', 'reservado'];
const PAGINA_TAMANHO_PADRAO = 12;
const MAX_IMAGENS_POR_ITEM = 10;

const { ErroDominio } = require('../lib/erros');
class ErroItem extends ErroDominio {}

async function validarCategoriaAtiva(categoriaId) {
  const categoria = await prisma.categoria.findUnique({ where: { id: categoriaId } });
  if (!categoria || !categoria.ativo) {
    throw new ErroItem('Categoria inválida ou inativa', 404);
  }
}

// Resolve a coordenada do item: prioriza o endereço vinculado (mais precisa,
// já vem resolvida do CEP em usuario.service.js) — sem endereço vinculado,
// cai pro centroide da cidade/estado como aproximação (ver CidadeCentroide).
// Sem nenhum dos dois disponível, devolve null/null: o item continua listável
// normalmente, só fica de fora da busca por raio até ganhar uma coordenada.
async function resolverCoordenadasItem({ endereco, cidade, estado }) {
  if (endereco?.latitude != null && endereco?.longitude != null) {
    return { latitude: endereco.latitude, longitude: endereco.longitude };
  }

  const centroide = await prisma.cidadeCentroide.findUnique({
    where: { cidade_estado: { cidade, estado: estado.toUpperCase() } },
  });
  if (centroide) {
    return { latitude: centroide.latitude, longitude: centroide.longitude };
  }

  return { latitude: null, longitude: null };
}

async function verificarDono(itemId, usuarioId) {
  const item = await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } });
  if (!item) throw new ErroItem('Item não encontrado', 404);
  if (item.doadorId !== usuarioId) {
    throw new ErroItem('Você não tem permissão para alterar esse item', 403);
  }
  return item;
}

// Admin tem controle total sobre qualquer item, independente de quem é o dono —
// mesma regra já aplicada em atualizar/cancelar. Aqui centralizada pra também
// valer nas funções de gerenciamento de imagem (antes só o próprio doador podia
// mexer nelas, mesmo um admin não conseguia — assimetria corrigida).
async function verificarDonoOuAdmin(itemId, usuarioId, ehAdmin) {
  if (ehAdmin) {
    const item = await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } });
    if (!item) throw new ErroItem('Item não encontrado', 404);
    return item;
  }
  return verificarDono(itemId, usuarioId);
}

// Obrigatoriedade/tamanho de título/descrição/cidade, UF válida, condição válida
// e formato+quantidade de imagens já são checados pelo Joi na rota (POST /itens).
// O que sobra são as regras que dependem do banco: categoria ativa e posse do endereço.
async function criar(doadorId, { titulo, descricao, categoriaId, condicao, cidade, estado, enderecoId, imagens }) {
  await validarCategoriaAtiva(categoriaId);

  let endereco = null;
  if (enderecoId) {
    endereco = await prisma.endereco.findFirst({ where: { id: enderecoId, usuarioId: doadorId } });
    if (!endereco) throw new ErroItem('Endereço inválido ou não pertence a você', 403);
  }

  const { latitude, longitude } = await resolverCoordenadasItem({ endereco, cidade, estado });

  return prisma.itemDoacao.create({
    data: {
      doadorId,
      categoriaId,
      titulo: titulo.trim(),
      descricao: descricao.trim(),
      condicao: condicao || 'usado',
      cidade,
      estado: estado.toUpperCase(),
      enderecoId: enderecoId || null,
      latitude,
      longitude,
      imagens: imagens?.length
        ? { create: imagens.map((url, index) => ({ url, ordem: index })) }
        : undefined,
    },
    include: { imagens: true, categoria: true },
  });
}

// Formato de categoriaId e UF do filtro já são checados pelo Joi na rota
// (GET /itens, query) — aqui só monta o where a partir de valores já válidos.
async function listar({ categoriaId, cidade, estado, busca, lat, lng, raioKm, pagina = 1, tamanho = PAGINA_TAMANHO_PADRAO }) {
  if (lat !== undefined && lng !== undefined && raioKm !== undefined) {
    return listarPorRaio({
      lat: Number(lat),
      lng: Number(lng),
      raioKm: Number(raioKm),
      categoriaId,
      cidade,
      estado,
      busca,
      pagina,
      tamanho,
    });
  }

  const where = { status: 'disponivel', deletadoEm: null };

  if (categoriaId) where.categoriaId = categoriaId;
  if (cidade) where.cidade = { equals: cidade, mode: 'insensitive' };
  if (estado) where.estado = estado.toUpperCase();
  if (busca) {
    where.OR = [
      { titulo: { contains: busca, mode: 'insensitive' } },
      { descricao: { contains: busca, mode: 'insensitive' } },
    ];
  }

  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  const [itens, total] = await prisma.$transaction([
    prisma.itemDoacao.findMany({
      where,
      include: {
        categoria: true,
        imagens: { orderBy: { ordem: 'asc' } },
        doador: { select: { id: true, primeiroNome: true, ultimoNome: true } },
      },
      orderBy: { criadoEm: 'desc' },
      skip,
      take: tamanhoNorm,
    }),
    prisma.itemDoacao.count({ where }),
  ]);

  return { itens, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

// Filtro por raio geográfico via PostGIS (ST_DWithin). Prisma não modela
// geography/geometry nativamente, então isso é raw SQL de verdade — mas só
// pra decidir QUAIS itens entram e em que ordem (por distância). Os dados
// completos (categoria/imagens/doador) vêm de uma segunda consulta Prisma
// normal, pra devolver exatamente a mesma forma de objeto do listar() comum.
//
// Valores sempre via parâmetro posicional ($1, $2...), nunca interpolados
// direto na string SQL — protege contra SQL injection.
async function listarPorRaio({ lat, lng, raioKm, categoriaId, cidade, estado, busca, pagina, tamanho }) {
  const { pagina: paginaNorm, tamanho: tamanhoNorm, skip } = normalizarPaginacao(pagina, tamanho, PAGINA_TAMANHO_PADRAO);

  // status/estado são enums no Postgres — comparar com ::text evita depender
  // de o driver conseguir inferir o tipo do enum sozinho a partir do parâmetro.
  const condicoes = ['status::text = $1', 'deletado_em IS NULL', 'latitude IS NOT NULL', 'longitude IS NOT NULL'];
  const valores = ['disponivel'];
  const proximoIndice = () => valores.length + 1;

  if (categoriaId) {
    condicoes.push(`categoria_id = $${proximoIndice()}`);
    valores.push(categoriaId);
  }
  if (cidade) {
    condicoes.push(`cidade ILIKE $${proximoIndice()}`);
    valores.push(cidade);
  }
  if (estado) {
    condicoes.push(`estado::text = $${proximoIndice()}`);
    valores.push(estado.toUpperCase());
  }
  if (busca) {
    const idx = proximoIndice();
    condicoes.push(`(titulo ILIKE $${idx} OR descricao ILIKE $${idx})`);
    valores.push(`%${busca}%`);
  }

  const idxLng = proximoIndice();
  valores.push(lng);
  const idxLat = proximoIndice();
  valores.push(lat);
  const idxRaioMetros = proximoIndice();
  valores.push(raioKm * 1000); // ST_DWithin trabalha em metros, o filtro chega em km

  const pontoOrigem = `geography(ST_MakePoint($${idxLng}, $${idxLat}))`;
  const whereSql = `${condicoes.join(' AND ')} AND ST_DWithin(geography(ST_MakePoint(longitude, latitude)), ${pontoOrigem}, $${idxRaioMetros})`;

  const valoresContagem = [...valores];
  const idxLimit = proximoIndice();
  valores.push(tamanhoNorm);
  const idxOffset = proximoIndice();
  valores.push(skip);

  const [linhas, resultadoContagem] = await Promise.all([
    prisma.$queryRawUnsafe(
      `SELECT id, ST_Distance(geography(ST_MakePoint(longitude, latitude)), ${pontoOrigem}) / 1000 AS distancia_km
       FROM itens_doacao
       WHERE ${whereSql}
       ORDER BY distancia_km ASC
       LIMIT $${idxLimit} OFFSET $${idxOffset}`,
      ...valores
    ),
    prisma.$queryRawUnsafe(`SELECT COUNT(*)::int AS total FROM itens_doacao WHERE ${whereSql}`, ...valoresContagem),
  ]);

  const ids = linhas.map((linha) => linha.id);
  if (ids.length === 0) {
    return { itens: [], total: 0, pagina: paginaNorm, tamanho: tamanhoNorm };
  }

  const distanciaPorId = new Map(linhas.map((linha) => [linha.id, Number(linha.distancia_km)]));

  const itensCompletos = await prisma.itemDoacao.findMany({
    where: { id: { in: ids } },
    include: {
      categoria: true,
      imagens: { orderBy: { ordem: 'asc' } },
      doador: { select: { id: true, primeiroNome: true, ultimoNome: true } },
    },
  });

  // findMany com `id: { in }` não garante a mesma ordem — reordena pela
  // distância que o raw SQL já calculou, e anexa a distância em cada item.
  const itensPorId = new Map(itensCompletos.map((item) => [item.id, item]));
  const itens = ids
    .map((id) => itensPorId.get(id))
    .filter(Boolean)
    .map((item) => ({ ...item, distanciaKm: Number(distanciaPorId.get(item.id).toFixed(2)) }));

  const total = Number(resultadoContagem[0]?.total || 0);

  return { itens, total, pagina: paginaNorm, tamanho: tamanhoNorm };
}

async function meusItens(usuarioId) {
  return prisma.itemDoacao.findMany({
    where: { doadorId: usuarioId, deletadoEm: null },
    include: {
      categoria: true,
      imagens: { orderBy: { ordem: 'asc' } },
      _count: { select: { solicitacoes: true } },
    },
    orderBy: { criadoEm: 'desc' },
  });
}

async function buscarPorId(id, usuarioSolicitanteId = null) {
  const item = await prisma.itemDoacao.findFirst({
    where: { id, deletadoEm: null },
    include: {
      categoria: true,
      imagens: { orderBy: { ordem: 'asc' } },
      doador: { select: { id: true, primeiroNome: true, ultimoNome: true, telefone: true } },
      endereco: true,
    },
  });
  if (!item) throw new ErroItem('Item não encontrado', 404);

  // Endereço completo e telefone só são visíveis para o próprio doador, ou para
  // quem teve uma solicitação aceita nesse item. Para qualquer outra pessoa, ocultamos.
  const ehDoador = usuarioSolicitanteId === item.doadorId;
  let podeVerContato = ehDoador;

  if (!podeVerContato && usuarioSolicitanteId) {
    const solicitacaoAceita = await prisma.solicitacaoItem.findFirst({
      where: { itemId: id, solicitanteId: usuarioSolicitanteId, status: 'aceita' },
    });
    podeVerContato = Boolean(solicitacaoAceita);
  }

  if (!podeVerContato) {
    item.endereco = null;
    item.doador.telefone = null;
  }

  return item;
}

async function atualizar(itemId, usuarioId, ehAdmin, dados) {
  const item = ehAdmin
    ? await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } })
    : await verificarDono(itemId, usuarioId);

  if (!item) throw new ErroItem('Item não encontrado', 404);

  if (!STATUS_EDITAVEIS.includes(item.status)) {
    throw new ErroItem(
      `Não é possível editar um item com status "${item.status}". Cancele o processo atual primeiro.`,
      409
    );
  }

  // Formato/tamanho de cada campo (título, condição, UF, cidade) já são checados
  // pelo Joi na rota (PUT /itens/:id) — aqui só filtramos os campos editáveis e
  // aplicamos as regras que dependem do banco (categoria ativa, posse do endereço).
  const permitido = ['titulo', 'descricao', 'categoriaId', 'condicao', 'cidade', 'estado', 'enderecoId'];
  const atualizacao = {};
  for (const campo of permitido) {
    if (dados[campo] !== undefined) atualizacao[campo] = dados[campo];
  }

  if (atualizacao.estado) {
    atualizacao.estado = atualizacao.estado.toUpperCase();
  }
  if (atualizacao.categoriaId) {
    await validarCategoriaAtiva(atualizacao.categoriaId);
  }
  let enderecoVinculado = null;
  if (atualizacao.enderecoId) {
    enderecoVinculado = await prisma.endereco.findFirst({
      where: { id: atualizacao.enderecoId, usuarioId: item.doadorId },
    });
    if (!enderecoVinculado) throw new ErroItem('Endereço inválido ou não pertence ao doador', 403);
  }

  // Recalcula a coordenada só quando faz sentido: endereço vinculado mudou,
  // ou cidade/estado mudou e o item não tem (nem vai passar a ter) endereço
  // vinculado pra dar uma coordenada mais precisa. Caso contrário, mantém a
  // coordenada que já existia — não tem por que gastar uma consulta à toa.
  const semEnderecoVinculado = !item.enderecoId && !atualizacao.enderecoId;
  if (atualizacao.enderecoId || ((atualizacao.cidade || atualizacao.estado) && semEnderecoVinculado)) {
    const { latitude, longitude } = await resolverCoordenadasItem({
      endereco: enderecoVinculado,
      cidade: atualizacao.cidade || item.cidade,
      estado: atualizacao.estado || item.estado,
    });
    atualizacao.latitude = latitude;
    atualizacao.longitude = longitude;
  }
  if (atualizacao.titulo) atualizacao.titulo = atualizacao.titulo.trim();
  if (atualizacao.descricao) atualizacao.descricao = atualizacao.descricao.trim();

  return prisma.itemDoacao.update({
    where: { id: itemId },
    data: atualizacao,
    include: { imagens: true, categoria: true },
  });
}

async function cancelar(itemId, usuarioId, ehAdmin) {
  const item = ehAdmin
    ? await prisma.itemDoacao.findFirst({ where: { id: itemId, deletadoEm: null } })
    : await verificarDono(itemId, usuarioId);

  if (!item) throw new ErroItem('Item não encontrado', 404);
  if (!STATUS_CANCELAVEIS.includes(item.status)) {
    throw new ErroItem(`Não é possível cancelar um item com status "${item.status}"`, 409);
  }

  // Cancela o item e, na mesma transação, todas as solicitações pendentes dele —
  // evita que fique uma solicitação "pendente" presa a um item já cancelado.
  await prisma.$transaction([
    prisma.itemDoacao.update({
      where: { id: itemId },
      data: { status: 'cancelado', deletadoEm: new Date() },
    }),
    prisma.solicitacaoItem.updateMany({
      where: { itemId, status: 'pendente' },
      data: { status: 'cancelada', respondidoEm: new Date() },
    }),
  ]);
}

// Presença e formato das URLs (e o limite de 10 por payload) já são checados
// pelo Joi na rota (POST /itens/:id/imagens) — o limite total contra o que já
// existe no item precisa do banco, então continua aqui.
async function adicionarImagens(itemId, usuarioId, ehAdmin, urls) {
  const item = await verificarDonoOuAdmin(itemId, usuarioId, ehAdmin);
  if (!STATUS_EDITAVEIS.includes(item.status)) {
    throw new ErroItem(`Não é possível alterar imagens de um item com status "${item.status}"`, 409);
  }

  const totalAtual = await prisma.imagemItem.count({ where: { itemId } });
  if (totalAtual + urls.length > MAX_IMAGENS_POR_ITEM) {
    throw new ErroItem(`Esse item já tem ${totalAtual} imagem(ns); no máximo ${MAX_IMAGENS_POR_ITEM} no total`);
  }

  await prisma.imagemItem.createMany({
    data: urls.map((url, i) => ({ itemId, url, ordem: totalAtual + i })),
  });

  return prisma.imagemItem.findMany({ where: { itemId }, orderBy: { ordem: 'asc' } });
}

// Contraparte de adicionarImagens, para upload real de arquivo (multipart/form-data,
// via multer) em vez de URL colada. `arquivos` é o req.files que o multer preenche —
// cada item já tem `filename` (nome gerado, salvo em DIRETORIO_UPLOADS_ITENS pelo
// middleware) no momento em que essa função roda.
//
// Importante: se essa função lançar erro DEPOIS que o multer já gravou os arquivos em
// disco (ex: item com status errado, limite de imagens excedido), os arquivos ficam
// órfãos no disco — a limpeza correspondente é responsabilidade de quem chama (o
// controller tem acesso a req.files independente de onde a validação falhou).
async function adicionarImagensUpload(itemId, usuarioId, ehAdmin, arquivos) {
  const item = await verificarDonoOuAdmin(itemId, usuarioId, ehAdmin);
  if (!STATUS_EDITAVEIS.includes(item.status)) {
    throw new ErroItem(`Não é possível alterar imagens de um item com status "${item.status}"`, 409);
  }
  if (!arquivos?.length) throw new ErroItem('Nenhum arquivo de imagem enviado');

  const totalAtual = await prisma.imagemItem.count({ where: { itemId } });
  if (totalAtual + arquivos.length > MAX_IMAGENS_POR_ITEM) {
    throw new ErroItem(`Esse item já tem ${totalAtual} imagem(ns); no máximo ${MAX_IMAGENS_POR_ITEM} no total`);
  }

  await prisma.imagemItem.createMany({
    data: arquivos.map((arquivo, i) => ({
      itemId,
      url: `${PREFIXO_URL_UPLOADS_ITENS}${arquivo.filename}`,
      ordem: totalAtual + i,
    })),
  });

  return prisma.imagemItem.findMany({ where: { itemId }, orderBy: { ordem: 'asc' } });
}

async function removerImagem(itemId, imagemId, usuarioId, ehAdmin) {
  const item = await verificarDonoOuAdmin(itemId, usuarioId, ehAdmin);
  if (!STATUS_EDITAVEIS.includes(item.status)) {
    throw new ErroItem(`Não é possível alterar imagens de um item com status "${item.status}"`, 409);
  }

  const imagem = await prisma.imagemItem.findFirst({ where: { id: imagemId, itemId } });
  if (!imagem) throw new ErroItem('Imagem não encontrada', 404);

  await prisma.imagemItem.delete({ where: { id: imagemId } });

  // Só apaga arquivo físico se a imagem for um upload local nosso — uma URL externa
  // (colada manualmente via adicionarImagens) não tem arquivo nenhum no nosso disco.
  if (imagem.url.startsWith(PREFIXO_URL_UPLOADS_ITENS)) {
    await removerArquivoFisico(imagem.url.slice(PREFIXO_URL_UPLOADS_ITENS.length));
  }
}

module.exports = {
  ErroItem,
  criar,
  listar,
  meusItens,
  buscarPorId,
  atualizar,
  cancelar,
  adicionarImagens,
  adicionarImagensUpload,
  removerImagem,
};
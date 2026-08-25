// NOTA: validação de formato (título/descrição obrigatórios, limites de tamanho,
// UF/condição inválida, formato e quantidade de imagens, categoriaId no filtro)
// foi movida para o middleware Joi nas rotas — coberta em
// tests/integration/validacao.test.js. Aqui só sobram as regras que dependem
// do banco (categoria ativa, posse do endereço, dono do item).
jest.mock('../../src/lib/uploads', () => ({
  PREFIXO_URL_UPLOADS_ITENS: '/uploads/itens/',
  removerArquivoFisico: jest.fn().mockResolvedValue(undefined),
}));

const prisma = require('../../src/lib/prisma');
const { removerArquivoFisico } = require('../../src/lib/uploads');
const itemService = require('../../src/services/item.service');

const CATEGORIA_ATIVA = { id: 'cat-1', ativo: true };
const DADOS_BASE = { titulo: 'Sofá 3 lugares', descricao: 'Bom estado', categoriaId: 'cat-1', cidade: 'Curitiba', estado: 'pr' };

afterEach(() => {
  removerArquivoFisico.mockClear();
});

describe('criar', () => {
  test('rejeita categoria inexistente ou inativa', async () => {
    prisma.categoria.findUnique.mockResolvedValue(null);
    await expect(itemService.criar('doador-1', DADOS_BASE)).rejects.toMatchObject({ status: 404 });
  });

  test('rejeita enderecoId que não pertence ao doador', async () => {
    prisma.categoria.findUnique.mockResolvedValue(CATEGORIA_ATIVA);
    prisma.endereco.findFirst.mockResolvedValue(null);

    await expect(itemService.criar('doador-1', { ...DADOS_BASE, enderecoId: 'endereco-de-outro' }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('cria com sucesso, normalizando UF para maiúsculo e usando "usado" como condição padrão', async () => {
    prisma.categoria.findUnique.mockResolvedValue(CATEGORIA_ATIVA);
    prisma.itemDoacao.create.mockResolvedValue({ id: 'item-1', estado: 'PR', condicao: 'usado' });

    await itemService.criar('doador-1', DADOS_BASE);

    expect(prisma.itemDoacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ estado: 'PR', condicao: 'usado', doadorId: 'doador-1' }),
    }));
  });
});

describe('listar', () => {
  test('lista itens disponíveis com paginação', async () => {
    prisma.$transaction.mockResolvedValue([[{ id: 'item-1' }], 1]);

    const resultado = await itemService.listar({});

    expect(resultado.itens).toHaveLength(1);
    expect(resultado.total).toBe(1);
  });
});

describe('buscarPorId', () => {
  const itemBase = {
    id: 'item-1', doadorId: 'doador-1',
    doador: { id: 'doador-1', primeiroNome: 'Ana', telefone: '4199999999' },
    endereco: { cidade: 'Curitiba' },
  };

  test('lança 404 quando o item não existe', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    await expect(itemService.buscarPorId('item-inexistente')).rejects.toMatchObject({ status: 404 });
  });

  test('doador vê o próprio contato e endereço completo', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ ...itemBase });
    const item = await itemService.buscarPorId('item-1', 'doador-1');
    expect(item.endereco).not.toBeNull();
    expect(item.doador.telefone).not.toBeNull();
  });

  test('visitante anônimo (sem usuário logado) não vê contato nem endereço', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ ...itemBase, doador: { ...itemBase.doador } });
    const item = await itemService.buscarPorId('item-1', null);
    expect(item.endereco).toBeNull();
    expect(item.doador.telefone).toBeNull();
  });

  test('outro usuário sem solicitação aceita não vê contato nem endereço', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ ...itemBase, doador: { ...itemBase.doador } });
    prisma.solicitacaoItem.findFirst.mockResolvedValue(null);

    const item = await itemService.buscarPorId('item-1', 'outro-usuario');
    expect(item.endereco).toBeNull();
    expect(item.doador.telefone).toBeNull();
  });

  test('solicitante com solicitação aceita passa a ver contato e endereço', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ ...itemBase, doador: { ...itemBase.doador } });
    prisma.solicitacaoItem.findFirst.mockResolvedValue({ id: 'sol-1', status: 'aceita' });

    const item = await itemService.buscarPorId('item-1', 'solicitante-1');
    expect(item.endereco).not.toBeNull();
    expect(item.doador.telefone).not.toBeNull();
  });
});

describe('atualizar', () => {
  test('usuário comum não dono do item recebe 403/404 (verificarDono)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    await expect(itemService.atualizar('item-1', 'nao-dono', false, { titulo: 'Novo' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('não permite editar item com status não editável (ex: doado)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'doado' });
    await expect(itemService.atualizar('item-1', 'doador-1', false, { titulo: 'Novo' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('gap de segurança corrigido: novo enderecoId precisa pertencer ao doador do item', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.endereco.findFirst.mockResolvedValue(null); // endereço não pertence ao doador

    await expect(itemService.atualizar('item-1', 'doador-1', false, { enderecoId: 'endereco-de-outro' }))
      .rejects.toMatchObject({ status: 403 });

    // Confirma que a checagem de posse usou o doadorId do ITEM, não um valor arbitrário
    expect(prisma.endereco.findFirst).toHaveBeenCalledWith({
      where: { id: 'endereco-de-outro', usuarioId: 'doador-1' },
    });
  });

  test('admin pode atualizar item de outro usuário', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });
    prisma.itemDoacao.update.mockResolvedValue({ id: 'item-1', titulo: 'Editado pelo admin' });

    const resultado = await itemService.atualizar('item-1', 'admin-1', true, { titulo: 'Editado pelo admin' });
    expect(resultado.titulo).toBe('Editado pelo admin');
  });

  test('atualização válida normaliza UF e faz trim no título/descrição', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.itemDoacao.update.mockResolvedValue({});

    await itemService.atualizar('item-1', 'doador-1', false, { titulo: '  Novo título  ', estado: 'sp' });

    expect(prisma.itemDoacao.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ titulo: 'Novo título', estado: 'SP' }),
    }));
  });
});

describe('cancelar', () => {
  test('não permite cancelar item já doado', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'doado' });
    await expect(itemService.cancelar('item-1', 'doador-1', false)).rejects.toMatchObject({ status: 409 });
  });

  test('cancela o item e as solicitações pendentes numa mesma transação', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.itemDoacao.update.mockResolvedValue({});
    prisma.solicitacaoItem.updateMany.mockResolvedValue({});

    await itemService.cancelar('item-1', 'doador-1', false);

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.solicitacaoItem.updateMany).toHaveBeenCalledWith({
      where: { itemId: 'item-1', status: 'pendente' },
      data: { status: 'cancelada', respondidoEm: expect.any(Date) },
    });
  });
});

describe('adicionarImagens', () => {
  test('rejeita quando ultrapassa o limite total de 10 imagens', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(8);

    await expect(itemService.adicionarImagens('item-1', 'doador-1', false, [
      'https://example.com/a.jpg', 'https://example.com/b.jpg', 'https://example.com/c.jpg',
    ])).rejects.toThrow(/no máximo 10 no total/);
  });

  test('adiciona imagens respeitando a ordem crescente', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(2);
    prisma.imagemItem.createMany.mockResolvedValue({});
    prisma.imagemItem.findMany.mockResolvedValue([]);

    await itemService.adicionarImagens('item-1', 'doador-1', false, ['https://example.com/a.jpg']);

    expect(prisma.imagemItem.createMany).toHaveBeenCalledWith({
      data: [{ itemId: 'item-1', url: 'https://example.com/a.jpg', ordem: 2 }],
    });
  });

  test('usuário comum não consegue adicionar imagem em item de outro usuário', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });

    await expect(itemService.adicionarImagens('item-1', 'doador-1', false, ['https://example.com/a.jpg']))
      .rejects.toMatchObject({ status: 403 });
  });

  test('admin consegue adicionar imagem em item de qualquer usuário (controle total)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(0);
    prisma.imagemItem.createMany.mockResolvedValue({});
    prisma.imagemItem.findMany.mockResolvedValue([]);

    await itemService.adicionarImagens('item-1', 'admin-1', true, ['https://example.com/a.jpg']);

    expect(prisma.imagemItem.createMany).toHaveBeenCalled();
  });
});

describe('adicionarImagensUpload', () => {
  const arquivosFake = [{ filename: 'abc-123.jpg' }, { filename: 'def-456.png' }];

  test('rejeita quando nenhum arquivo foi enviado', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    await expect(itemService.adicionarImagensUpload('item-1', 'doador-1', false, [])).rejects.toThrow(/Nenhum arquivo/);
  });

  test('rejeita quando ultrapassa o limite total de 10 imagens', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(9);

    await expect(itemService.adicionarImagensUpload('item-1', 'doador-1', false, arquivosFake))
      .rejects.toThrow(/no máximo 10 no total/);
  });

  test('cria as ImagemItem com a URL apontando para /uploads/itens/<nome-gerado>', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(0);
    prisma.imagemItem.createMany.mockResolvedValue({});
    prisma.imagemItem.findMany.mockResolvedValue([]);

    await itemService.adicionarImagensUpload('item-1', 'doador-1', false, arquivosFake);

    expect(prisma.imagemItem.createMany).toHaveBeenCalledWith({
      data: [
        { itemId: 'item-1', url: '/uploads/itens/abc-123.jpg', ordem: 0 },
        { itemId: 'item-1', url: '/uploads/itens/def-456.png', ordem: 1 },
      ],
    });
  });

  test('item de outro usuário rejeita antes de mexer no banco de imagens (usuário comum)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });

    await expect(itemService.adicionarImagensUpload('item-1', 'doador-1', false, arquivosFake))
      .rejects.toMatchObject({ status: 403 });
    expect(prisma.imagemItem.createMany).not.toHaveBeenCalled();
  });

  test('admin consegue enviar imagem em item de qualquer usuário (controle total)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(0);
    prisma.imagemItem.createMany.mockResolvedValue({});
    prisma.imagemItem.findMany.mockResolvedValue([]);

    await itemService.adicionarImagensUpload('item-1', 'admin-1', true, arquivosFake);

    expect(prisma.imagemItem.createMany).toHaveBeenCalled();
  });
});

describe('removerImagem — limpeza de arquivo físico', () => {
  test('imagem de upload local (URL começa com /uploads/itens/): apaga também o arquivo físico', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.findFirst.mockResolvedValue({ id: 'img-1', url: '/uploads/itens/abc-123.jpg' });
    prisma.imagemItem.delete.mockResolvedValue({});

    await itemService.removerImagem('item-1', 'img-1', 'doador-1');

    expect(removerArquivoFisico).toHaveBeenCalledWith('abc-123.jpg');
  });

  test('imagem de URL externa (não é upload local): NÃO tenta apagar arquivo físico', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.findFirst.mockResolvedValue({ id: 'img-1', url: 'https://exemplo.com/foto.jpg' });
    prisma.imagemItem.delete.mockResolvedValue({});

    await itemService.removerImagem('item-1', 'img-1', 'doador-1');

    expect(removerArquivoFisico).not.toHaveBeenCalled();
  });
});

describe('removerImagem', () => {
  test('lança 404 quando a imagem não pertence ao item', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.findFirst.mockResolvedValue(null);

    await expect(itemService.removerImagem('item-1', 'imagem-de-outro-item', 'doador-1'))
      .rejects.toMatchObject({ status: 404 });
  });

  test('usuário comum não consegue remover imagem de item de outro usuário', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });

    await expect(itemService.removerImagem('item-1', 'img-1', 'doador-1', false))
      .rejects.toMatchObject({ status: 403 });
    expect(prisma.imagemItem.delete).not.toHaveBeenCalled();
  });

  test('admin consegue remover imagem de item de qualquer usuário (controle total)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1', doadorId: 'outro-usuario', status: 'disponivel' });
    prisma.imagemItem.findFirst.mockResolvedValue({ id: 'img-1', url: 'https://exemplo.com/foto.jpg' });
    prisma.imagemItem.delete.mockResolvedValue({});

    await itemService.removerImagem('item-1', 'img-1', 'admin-1', true);

    expect(prisma.imagemItem.delete).toHaveBeenCalledWith({ where: { id: 'img-1' } });
  });
});

describe('criar — coordenadas do item', () => {
  test('com enderecoId: usa a coordenada do endereço vinculado (mais precisa), não consulta centroide', async () => {
    prisma.categoria.findUnique.mockResolvedValue(CATEGORIA_ATIVA);
    prisma.endereco.findFirst.mockResolvedValue({ id: 'end-1', latitude: -23.5, longitude: -46.6 });
    prisma.itemDoacao.create.mockResolvedValue({ id: 'item-1' });

    await itemService.criar('doador-1', { ...DADOS_BASE, enderecoId: 'end-1' });

    expect(prisma.itemDoacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: -23.5, longitude: -46.6 }),
    }));
    expect(prisma.cidadeCentroide.findUnique).not.toHaveBeenCalled();
  });

  test('sem enderecoId: cai pro centroide da cidade/estado quando existe', async () => {
    prisma.categoria.findUnique.mockResolvedValue(CATEGORIA_ATIVA);
    prisma.cidadeCentroide.findUnique.mockResolvedValue({ latitude: -25.4284, longitude: -49.2733 });
    prisma.itemDoacao.create.mockResolvedValue({ id: 'item-1' });

    await itemService.criar('doador-1', DADOS_BASE);

    expect(prisma.cidadeCentroide.findUnique).toHaveBeenCalledWith({
      where: { cidade_estado: { cidade: 'Curitiba', estado: 'PR' } },
    });
    expect(prisma.itemDoacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: -25.4284, longitude: -49.2733 }),
    }));
  });

  test('sem enderecoId e sem centroide cadastrado: fica com latitude/longitude null (item continua sendo criado)', async () => {
    prisma.categoria.findUnique.mockResolvedValue(CATEGORIA_ATIVA);
    prisma.cidadeCentroide.findUnique.mockResolvedValue(null);
    prisma.itemDoacao.create.mockResolvedValue({ id: 'item-1' });

    await itemService.criar('doador-1', DADOS_BASE);

    expect(prisma.itemDoacao.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: null, longitude: null }),
    }));
  });
});

describe('atualizar — recalcula coordenadas só quando necessário', () => {
  const itemExistente = { id: 'item-1', doadorId: 'doador-1', status: 'disponivel', cidade: 'Curitiba', estado: 'PR', enderecoId: null };

  test('mudar cidade sem endereço vinculado: recalcula via centroide', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(itemExistente);
    prisma.cidadeCentroide.findUnique.mockResolvedValue({ latitude: -23.5505, longitude: -46.6333 });
    prisma.itemDoacao.update.mockResolvedValue({});

    await itemService.atualizar('item-1', 'doador-1', false, { cidade: 'São Paulo' });

    expect(prisma.cidadeCentroide.findUnique).toHaveBeenCalledWith({
      where: { cidade_estado: { cidade: 'São Paulo', estado: 'PR' } }, // estado mantém o que já tinha
    });
    expect(prisma.itemDoacao.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: -23.5505, longitude: -46.6333 }),
    }));
  });

  test('trocar título apenas: não recalcula coordenadas nem consulta centroide/endereço', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(itemExistente);
    prisma.itemDoacao.update.mockResolvedValue({});

    await itemService.atualizar('item-1', 'doador-1', false, { titulo: 'Novo título' });

    expect(prisma.cidadeCentroide.findUnique).not.toHaveBeenCalled();
    expect(prisma.itemDoacao.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.not.objectContaining({ latitude: expect.anything() }),
    }));
  });

  test('vincular um endereço: usa a coordenada dele, ignora o centroide', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(itemExistente);
    prisma.endereco.findFirst.mockResolvedValue({ id: 'end-2', latitude: -25.0, longitude: -50.0 });
    prisma.itemDoacao.update.mockResolvedValue({});

    await itemService.atualizar('item-1', 'doador-1', false, { enderecoId: 'end-2' });

    expect(prisma.cidadeCentroide.findUnique).not.toHaveBeenCalled();
    expect(prisma.itemDoacao.update).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ latitude: -25.0, longitude: -50.0 }),
    }));
  });
});

describe('listar — busca por raio (PostGIS)', () => {
  test('sem lat/lng/raioKm: caminho normal (Prisma findMany), nunca toca $queryRawUnsafe', async () => {
    prisma.$transaction.mockResolvedValue([[], 0]);

    await itemService.listar({});

    expect(prisma.$queryRawUnsafe).not.toHaveBeenCalled();
  });

  test('com lat/lng/raioKm: filtra por distância, reordena e enriquece com categoria/imagens/doador', async () => {
    prisma.$queryRawUnsafe
      .mockResolvedValueOnce([
        { id: 'item-2', distancia_km: 1.5 },
        { id: 'item-1', distancia_km: 3.2 },
      ])
      .mockResolvedValueOnce([{ total: 2 }]);
    // findMany devolve fora de ordem de propósito — confirma que o serviço reordena pela distância
    prisma.itemDoacao.findMany.mockResolvedValue([
      { id: 'item-1', titulo: 'Item 1' },
      { id: 'item-2', titulo: 'Item 2' },
    ]);

    const resultado = await itemService.listar({ lat: '-23.5', lng: '-46.6', raioKm: '10' });

    expect(resultado.itens.map((i) => i.id)).toEqual(['item-2', 'item-1']);
    expect(resultado.itens[0].distanciaKm).toBe(1.5);
    expect(resultado.total).toBe(2);
    expect(prisma.itemDoacao.findMany).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: { in: ['item-2', 'item-1'] } },
    }));
  });

  test('nenhum item dentro do raio: devolve lista vazia sem chamar o findMany de enriquecimento', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    const resultado = await itemService.listar({ lat: '-23.5', lng: '-46.6', raioKm: '1' });

    expect(resultado).toEqual({ itens: [], total: 0, pagina: 1, tamanho: 12 });
    expect(prisma.itemDoacao.findMany).not.toHaveBeenCalled();
  });

  test('filtros extras (categoria/cidade/estado/busca) entram na query raw junto com o raio', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    await itemService.listar({
      lat: '-23.5', lng: '-46.6', raioKm: '10',
      categoriaId: 'cat-1', cidade: 'Curitiba', estado: 'pr', busca: 'sofá',
    });

    const [sqlSelect, ...valoresSelect] = prisma.$queryRawUnsafe.mock.calls[0];
    expect(sqlSelect).toContain('categoria_id = $2');
    expect(sqlSelect).toContain('cidade ILIKE $3');
    expect(sqlSelect).toContain('estado::text = $4');
    expect(sqlSelect).toContain('ILIKE $5');
    expect(valoresSelect).toEqual(expect.arrayContaining(['cat-1', 'Curitiba', 'PR', '%sofá%']));
  });
});
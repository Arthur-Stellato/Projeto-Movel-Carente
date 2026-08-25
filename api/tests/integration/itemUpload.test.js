const fs = require('fs');
const path = require('path');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const { DIRETORIO_UPLOADS_ITENS } = require('../../src/lib/uploads');

const ITEM_ID = '550e8400-e29b-41d4-a716-446655440000';
const IMAGEM_ID = '660e8400-e29b-41d4-a716-446655440000';

function gerarToken(sub = 'doador-1') {
  return jwt.sign({ sub, tipo: 'usuario' }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function listarArquivosNoDisco() {
  return fs.readdirSync(DIRETORIO_UPLOADS_ITENS);
}

describe('POST /itens/:id/imagens/upload', () => {
  test('sem token, devolve 401 e não grava nada em disco', async () => {
    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .attach('imagens', Buffer.from('fake-jpg-bytes'), { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(401);
    expect(listarArquivosNoDisco()).toEqual(antes); // multer nem chegou a rodar
  });

  test('upload de imagens válidas: 201, grava no disco e cria as ImagemItem', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: ITEM_ID, doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(0);
    prisma.imagemItem.createMany.mockResolvedValue({});
    prisma.imagemItem.findMany.mockResolvedValue([{ id: 'img-1', url: '/uploads/itens/x.jpg', ordem: 0 }]);

    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('imagens', Buffer.from('fake-jpg-bytes'), { filename: 'foto1.jpg', contentType: 'image/jpeg' })
      .attach('imagens', Buffer.from('fake-png-bytes'), { filename: 'foto2.png', contentType: 'image/png' });

    expect(res.status).toBe(201);
    expect(res.body.imagens).toHaveLength(1); // valor mockado acima

    const depois = listarArquivosNoDisco();
    expect(depois.length).toBe(antes.length + 2); // os 2 arquivos ficaram gravados de verdade

    expect(prisma.imagemItem.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({ itemId: ITEM_ID, ordem: 0 }),
        expect.objectContaining({ itemId: ITEM_ID, ordem: 1 }),
      ]),
    });
  });

  test('extensão é derivada estritamente do MIME type, neutralizando extensões executáveis no originalname', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: ITEM_ID, doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.count.mockResolvedValue(0);
    prisma.imagemItem.createMany.mockResolvedValue({});
    prisma.imagemItem.findMany.mockResolvedValue([{ id: 'img-1', url: '/uploads/itens/x.jpg', ordem: 0 }]);

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('imagens', Buffer.from('fake-jpg-bytes'), { filename: 'malicious.html', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);

    // O arquivo gravado no banco DEVE terminar em .jpg, não .html
    const chamada = prisma.imagemItem.createMany.mock.calls[0][0];
    expect(chamada.data[0].url).toMatch(/\.jpg$/);
    expect(chamada.data[0].url).not.toMatch(/\.html$/);
  });

  test('tipo de arquivo não permitido (ex: PDF): 400, e não grava nada em disco', async () => {
    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('imagens', Buffer.from('%PDF-1.4 fake'), { filename: 'documento.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/JPEG, PNG ou WebP/);
    expect(listarArquivosNoDisco()).toEqual(antes);
    expect(prisma.imagemItem.createMany).not.toHaveBeenCalled();
  });

  test('arquivo maior que o limite de 5MB: 400, e não deixa arquivo parcial no disco', async () => {
    const antes = listarArquivosNoDisco();
    const arquivoGrande = Buffer.alloc(6 * 1024 * 1024, 'a'); // 6MB > limite de 5MB

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('imagens', arquivoGrande, { filename: 'foto-grande.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/5MB/);
    expect(listarArquivosNoDisco()).toEqual(antes);
  });

  test('item pertence a outro usuário: 403, e o arquivo já salvo pelo multer é limpo do disco (sem lixo órfão)', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: ITEM_ID, doadorId: 'outro-usuario', status: 'disponivel' });

    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .set('Authorization', `Bearer ${gerarToken('doador-1')}`)
      .attach('imagens', Buffer.from('fake-jpg-bytes'), { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    // O multer grava o arquivo ANTES do controller validar posse — o ponto central
    // deste teste é confirmar que o controller limpa esse arquivo órfão depois.
    expect(listarArquivosNoDisco()).toEqual(antes);
  });

  test('item com status não editável (ex: doado): 409, e também limpa o arquivo órfão', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: ITEM_ID, doadorId: 'doador-1', status: 'doado' });

    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/itens/${ITEM_ID}/imagens/upload`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('imagens', Buffer.from('fake-jpg-bytes'), { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(409);
    expect(listarArquivosNoDisco()).toEqual(antes);
  });
});

describe('DELETE /itens/:id/imagens/:imagemId — remove também o arquivo físico', () => {
  test('remove a ImagemItem do banco e o arquivo correspondente do disco', async () => {
    // Grava um arquivo "de verdade" simulando um upload anterior
    const nomeArquivo = 'imagem-existente-de-teste.jpg';
    fs.writeFileSync(path.join(DIRETORIO_UPLOADS_ITENS, nomeArquivo), 'conteudo-fake');

    prisma.itemDoacao.findFirst.mockResolvedValue({ id: ITEM_ID, doadorId: 'doador-1', status: 'disponivel' });
    prisma.imagemItem.findFirst.mockResolvedValue({ id: IMAGEM_ID, url: `/uploads/itens/${nomeArquivo}` });
    prisma.imagemItem.delete.mockResolvedValue({});

    const res = await request(app)
      .delete(`/itens/${ITEM_ID}/imagens/${IMAGEM_ID}`)
      .set('Authorization', `Bearer ${gerarToken()}`);

    expect(res.status).toBe(204);
    expect(fs.existsSync(path.join(DIRETORIO_UPLOADS_ITENS, nomeArquivo))).toBe(false);
  });
});

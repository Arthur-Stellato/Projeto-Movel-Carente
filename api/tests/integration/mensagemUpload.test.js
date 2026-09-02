const fs = require('fs');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');
const { DIRETORIO_UPLOADS_MENSAGENS } = require('../../src/lib/uploads');

const SOLICITACAO_ID = '550e8400-e29b-41d4-a716-446655440000';
const DOADOR_ID = 'doador-1';
const SOLICITANTE_ID = 'solicitante-1';

const SOLICITACAO_FAKE = {
  id: SOLICITACAO_ID,
  status: 'aceita',
  solicitanteId: SOLICITANTE_ID,
  item: { id: 'item-1', doadorId: DOADOR_ID, titulo: 'Sofá 3 lugares' },
};

function gerarToken(sub = DOADOR_ID) {
  return jwt.sign({ sub, tipo: 'usuario' }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

function listarArquivosNoDisco() {
  return fs.readdirSync(DIRETORIO_UPLOADS_MENSAGENS);
}

describe('POST /solicitacoes/:id/mensagens/anexo', () => {
  test('upload de imagem válida: 201, { url, tipo: "imagem" } e grava no disco', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('arquivo', Buffer.from('fake-jpg-bytes'), { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('imagem');
    expect(res.body.url).toMatch(/^\/uploads\/mensagens\/.+\.jpg$/);

    const depois = listarArquivosNoDisco();
    expect(depois.length).toBe(antes.length + 1);
  });

  test('upload de vídeo válido: 201, { url, tipo: "video" }', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('arquivo', Buffer.from('fake-mp4-bytes'), { filename: 'video.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(201);
    expect(res.body.tipo).toBe('video');
    expect(res.body.url).toMatch(/^\/uploads\/mensagens\/.+\.mp4$/);
  });

  test('mimetype não suportado (ex: PDF): 400, e não grava nada no disco', async () => {
    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('arquivo', Buffer.from('%PDF-1.4 fake'), { filename: 'documento.pdf', contentType: 'application/pdf' });

    expect(res.status).toBe(400);
    expect(listarArquivosNoDisco()).toEqual(antes);
  });

  test('imagem acima de 5MB: 400, "excede o limite" e arquivo limpo do disco', async () => {
    const antes = listarArquivosNoDisco();
    const arquivoGrande = Buffer.alloc(6 * 1024 * 1024, 'a'); // 6MB > limite de 5MB p/ imagem

    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('arquivo', arquivoGrande, { filename: 'foto-grande.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/excede o limite/);
    expect(listarArquivosNoDisco()).toEqual(antes);
  });

  test('vídeo acima de 50MB: 400, "excede o limite" e arquivo limpo do disco', async () => {
    const antes = listarArquivosNoDisco();
    const arquivoGrande = Buffer.alloc(51 * 1024 * 1024, 'a'); // 51MB > limite de 50MB p/ vídeo

    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .attach('arquivo', arquivoGrande, { filename: 'video-grande.mp4', contentType: 'video/mp4' });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/excede o limite/);
    expect(listarArquivosNoDisco()).toEqual(antes);
  });

  test('usuário que não é doador nem solicitante daquela solicitação: 403, e o arquivo já gravado pelo multer é removido', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue(SOLICITACAO_FAKE);

    const antes = listarArquivosNoDisco();

    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken('usuario-estranho')}`)
      .attach('arquivo', Buffer.from('fake-jpg-bytes'), { filename: 'foto.jpg', contentType: 'image/jpeg' });

    expect(res.status).toBe(403);
    // O multer grava o arquivo ANTES do controller validar participação — o ponto
    // central deste teste é confirmar que o controller limpa esse arquivo órfão depois.
    expect(listarArquivosNoDisco()).toEqual(antes);
  });

  test('sem nenhum arquivo anexado no form-data: 400, "Nenhum arquivo enviado"', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${SOLICITACAO_ID}/mensagens/anexo`)
      .set('Authorization', `Bearer ${gerarToken()}`);

    expect(res.status).toBe(400);
    expect(res.body.erro).toBe('Nenhum arquivo enviado');
  });
});

// Trava a causa raiz de um bug real: CORS_ORIGIN configurado como string fixa
// sempre ecoa o MESMO valor no header Access-Control-Allow-Origin, não importa
// a origem de quem pediu — isso faz o navegador bloquear qualquer origem
// diferente da configurada (o frontend em localhost:5173 apanhava disso quando
// CORS_ORIGIN só tinha localhost:3000). A correção usa um array de origens
// permitidas, e o pacote `cors` reflete de volta a origem que bate.
//
// Define CORS_ORIGIN ANTES de importar app.js de propósito: app.js chama
// dotenv.config() na primeira linha, que carregaria o .env real da máquina
// (não determinístico — cada dev tem o seu, CI não tem nenhum). dotenv não
// sobrescreve uma env var que já está setada, então definir aqui garante que
// o teste sempre roda com o valor esperado, não com o que estiver no .env local.
process.env.CORS_ORIGIN = 'http://localhost:3000,http://localhost:5173';

const request = require('supertest');
const app = require('../../src/app');

describe('CORS', () => {
  test('origem do Swagger UI (localhost:3000) é refletida no header', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:3000');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:3000');
  });

  test('origem do frontend em desenvolvimento (Vite, localhost:5173) é refletida no header', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });

  test('origem fora da lista permitida NÃO recebe o header (navegador bloqueia)', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://site-nao-autorizado.com');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
  });

  test('credentials habilitado — necessário pro cookie de refresh token funcionar cross-origin', async () => {
    const res = await request(app).get('/health').set('Origin', 'http://localhost:5173');
    expect(res.headers['access-control-allow-credentials']).toBe('true');
  });

  test('preflight (OPTIONS) numa rota autenticada responde 204 com a origem correta refletida', async () => {
    const res = await request(app)
      .options('/auth/login')
      .set('Origin', 'http://localhost:5173')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'content-type');

    expect(res.status).toBe(204);
    expect(res.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

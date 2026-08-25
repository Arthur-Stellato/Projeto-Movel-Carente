// NOTA: formato de CEP (8 dígitos) já é checado pelo Joi na rota (GET
// /cep/:cep) — coberta em tests/integration/validacao.test.js. Aqui testamos
// as 3 camadas em si: cache, provedor externo (fetch mockado), persistência —
// para os dois provedores suportados (ViaCEP, o padrão, e BrasilAPI, a
// alternativa preservada via CEP_PROVIDER=brasilapi).
const prisma = require('../../src/lib/prisma');
const cepService = require('../../src/services/cep.service');

function respostaViaCepFake(overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      cep: '86300-000',
      logradouro: 'Rua Exemplo',
      complemento: '',
      bairro: 'Centro',
      localidade: 'Cornélio Procópio',
      uf: 'PR',
      estado: 'Paraná',
      regiao: 'Sul',
      ibge: '4106001',
      ...overrides,
    }),
  };
}

function respostaBrasilApiFake(overrides = {}) {
  return {
    ok: true,
    status: 200,
    json: async () => ({
      cep: '86300000',
      state: 'PR',
      city: 'Cornélio Procópio',
      neighborhood: 'Centro',
      street: 'Rua Exemplo',
      service: 'brasilapi',
      location: { type: 'Point', coordinates: { latitude: '-23.1809', longitude: '-50.6428' } },
      ...overrides,
    }),
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
  delete process.env.CEP_PROVIDER; // garante o padrão (ViaCEP) a menos que um teste diga o contrário
});

afterEach(() => {
  delete global.fetch;
  delete process.env.CEP_PROVIDER;
});

describe('buscarCep', () => {
  test('rejeita CEP com formato inválido antes de tocar cache ou provedor externo', async () => {
    await expect(cepService.buscarCep('123')).rejects.toMatchObject({ status: 400 });
    expect(prisma.cepCache.findUnique).not.toHaveBeenCalled();
    expect(global.fetch).not.toHaveBeenCalled();
  });

  test('camada 1 — cache local: CEP já conhecido nunca chama o provedor externo', async () => {
    prisma.cepCache.findUnique.mockResolvedValue({
      cep: '86300000', cidade: 'Cornélio Procópio', estado: 'PR', latitude: null, longitude: null,
    });

    const resultado = await cepService.buscarCep('86300-000');

    expect(resultado.cidade).toBe('Cornélio Procópio');
    expect(global.fetch).not.toHaveBeenCalled();
    expect(prisma.cepCache.upsert).not.toHaveBeenCalled();
  });
});

describe('buscarCep — ViaCEP (provedor padrão)', () => {
  test('camada 2+3 — CEP novo: consulta o ViaCEP e persiste no cache, sem coordenadas', async () => {
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue(respostaViaCepFake());
    prisma.cepCache.upsert.mockResolvedValue({ cep: '86300000', cidade: 'Cornélio Procópio' });

    await cepService.buscarCep('86300000');

    expect(global.fetch).toHaveBeenCalledWith(
      'https://viacep.com.br/ws/86300000/json/',
      expect.objectContaining({ signal: expect.anything() })
    );
    expect(prisma.cepCache.upsert).toHaveBeenCalledWith({
      where: { cep: '86300000' },
      create: expect.objectContaining({
        cep: '86300000', cidade: 'Cornélio Procópio', estado: 'PR', latitude: null, longitude: null,
      }),
      update: expect.objectContaining({ cidade: 'Cornélio Procópio' }),
    });
  });

  test('CEP de formato válido mas inexistente: ViaCEP devolve 200 com { erro: true } — precisa virar 404, não sucesso', async () => {
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue({ ok: true, status: 200, json: async () => ({ erro: true }) });

    await expect(cepService.buscarCep('99999999')).rejects.toMatchObject({ status: 404 });
    expect(prisma.cepCache.upsert).not.toHaveBeenCalled();
  });

  test('CEP malformado: ViaCEP devolve 400 de verdade', async () => {
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue({ ok: false, status: 400 });

    await expect(cepService.buscarCep('86300000')).rejects.toMatchObject({ status: 400 });
  });

  test('ViaCEP fora do ar (fetch rejeita): lança 502 em vez de travar', async () => {
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockRejectedValue(new Error('network error'));

    await expect(cepService.buscarCep('86300000')).rejects.toMatchObject({ status: 502 });
  });

  test('ViaCEP devolve status inesperado (ex: 500): lança 502', async () => {
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue({ ok: false, status: 500 });

    await expect(cepService.buscarCep('86300000')).rejects.toMatchObject({ status: 502 });
  });
});

describe('buscarCep — BrasilAPI (alternativa via CEP_PROVIDER=brasilapi)', () => {
  test('trocar CEP_PROVIDER pra brasilapi consulta a URL da BrasilAPI, não a do ViaCEP', async () => {
    process.env.CEP_PROVIDER = 'brasilapi';
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue(respostaBrasilApiFake());
    prisma.cepCache.upsert.mockResolvedValue({});

    await cepService.buscarCep('86300000');

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('brasilapi.com.br'),
      expect.anything()
    );
  });

  test('com BrasilAPI, coordenadas são persistidas quando disponíveis (diferença real entre os dois provedores)', async () => {
    process.env.CEP_PROVIDER = 'brasilapi';
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue(respostaBrasilApiFake());
    prisma.cepCache.upsert.mockResolvedValue({});

    await cepService.buscarCep('86300000');

    expect(prisma.cepCache.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ latitude: -23.1809, longitude: -50.6428 }),
    }));
  });

  test('CEP sem geolocalização na BrasilAPI: salva com latitude/longitude null, sem quebrar', async () => {
    process.env.CEP_PROVIDER = 'brasilapi';
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue(respostaBrasilApiFake({ location: { type: 'Point', coordinates: {} } }));
    prisma.cepCache.upsert.mockResolvedValue({});

    await cepService.buscarCep('86300000');

    expect(prisma.cepCache.upsert).toHaveBeenCalledWith(expect.objectContaining({
      create: expect.objectContaining({ latitude: null, longitude: null }),
    }));
  });

  test('CEP inexistente (404 da BrasilAPI) lança 404, sem persistir nada', async () => {
    process.env.CEP_PROVIDER = 'brasilapi';
    prisma.cepCache.findUnique.mockResolvedValue(null);
    global.fetch.mockResolvedValue({ ok: false, status: 404 });

    await expect(cepService.buscarCep('99999999')).rejects.toMatchObject({ status: 404 });
    expect(prisma.cepCache.upsert).not.toHaveBeenCalled();
  });
});

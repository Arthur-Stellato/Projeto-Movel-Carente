// Testes de integração da camada de validação Joi (src/validations/*.js +
// src/middlewares/validar.middleware.js), batendo nas rotas de verdade via
// Supertest — não nos services diretamente.
//
// Esses casos existiam antes como testes unitários dos services (ver as notas
// deixadas em tests/unit/*.service.test.js apontando pra cá). Migraram porque
// a validação de formato/campo saiu do service e virou middleware de rota:
// chamar o service direto não passa mais por ela.
//
// Padrão de cada teste: manda um payload inválido, espera 400 com uma
// mensagem de erro fazendo sentido, e confirma que o Prisma NUNCA foi
// chamado — prova de que o middleware barrou a requisição antes de tocar o
// banco (senão o teste não estaria testando o que promete).

const request = require('supertest');
const jwt = require('jsonwebtoken');
const app = require('../../src/app');
const prisma = require('../../src/lib/prisma');

function gerarToken({ tipo = 'usuario', sub = 'usuario-1' } = {}) {
  return jwt.sign({ sub, tipo }, process.env.JWT_SECRET, { expiresIn: '15m' });
}

const CPF_VALIDO = '11144477735';
const CNPJ_VALIDO = '11222333000181';
const UUID_VALIDO = '550e8400-e29b-41d4-a716-446655440000';

function prismaFoiChamado() {
  return Object.values(prisma).some((modelo) =>
    typeof modelo === 'object' && modelo !== null
      ? Object.values(modelo).some((fn) => typeof fn?.mock === 'object' && fn.mock.calls.length > 0)
      : false
  );
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================
// AUTH
// ============================================================
describe('POST /auth/registro', () => {
  test('rejeita campos obrigatórios ausentes', async () => {
    const res = await request(app).post('/auth/registro').send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/obrigat/i);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita email com formato inválido', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'nao-e-um-email', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/email/i);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita email de provedor descartável/temporário', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'teste@mailinator.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/descart/i);
  });

  test('rejeita CPF inválido (checksum incorreto)', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: '12345678900', senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CPF/i);
  });

  test('aceita CNPJ válido e o normaliza antes de chegar ao banco', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'empresa-1', email: 'empresa@example.com', tipo: 'usuario' });

    const res = await request(app).post('/auth/registro').send({
      email: 'empresa@example.com', cnpj: '11.222.333/0001-81', senha: 'SenhaForte@123',
      primeiroNome: 'Empresa', ultimoNome: 'Parceira',
    });

    expect(res.status).toBe(201);
    expect(prisma.usuario.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ cnpj: CNPJ_VALIDO }),
    }));
  });

  test('rejeita CNPJ inválido', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'empresa@example.com', cnpj: '11222333000180', senha: 'SenhaForte@123',
      primeiroNome: 'Empresa', ultimoNome: 'Parceira',
    });

    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CNPJ/i);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('exige exatamente um documento: CPF ou CNPJ', async () => {
    const dadosBase = { email: 'empresa@example.com', senha: 'SenhaForte@123', primeiroNome: 'Empresa', ultimoNome: 'Parceira' };

    const semDocumento = await request(app).post('/auth/registro').send(dadosBase);
    expect(semDocumento.status).toBe(400);
    expect(semDocumento.body.erro).toMatch(/CPF ou CNPJ/i);

    const ambosDocumentos = await request(app).post('/auth/registro').send({ ...dadosBase, cpf: CPF_VALIDO, cnpj: CNPJ_VALIDO });
    expect(ambosDocumentos.status).toBe(400);
    expect(ambosDocumentos.body.erro).toMatch(/CPF ou CNPJ/i);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita senha curta/fraca', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: '123',
      primeiroNome: 'A', ultimoNome: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/senha/i);
  });

  test('rejeita primeiro nome acima de 100 caracteres', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'a'.repeat(101), ultimoNome: 'B',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/100 caracteres/);
  });

  test('rejeita telefone com DDD inexistente', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B', telefone: '0099998888',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Telefone inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita telefone de outro país (DDD é conceito só do Brasil)', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B', telefone: '+14155552671',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Telefone inválido/);
  });

  test('telefone válido é normalizado pra E.164 antes de chegar no service', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'u1', email: 'a@example.com', tipo: 'usuario' });

    await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B', telefone: '(11) 99999-8888',
    });

    expect(prisma.usuario.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ telefone: '+5511999998888' }),
    }));
  });

  test('deixa passar payload válido (chega ao service/banco)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: 'u1', email: 'joana@example.com', primeiroNome: 'Joana', ultimoNome: 'Silva', tipo: 'usuario',
    });

    const res = await request(app).post('/auth/registro').send({
      email: '  Joana@Example.COM  ', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'Joana', ultimoNome: 'Silva',
    });

    expect(res.status).toBe(201);
    expect(prisma.usuario.create).toHaveBeenCalled();
  });

  test('rejeita gênero fora da lista permitida', async () => {
    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B', genero: 'nao-binario',
    });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Gênero inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('gênero é opcional — registro sem ele passa normalmente (cai no default do banco)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'u1', email: 'a@example.com', tipo: 'usuario' });

    const res = await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    });

    expect(res.status).toBe(201);
    expect(prisma.usuario.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ genero: undefined }),
    }));
  });

  test('gênero válido chega ao service intacto', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'u1', email: 'a@example.com', tipo: 'usuario' });

    await request(app).post('/auth/registro').send({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B', genero: 'feminino',
    });

    expect(prisma.usuario.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ genero: 'feminino' }),
    }));
  });
});

describe('POST /auth/login', () => {
  test('rejeita email e senha ausentes', async () => {
    const res = await request(app).post('/auth/login').send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Email e senha são obrigatórios/);
    expect(prismaFoiChamado()).toBe(false);
  });
});

describe('POST /auth/esqueci-senha', () => {
  test('rejeita email com formato inválido', async () => {
    const res = await request(app).post('/auth/esqueci-senha').send({ email: 'nao-e-email' });
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita ausência de email', async () => {
    const res = await request(app).post('/auth/esqueci-senha').send({});
    expect(res.status).toBe(400);
  });
});

describe('POST /auth/redefinir-senha', () => {
  test('rejeita token e nova senha ausentes', async () => {
    const res = await request(app).post('/auth/redefinir-senha').send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Token e nova senha são obrigatórios/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita nova senha fraca mesmo com token presente', async () => {
    const res = await request(app).post('/auth/redefinir-senha').send({ token: 'abc', novaSenha: '123' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/A senha deve ter no mínimo 8 caracteres/);
    expect(prismaFoiChamado()).toBe(false);
  });
});

describe('POST /auth/reenviar-verificacao', () => {
  test('rejeita email com formato inválido', async () => {
    const res = await request(app).post('/auth/reenviar-verificacao').send({ email: 'nao-e-email' });
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });
});

describe('POST /auth/verificar-email', () => {
  test('rejeita token ausente', async () => {
    const res = await request(app).post('/auth/verificar-email').send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Token é obrigatório/);
    expect(prismaFoiChamado()).toBe(false);
  });
});

// ============================================================
// USUARIO
// ============================================================
describe('PUT /usuarios/me', () => {
  test('rejeita nome vazio', async () => {
    const res = await request(app)
      .put('/usuarios/me')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ primeiroNome: '' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Nome não pode ser vazio/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita nome acima de 100 caracteres', async () => {
    const res = await request(app)
      .put('/usuarios/me')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ primeiroNome: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/100 caracteres/);
  });

  test('rejeita telefone inválido', async () => {
    const res = await request(app)
      .put('/usuarios/me')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ telefone: '11999' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Telefone inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita gênero fora da lista permitida', async () => {
    const res = await request(app)
      .put('/usuarios/me')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ genero: 'nao-binario' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Gênero inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('aceita atualizar só o gênero, sem mexer nos outros campos', async () => {
    prisma.usuario.update.mockResolvedValue({ id: 'u1', primeiroNome: 'A', genero: 'outro' });

    const res = await request(app)
      .put('/usuarios/me')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ genero: 'outro' });

    expect(res.status).toBe(200);
    expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({
      data: { genero: 'outro' },
    }));
  });

  test('ignora campos não declarados no schema (email/cpf não podem ser trocados por aqui)', async () => {
    prisma.usuario.update.mockResolvedValue({ id: 'usuario-1', primeiroNome: 'Novo' });

    await request(app)
      .put('/usuarios/me')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ primeiroNome: 'Novo', email: 'hackeado@example.com', cpf: '00000000000' });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'usuario-1' },
      data: { primeiroNome: 'Novo' },
    });
  });
});

describe('PATCH /usuarios/me/senha', () => {
  test('rejeita senhaAtual e novaSenha ausentes', async () => {
    const res = await request(app)
      .patch('/usuarios/me/senha')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Senha atual e nova senha são obrigatórias/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita nova senha fraca', async () => {
    const res = await request(app)
      .patch('/usuarios/me/senha')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ senhaAtual: 'QualquerSenha@1', novaSenha: '123' });
    expect(res.status).toBe(400);
  });
});

describe('POST /usuarios/me/enderecos', () => {
  test('rejeita campos obrigatórios ausentes', async () => {
    const res = await request(app)
      .post('/usuarios/me/enderecos')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CEP, logradouro, cidade e estado são obrigatórios/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita CEP inválido', async () => {
    const res = await request(app)
      .post('/usuarios/me/enderecos')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ cep: '123', logradouro: 'Rua A', cidade: 'Curitiba', estado: 'PR' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CEP inválido/);
  });

  test('rejeita UF inválida', async () => {
    const res = await request(app)
      .post('/usuarios/me/enderecos')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ cep: '86300000', logradouro: 'Rua A', cidade: 'Curitiba', estado: 'XX' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Estado inválido/);
  });
});

describe('PUT /usuarios/me/enderecos/:id', () => {
  test('rejeita UF inválida na atualização parcial', async () => {
    const res = await request(app)
      .put(`/usuarios/me/enderecos/${UUID_VALIDO}`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ estado: 'XX' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Estado inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });
});

describe('GET /usuarios (admin) — filtro ?tipo', () => {
  test('rejeita valor de "tipo" fora de usuario/admin', async () => {
    const res = await request(app)
      .get('/usuarios?tipo=superadmin')
      .set('Authorization', `Bearer ${gerarToken({ tipo: 'admin' })}`);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Tipo inválido/);
  });
});

// ============================================================
// ITEM
// ============================================================
describe('POST /itens', () => {
  const base = { descricao: 'd', categoriaId: UUID_VALIDO, cidade: 'Curitiba', estado: 'PR' };

  test('rejeita título ausente', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send(base);
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/título é obrigatório/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita título acima de 150 caracteres', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ ...base, titulo: 'a'.repeat(151) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/150 caracteres/);
  });

  test('rejeita descrição ausente', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'Sofá', categoriaId: UUID_VALIDO, cidade: 'Curitiba', estado: 'PR' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/descrição é obrigatória/);
  });

  test('rejeita categoria ausente', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'Sofá', descricao: 'd', cidade: 'Curitiba', estado: 'PR' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/categoria é obrigatória/);
  });

  test('rejeita UF inválida', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'Sofá', ...base, estado: 'XX' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Estado inválido/);
  });

  test('rejeita condição inválida', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'Sofá', ...base, condicao: 'quebrado' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Condição inválida/);
  });

  test('rejeita mais de 10 imagens', async () => {
    const imagens = Array.from({ length: 11 }, (_, i) => `https://example.com/img${i}.jpg`);
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'Sofá', ...base, imagens });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/No máximo 10 imagens/);
  });

  test('rejeita URL de imagem inválida', async () => {
    const res = await request(app)
      .post('/itens')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'Sofá', ...base, imagens: ['nao-e-uma-url'] });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/URLs de imagem são inválidas/);
  });
});

describe('GET /itens — filtros de query', () => {
  test('rejeita categoriaId com formato inválido', async () => {
    const res = await request(app).get('/itens?categoriaId=nao-e-uuid');
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita UF inválida no filtro', async () => {
    const res = await request(app).get('/itens?estado=XX');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Estado inválido no filtro/);
  });

  test('busca por raio: rejeita quando só lat é informado (precisa dos 3 juntos)', async () => {
    const res = await request(app).get('/itens?lat=-23.5');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/lat, lng e raioKm juntos/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('busca por raio: rejeita lat fora do intervalo -90 a 90', async () => {
    const res = await request(app).get('/itens?lat=200&lng=-46.6&raioKm=10');
    expect(res.status).toBe(400);
  });

  test('busca por raio: rejeita raioKm acima de 500km', async () => {
    const res = await request(app).get('/itens?lat=-23.5&lng=-46.6&raioKm=501');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/500km/);
  });

  test('busca por raio: payload válido chega até a query geográfica (prova que o controller não descarta lat/lng/raioKm)', async () => {
    prisma.$queryRawUnsafe.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0 }]);

    const res = await request(app).get('/itens?lat=-23.5&lng=-46.6&raioKm=10');

    expect(res.status).toBe(200);
    expect(prisma.$queryRawUnsafe).toHaveBeenCalled();
  });
});

describe('PUT /itens/:id — atualização parcial', () => {
  test('rejeita título acima de 150 caracteres', async () => {
    const res = await request(app)
      .put(`/itens/${UUID_VALIDO}`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ titulo: 'a'.repeat(151) });
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita UF inválida', async () => {
    const res = await request(app)
      .put(`/itens/${UUID_VALIDO}`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ estado: 'XX' });
    expect(res.status).toBe(400);
  });
});

describe('POST /itens/:id/imagens', () => {
  test('rejeita ausência de urls', async () => {
    const res = await request(app)
      .post(`/itens/${UUID_VALIDO}/imagens`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Nenhuma URL de imagem fornecida/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita URLs inválidas', async () => {
    const res = await request(app)
      .post(`/itens/${UUID_VALIDO}/imagens`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ urls: ['nope'] });
    expect(res.status).toBe(400);
  });
});

// ============================================================
// CATEGORIA
// ============================================================
describe('POST /categorias (admin)', () => {
  test('rejeita nome ausente', async () => {
    const res = await request(app)
      .post('/categorias')
      .set('Authorization', `Bearer ${gerarToken({ tipo: 'admin' })}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/nome da categoria é obrigatório/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita nome acima de 100 caracteres', async () => {
    const res = await request(app)
      .post('/categorias')
      .set('Authorization', `Bearer ${gerarToken({ tipo: 'admin' })}`)
      .send({ nome: 'a'.repeat(101) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/100 caracteres/);
  });
});

describe('PUT /categorias/:id (admin)', () => {
  test('rejeita nome vazio', async () => {
    const res = await request(app)
      .put(`/categorias/${UUID_VALIDO}`)
      .set('Authorization', `Bearer ${gerarToken({ tipo: 'admin' })}`)
      .send({ nome: '   ' });
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });
});

// ============================================================
// SOLICITACAO
// ============================================================
describe('POST /solicitacoes', () => {
  test('rejeita itemId ausente', async () => {
    const res = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/itemId é obrigatório/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita itemId com formato inválido', async () => {
    const res = await request(app)
      .post('/solicitacoes')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ itemId: 'nao-e-uuid' });
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });
});

// ============================================================
// MENSAGEM (chat)
// ============================================================
describe('POST /solicitacoes/:id/mensagens', () => {
  test('rejeita mensagem sem conteúdo e sem anexoUrl', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/texto ou um anexo/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita anexoUrl externo (fora do prefixo /uploads/mensagens/)', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ anexoUrl: 'https://exemplo-externo.com/arquivo.jpg', anexoTipo: 'imagem' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/anexoUrl inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita anexoUrl sem anexoTipo (um não vem sem o outro)', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ anexoUrl: '/uploads/mensagens/arquivo.jpg' });
    expect(res.status).toBe(400);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('aceita anexoUrl interno válido junto com anexoTipo, sem conteúdo', async () => {
    prisma.solicitacaoItem.findUnique.mockResolvedValue({
      id: UUID_VALIDO,
      status: 'aceita',
      solicitanteId: 'usuario-1',
      item: { id: 'item-1', doadorId: 'usuario-1', titulo: 'Sofá 3 lugares' },
    });
    prisma.mensagem.create.mockResolvedValue({
      id: 'msg-1', solicitacaoId: UUID_VALIDO, remetenteId: 'usuario-1', conteudo: null,
      anexoUrl: '/uploads/mensagens/arquivo.jpg', anexoTipo: 'imagem', deletadoEm: null,
      remetente: { id: 'usuario-1', primeiroNome: 'A', ultimoNome: 'B' },
    });
    prisma.notificacao.create.mockResolvedValue({});

    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/mensagens`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ anexoUrl: '/uploads/mensagens/arquivo.jpg', anexoTipo: 'imagem' });

    expect(res.status).toBe(201);
  });
});

// ============================================================
// FAVORITO
// ============================================================
describe('POST /favoritos', () => {
  test('rejeita itemId ausente', async () => {
    const res = await request(app)
      .post('/favoritos')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/itemId é obrigatório/);
    expect(prismaFoiChamado()).toBe(false);
  });
});

// ============================================================
// DENUNCIA
// ============================================================
describe('POST /denuncias', () => {
  test('rejeita tipo inválido', async () => {
    const res = await request(app)
      .post('/denuncias')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ tipo: 'outra-coisa', motivo: 'spam', itemId: UUID_VALIDO });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Tipo de denúncia inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita motivo inválido', async () => {
    const res = await request(app)
      .post('/denuncias')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ tipo: 'item', motivo: 'motivo-inventado', itemId: UUID_VALIDO });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/Motivo inválido/);
  });

  test('denúncia de item: rejeita se usuarioDenunciadoId também for informado (regra XOR)', async () => {
    const res = await request(app)
      .post('/denuncias')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ tipo: 'item', motivo: 'spam', itemId: UUID_VALIDO, usuarioDenunciadoId: UUID_VALIDO });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/usuarioDenunciadoId não deve ser informado/);
  });

  test('denúncia de item: rejeita se itemId estiver ausente', async () => {
    const res = await request(app)
      .post('/denuncias')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ tipo: 'item', motivo: 'spam' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/itemId é obrigatório/);
  });

  test('denúncia de usuário: rejeita se itemId também for informado (regra XOR)', async () => {
    const res = await request(app)
      .post('/denuncias')
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ tipo: 'usuario', motivo: 'spam', usuarioDenunciadoId: UUID_VALIDO, itemId: UUID_VALIDO });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/itemId não deve ser informado/);
  });
});

describe('PATCH /denuncias/:id/analisar (admin)', () => {
  test('rejeita status final diferente de procedente/improcedente', async () => {
    const res = await request(app)
      .patch(`/denuncias/${UUID_VALIDO}/analisar`)
      .set('Authorization', `Bearer ${gerarToken({ tipo: 'admin' })}`)
      .send({ status: 'pendente' });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/procedente.*improcedente/);
    expect(prismaFoiChamado()).toBe(false);
  });
});

// ============================================================
// CEP
// ============================================================
describe('GET /cep/:cep', () => {
  test('rejeita CEP com formato inválido', async () => {
    const res = await request(app).get('/cep/123');
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/CEP inválido/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita CEP com letras', async () => {
    const res = await request(app).get('/cep/abcde-123');
    expect(res.status).toBe(400);
  });
});

// ============================================================
// AVALIACAO
// ============================================================
describe('POST /solicitacoes/:id/avaliacoes', () => {
  test('rejeita nota ausente', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/avaliacoes`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({});
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/nota é obrigatória/);
    expect(prismaFoiChamado()).toBe(false);
  });

  test('rejeita nota fora do intervalo 1-5', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/avaliacoes`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ nota: 6 });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/nota deve ser de 1 a 5/);
  });

  test('rejeita nota não inteira', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/avaliacoes`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ nota: 4.5 });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/inteiro de 1 a 5/);
  });

  test('rejeita comentário acima de 1000 caracteres', async () => {
    const res = await request(app)
      .post(`/solicitacoes/${UUID_VALIDO}/avaliacoes`)
      .set('Authorization', `Bearer ${gerarToken()}`)
      .send({ nota: 5, comentario: 'a'.repeat(1001) });
    expect(res.status).toBe(400);
    expect(res.body.erro).toMatch(/1000 caracteres/);
  });
});

// NOTA: validação de formato (campos obrigatórios, email/CPF/CEP/UF inválidos,
// força de senha, limites de tamanho) foi movida para o middleware Joi nas
// rotas — esses casos agora são cobertos em tests/integration/validacao.test.js,
// batendo na rota de verdade. Aqui só sobram as regras de negócio que dependem
// do banco (duplicidade, posse, transições de estado).
const bcrypt = require('bcrypt');
const prisma = require('../../src/lib/prisma');
const usuarioService = require('../../src/services/usuario.service');

const CPF_VALIDO = '11144477735';

describe('registrar', () => {
  test('rejeita email/cpf já cadastrado', async () => {
    prisma.usuario.findFirst.mockResolvedValue({ id: 'existente' });

    await expect(usuarioService.registrar({
      email: 'joana@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'Joana', ultimoNome: 'Silva',
    })).rejects.toMatchObject({ status: 409 });
  });

  test('cria o usuário com sucesso e devolve dados sanitizados (sem senhaHash)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({
      id: 'novo-usuario', email: 'joana@example.com', cpf: CPF_VALIDO,
      senhaHash: 'hash-interno', primeiroNome: 'Joana', ultimoNome: 'Silva',
    });
    prisma.tokenUsuario.updateMany.mockResolvedValue({});
    prisma.tokenUsuario.create.mockResolvedValue({});

    const resultado = await usuarioService.registrar({
      email: 'joana@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'Joana', ultimoNome: 'Silva',
    });

    expect(resultado.senhaHash).toBeUndefined();
    expect(prisma.usuario.create).toHaveBeenCalled();
  });

  test('normaliza o email (minúsculo, sem espaço) antes de checar duplicidade e de salvar', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'x', primeiroNome: 'A', ultimoNome: 'B' });
    prisma.tokenUsuario.updateMany.mockResolvedValue({});
    prisma.tokenUsuario.create.mockResolvedValue({});

    await usuarioService.registrar({
      email: '  Joana@Example.COM  ', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    });

    expect(prisma.usuario.findFirst).toHaveBeenCalledWith({
      where: { OR: [{ email: 'joana@example.com' }, { cpf: CPF_VALIDO }] },
    });
    expect(prisma.usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ email: 'joana@example.com' }),
    });
  });

  test('CPF é limpo (só dígitos) antes de salvar no banco', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'x', primeiroNome: 'A', ultimoNome: 'B' });
    prisma.tokenUsuario.updateMany.mockResolvedValue({});
    prisma.tokenUsuario.create.mockResolvedValue({});

    await usuarioService.registrar({
      email: 'a@example.com', cpf: '111.444.777-35', senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    });

    expect(prisma.usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cpf: CPF_VALIDO }),
    });
  });

  test('registro não falha mesmo se o envio do email de verificação falhar (fila fora do ar)', async () => {
    prisma.usuario.findFirst.mockResolvedValue(null);
    prisma.usuario.create.mockResolvedValue({ id: 'x', primeiroNome: 'A', ultimoNome: 'B' });
    prisma.tokenUsuario.updateMany.mockRejectedValue(new Error('Redis fora do ar'));

    await expect(usuarioService.registrar({
      email: 'a@example.com', cpf: CPF_VALIDO, senha: 'SenhaForte@123',
      primeiroNome: 'A', ultimoNome: 'B',
    })).resolves.toBeDefined();
  });
});

describe('atualizarPerfil', () => {
  test('ignora campos não permitidos (email/cpf não podem ser trocados por aqui)', async () => {
    prisma.usuario.update.mockResolvedValue({ id: 'u1', primeiroNome: 'Novo' });

    await usuarioService.atualizarPerfil('u1', { primeiroNome: 'Novo', email: 'hackeado@example.com', cpf: '00000000000' });

    expect(prisma.usuario.update).toHaveBeenCalledWith({
      where: { id: 'u1' },
      data: { primeiroNome: 'Novo' },
    });
  });
});

describe('alterarSenha', () => {
  test('rejeita se a senha atual estiver incorreta', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', senhaHash: 'hash-antigo' });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(false);

    await expect(usuarioService.alterarSenha('u1', { senhaAtual: 'errada', novaSenha: 'SenhaForte@123' }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('troca a senha e revoga as demais sessões ativas', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', senhaHash: 'hash-antigo' });
    jest.spyOn(bcrypt, 'compare').mockResolvedValue(true);
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({});

    await usuarioService.alterarSenha('u1', { senhaAtual: 'certa', novaSenha: 'SenhaForte@123' });

    expect(prisma.$transaction).toHaveBeenCalled();
  });
});

describe('criarEndereco', () => {
  const dadosBase = { cep: '12345678', logradouro: 'Rua A', cidade: 'Curitiba', estado: 'pr' };

  test('primeiro endereço do usuário vira principal automaticamente', async () => {
    prisma.endereco.count.mockResolvedValue(0);
    prisma.endereco.create.mockResolvedValue({ id: 'end-1', principal: true });

    await usuarioService.criarEndereco('u1', dadosBase);

    expect(prisma.endereco.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ principal: true, estado: 'PR' }),
    });
    // Não deve mexer em outros endereços — é o primeiro
    expect(prisma.endereco.updateMany).not.toHaveBeenCalled();
  });

  test('segundo endereço não vira principal por padrão, e não desmarca o existente', async () => {
    prisma.endereco.count.mockResolvedValue(1);
    prisma.endereco.create.mockResolvedValue({ id: 'end-2', principal: false });

    await usuarioService.criarEndereco('u1', dadosBase);

    expect(prisma.endereco.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ principal: false }),
    });
    expect(prisma.endereco.updateMany).not.toHaveBeenCalled();
  });

  test('marcar um novo endereço como principal desmarca o principal anterior', async () => {
    prisma.endereco.count.mockResolvedValue(1);
    prisma.endereco.updateMany.mockResolvedValue({});
    prisma.endereco.create.mockResolvedValue({ id: 'end-2', principal: true });

    await usuarioService.criarEndereco('u1', { ...dadosBase, principal: true });

    expect(prisma.endereco.updateMany).toHaveBeenCalledWith({
      where: { usuarioId: 'u1', principal: true },
      data: { principal: false },
    });
  });
});

describe('atualizarEndereco', () => {
  test('rejeita quando o endereço não pertence ao usuário (ou não existe)', async () => {
    prisma.endereco.findFirst.mockResolvedValue(null);

    await expect(usuarioService.atualizarEndereco('end-1', 'usuario-errado', { cidade: 'Nova' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('atualização válida passa pelos campos permitidos', async () => {
    prisma.endereco.findFirst.mockResolvedValue({ id: 'end-1', usuarioId: 'u1' });
    prisma.endereco.update.mockResolvedValue({ id: 'end-1', cidade: 'Nova Cidade' });

    const resultado = await usuarioService.atualizarEndereco('end-1', 'u1', { cidade: 'Nova Cidade' });
    expect(resultado.cidade).toBe('Nova Cidade');
  });
});

describe('removerEndereco', () => {
  test('rejeita quando o endereço não pertence ao usuário', async () => {
    prisma.endereco.findFirst.mockResolvedValue(null);
    await expect(usuarioService.removerEndereco('end-1', 'usuario-errado')).rejects.toMatchObject({ status: 404 });
  });

  test('impede remoção de endereço em uso por um item de doação ativo', async () => {
    prisma.endereco.findFirst.mockResolvedValue({ id: 'end-1', usuarioId: 'u1' });
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1' });

    await expect(usuarioService.removerEndereco('end-1', 'u1')).rejects.toMatchObject({ status: 409 });
    expect(prisma.endereco.delete).not.toHaveBeenCalled();
  });

  test('remove normalmente quando não está em uso', async () => {
    prisma.endereco.findFirst.mockResolvedValue({ id: 'end-1', usuarioId: 'u1' });
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    prisma.endereco.delete.mockResolvedValue({});

    await usuarioService.removerEndereco('end-1', 'u1');
    expect(prisma.endereco.delete).toHaveBeenCalledWith({ where: { id: 'end-1' } });
  });
});

describe('administração de usuários', () => {
  test('desativarConta impede admin de desativar a própria conta por essa rota', async () => {
    await expect(usuarioService.desativarConta('admin-1', 'admin-1')).rejects.toMatchObject({ status: 400 });
  });

  test('desativarConta rejeita usuário inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(usuarioService.desativarConta('u1', 'admin-1')).rejects.toMatchObject({ status: 404 });
  });

  test('desativarConta desativa e revoga sessões numa transação, e registra auditoria', async () => {
    prisma.usuario.findUnique.mockResolvedValue({ id: 'u1', email: 'joana@example.com' });
    prisma.$transaction.mockImplementation(async (ops) => Promise.all(ops));
    prisma.usuario.update.mockResolvedValue({});
    prisma.refreshToken.updateMany.mockResolvedValue({});
    prisma.logAuditoria.create.mockResolvedValue({});

    await usuarioService.desativarConta('u1', 'admin-1');

    expect(prisma.$transaction).toHaveBeenCalled();
    expect(prisma.logAuditoria.create).toHaveBeenCalled();
  });

  test('reativarConta rejeita usuário inexistente', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(usuarioService.reativarConta('u1', 'admin-1')).rejects.toMatchObject({ status: 404 });
  });
});
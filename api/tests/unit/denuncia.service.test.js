// NOTA: validação de formato (tipo/motivo inválidos, regra XOR item/usuário,
// status inválido) foi movida para o middleware Joi nas rotas — coberta em
// tests/integration/validacao.test.js. Aqui só sobram as regras de negócio
// que dependem do banco/contexto autenticado (alvo existe, autodenúncia,
// denúncia pendente duplicada, status já analisado).
const prisma = require('../../src/lib/prisma');
const denunciaService = require('../../src/services/denuncia.service');
const itemService = require('../../src/services/item.service');
const usuarioService = require('../../src/services/usuario.service');

describe('criar', () => {
  test('denúncia de item: lança 404 quando o item não existe', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue(null);
    await expect(denunciaService.criar('u1', { tipo: 'item', itemId: 'item-inexistente', motivo: 'spam' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('denúncia de usuário: impede autodenúncia', async () => {
    await expect(denunciaService.criar('u1', { tipo: 'usuario', usuarioDenunciadoId: 'u1', motivo: 'spam' }))
      .rejects.toMatchObject({ status: 403 });
  });

  test('denúncia de usuário: lança 404 quando o usuário denunciado não existe', async () => {
    prisma.usuario.findUnique.mockResolvedValue(null);
    await expect(denunciaService.criar('u1', { tipo: 'usuario', usuarioDenunciadoId: 'u2', motivo: 'spam' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejeita nova denúncia enquanto já existir uma pendente do mesmo denunciante para o mesmo alvo', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.denuncia.findFirst.mockResolvedValue({ id: 'denuncia-existente' });

    await expect(denunciaService.criar('u1', { tipo: 'item', itemId: 'item-1', motivo: 'spam' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('cria denúncia de item com sucesso', async () => {
    prisma.itemDoacao.findFirst.mockResolvedValue({ id: 'item-1' });
    prisma.denuncia.findFirst.mockResolvedValue(null);
    prisma.denuncia.create.mockResolvedValue({ id: 'denuncia-1' });

    const resultado = await denunciaService.criar('u1', { tipo: 'item', itemId: 'item-1', motivo: 'spam' });
    expect(resultado.id).toBe('denuncia-1');
  });
});

describe('analisar', () => {
  test('lança 404 quando a denúncia não existe', async () => {
    prisma.denuncia.findUnique.mockResolvedValue(null);
    await expect(denunciaService.analisar('d1', 'admin-1', { status: 'procedente' }))
      .rejects.toMatchObject({ status: 404 });
  });

  test('rejeita denúncia que já foi analisada', async () => {
    prisma.denuncia.findUnique.mockResolvedValue({ id: 'd1', status: 'procedente' });
    await expect(denunciaService.analisar('d1', 'admin-1', { status: 'improcedente' }))
      .rejects.toMatchObject({ status: 409 });
  });

  test('marca como improcedente sem desativar nada, e registra auditoria', async () => {
    prisma.denuncia.findUnique
      .mockResolvedValueOnce({ id: 'd1', status: 'pendente', tipo: 'item', itemId: 'item-1' }) // checagem de status
      .mockResolvedValueOnce({ id: 'd1', status: 'improcedente', tipo: 'item', itemId: 'item-1' }); // dentro de buscarPorId
    prisma.denuncia.update.mockResolvedValue({});
    prisma.logAuditoria.create.mockResolvedValue({});

    const cancelarSpy = jest.spyOn(itemService, 'cancelar').mockResolvedValue();

    await denunciaService.analisar('d1', 'admin-1', { status: 'improcedente' });

    expect(cancelarSpy).not.toHaveBeenCalled();
    expect(prisma.logAuditoria.create).toHaveBeenCalled();
    cancelarSpy.mockRestore();
  });

  test('procedente + desativarItem=true cancela o item denunciado', async () => {
    prisma.denuncia.findUnique
      .mockResolvedValueOnce({ id: 'd1', status: 'pendente', tipo: 'item', itemId: 'item-1' }) // 1ª chamada: checagem de status
      .mockResolvedValueOnce({ id: 'd1', status: 'procedente', tipo: 'item', itemId: 'item-1' }); // 2ª chamada: dentro de buscarPorId
    prisma.denuncia.update.mockResolvedValue({});
    prisma.logAuditoria.create.mockResolvedValue({});
    const cancelarSpy = jest.spyOn(itemService, 'cancelar').mockResolvedValue();

    await denunciaService.analisar('d1', 'admin-1', { status: 'procedente', desativarItem: true });

    expect(cancelarSpy).toHaveBeenCalledWith('item-1', 'admin-1', true);
    cancelarSpy.mockRestore();
  });

  test('procedente + desativarUsuario=true desativa a conta denunciada', async () => {
    prisma.denuncia.findUnique
      .mockResolvedValueOnce({ id: 'd1', status: 'pendente', tipo: 'usuario', usuarioDenunciadoId: 'u2' })
      .mockResolvedValueOnce({ id: 'd1', status: 'procedente', tipo: 'usuario', usuarioDenunciadoId: 'u2' });
    prisma.denuncia.update.mockResolvedValue({});
    prisma.logAuditoria.create.mockResolvedValue({});
    const desativarSpy = jest.spyOn(usuarioService, 'desativarConta').mockResolvedValue();

    await denunciaService.analisar('d1', 'admin-1', { status: 'procedente', desativarUsuario: true });

    expect(desativarSpy).toHaveBeenCalledWith('u2', 'admin-1');
    desativarSpy.mockRestore();
  });

  test('procedente sem a flag explícita NÃO desativa nada automaticamente', async () => {
    prisma.denuncia.findUnique
      .mockResolvedValueOnce({ id: 'd1', status: 'pendente', tipo: 'item', itemId: 'item-1' })
      .mockResolvedValueOnce({ id: 'd1', status: 'procedente', tipo: 'item', itemId: 'item-1' });
    prisma.denuncia.update.mockResolvedValue({});
    prisma.logAuditoria.create.mockResolvedValue({});
    const cancelarSpy = jest.spyOn(itemService, 'cancelar').mockResolvedValue();

    await denunciaService.analisar('d1', 'admin-1', { status: 'procedente' });

    expect(cancelarSpy).not.toHaveBeenCalled();
    cancelarSpy.mockRestore();
  });
});

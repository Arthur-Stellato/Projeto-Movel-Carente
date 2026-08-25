const { validarForcaSenha } = require('../../src/lib/validadores');

describe('validarForcaSenha', () => {
  test('senha vazia/indefinida: mensagem específica', () => {
    expect(validarForcaSenha('')).toBe('A senha é obrigatória');
    expect(validarForcaSenha(undefined)).toBe('A senha é obrigatória');
  });

  test('senha que atende todas as regras: null (válida)', () => {
    expect(validarForcaSenha('SenhaForte@123')).toBeNull();
  });

  test('menor que 8 caracteres: aponta o requisito de tamanho', () => {
    expect(validarForcaSenha('Ab1@')).toMatch(/no mínimo 8 caracteres/);
  });

  test('sem letra maiúscula: aponta o requisito específico', () => {
    expect(validarForcaSenha('senha@123')).toMatch(/letra maiúscula/);
  });

  test('sem letra minúscula: aponta o requisito específico', () => {
    expect(validarForcaSenha('SENHA@123')).toMatch(/letra minúscula/);
  });

  test('sem número: aponta o requisito específico', () => {
    expect(validarForcaSenha('SenhaForte@')).toMatch(/um número/);
  });

  test('sem caractere especial: aponta o requisito específico', () => {
    expect(validarForcaSenha('SenhaForte123')).toMatch(/um caractere especial/);
  });

  test('falha em múltiplos requisitos ao mesmo tempo: combina todos numa mensagem só', () => {
    const mensagem = validarForcaSenha('abc');
    expect(mensagem).toMatch(/no mínimo 8 caracteres/);
    expect(mensagem).toMatch(/letra maiúscula/);
    expect(mensagem).toMatch(/um número/);
    expect(mensagem).toMatch(/um caractere especial/);
  });

  test('aceita diferentes tipos de caractere especial (não exige um conjunto fixo)', () => {
    expect(validarForcaSenha('SenhaForte123!')).toBeNull();
    expect(validarForcaSenha('SenhaForte123#')).toBeNull();
    expect(validarForcaSenha('SenhaForte123 ')).toBeNull(); // espaço também conta
  });
});
const { gerarSlug } = require('../../src/lib/slugify');

describe('gerarSlug', () => {
  test('converte para minúsculas', () => {
    expect(gerarSlug('MÓVEIS')).toBe('moveis');
  });

  test('remove acentos', () => {
    expect(gerarSlug('Eletrodomésticos')).toBe('eletrodomesticos');
    expect(gerarSlug('Roupas & Calçados')).toBe('roupas-calcados');
  });

  test('troca espaços por hífen', () => {
    expect(gerarSlug('Móveis de Sala')).toBe('moveis-de-sala');
  });

  test('remove caracteres especiais que não sejam letras, números, espaço ou hífen', () => {
    expect(gerarSlug('Eletrônicos!!! (usados)')).toBe('eletronicos-usados');
  });

  test('colapsa hífens duplicados em um só', () => {
    expect(gerarSlug('Móveis   &   Decoração')).toBe('moveis-decoracao');
  });

  test('remove espaços nas extremidades antes de gerar o slug', () => {
    expect(gerarSlug('  Roupas  ')).toBe('roupas');
  });

  test('preserva números', () => {
    expect(gerarSlug('Categoria 2024')).toBe('categoria-2024');
  });
});
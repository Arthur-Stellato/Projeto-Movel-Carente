const { normalizarPaginacao, normalizarLimite, TAMANHO_MAXIMO } = require('../../src/lib/paginacao');

describe('normalizarPaginacao', () => {
  test('usa os valores informados quando são números válidos', () => {
    const resultado = normalizarPaginacao(2, 10, 20);
    expect(resultado).toEqual({ pagina: 2, tamanho: 10, skip: 10 });
  });

  test('calcula skip corretamente para páginas além da primeira', () => {
    const resultado = normalizarPaginacao(3, 15, 20);
    expect(resultado.skip).toBe(30); // (3-1) * 15
  });

  test('cai no padrão quando pagina/tamanho não são informados', () => {
    const resultado = normalizarPaginacao(undefined, undefined, 20);
    expect(resultado).toEqual({ pagina: 1, tamanho: 20, skip: 0 });
  });

  test('protege contra página zero ou negativa, forçando página 1', () => {
    expect(normalizarPaginacao(0, 10, 20).pagina).toBe(1);
    expect(normalizarPaginacao(-5, 10, 20).pagina).toBe(1);
  });

  test('protege contra valores não numéricos, evitando NaN no skip', () => {
    const resultado = normalizarPaginacao('abc', 'xyz', 20);
    expect(resultado.pagina).toBe(1);
    expect(resultado.tamanho).toBe(20);
    expect(Number.isNaN(resultado.skip)).toBe(false);
    expect(resultado.skip).toBe(0);
  });

  test('limita o tamanho máximo de página, mesmo se um valor absurdo for pedido', () => {
    const resultado = normalizarPaginacao(1, 999999, 20);
    expect(resultado.tamanho).toBe(TAMANHO_MAXIMO);
  });

  test('tamanho zero cai no padrão (0 é falsy em JS, então o fallback "|| tamanhoPadrao" entra em ação)', () => {
    expect(normalizarPaginacao(1, 0, 20).tamanho).toBe(20);
  });

  test('tamanho negativo é clampado para o mínimo de 1', () => {
    expect(normalizarPaginacao(1, -10, 20).tamanho).toBe(1);
  });

  test('aceita strings numéricas vindas da query string', () => {
    const resultado = normalizarPaginacao('2', '5', 20);
    expect(resultado).toEqual({ pagina: 2, tamanho: 5, skip: 5 });
  });
});

// Fase 9: extraído de normalizarPaginacao pra ser reaproveitado também pela
// paginação por cursor do chat (que não tem conceito de "página").
describe('normalizarLimite', () => {
  test('usa o valor informado quando é um número válido', () => {
    expect(normalizarLimite(10, 30)).toBe(10);
  });

  test('cai no padrão quando não informado', () => {
    expect(normalizarLimite(undefined, 30)).toBe(30);
  });

  test('aplica o teto máximo, mesmo com um valor absurdo', () => {
    expect(normalizarLimite(999999, 30)).toBe(TAMANHO_MAXIMO);
  });

  test('protege contra zero, negativo e valores não numéricos', () => {
    expect(normalizarLimite(0, 30)).toBe(30); // 0 é falsy, cai no padrão
    expect(normalizarLimite(-5, 30)).toBe(1);
    expect(normalizarLimite('abc', 30)).toBe(30);
  });

  test('aceita string numérica vinda da query string', () => {
    expect(normalizarLimite('15', 30)).toBe(15);
  });
});
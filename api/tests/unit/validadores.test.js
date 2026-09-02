const { validarCpf, validarCnpj, validarCep, validarUuid, validarEmail, normalizarEmail, ehEmailDescartavel, validarTelefone, UFS_VALIDAS } = require('../../src/lib/validadores');

describe('validarCpf', () => {
  test('aceita um CPF real com dígitos verificadores corretos', () => {
    // CPF de teste amplamente usado em documentação/exemplos, matematicamente válido
    expect(validarCpf('11144477735')).toBe(true);
  });

  test('aceita CPF formatado com pontuação (extrai só os dígitos)', () => {
    expect(validarCpf('111.444.777-35')).toBe(true);
  });

  test('rejeita CPF com tamanho diferente de 11 dígitos', () => {
    expect(validarCpf('123456789')).toBe(false);
    expect(validarCpf('123456789012')).toBe(false);
  });

  test('rejeita sequências repetidas mesmo quando passam no cálculo do dígito', () => {
    expect(validarCpf('00000000000')).toBe(false);
    expect(validarCpf('11111111111')).toBe(false);
    expect(validarCpf('99999999999')).toBe(false);
  });

  test('rejeita CPF com dígito verificador incorreto', () => {
    // Mesmos 9 primeiros dígitos do CPF válido acima, mas com o último dígito trocado
    expect(validarCpf('11144477736')).toBe(false);
  });

  test('rejeita valores vazios, nulos ou não numéricos', () => {
    expect(validarCpf('')).toBe(false);
    expect(validarCpf(null)).toBe(false);
    expect(validarCpf(undefined)).toBe(false);
    expect(validarCpf('abc.def.ghi-jk')).toBe(false);
  });
});

describe('validarUuid', () => {
  test('aceita um UUID v4 válido', () => {
    expect(validarUuid('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
  });

  test('rejeita string que não é UUID', () => {
    expect(validarUuid('nao-e-um-uuid')).toBe(false);
    expect(validarUuid('12345')).toBe(false);
  });

  test('rejeita UUID com versão fora do intervalo aceito (regex exige 1-5 no grupo de versão)', () => {
    expect(validarUuid('550e8400-e29b-91d4-a716-446655440000')).toBe(false);
  });

  test('rejeita vazio/undefined sem lançar exceção', () => {
    expect(validarUuid('')).toBe(false);
    expect(validarUuid(undefined)).toBe(false);
  });
});

describe('validarCep', () => {
  test('aceita CEP com exatamente 8 dígitos', () => {
    expect(validarCep('12345678')).toBe(true);
  });

  test('aceita CEP formatado com hífen (extrai só os dígitos)', () => {
    expect(validarCep('12345-678')).toBe(true);
  });

  test('rejeita CEP com menos ou mais de 8 dígitos', () => {
    expect(validarCep('1234567')).toBe(false);
    expect(validarCep('123456789')).toBe(false);
  });

  test('rejeita vazio/undefined sem lançar exceção', () => {
    expect(validarCep('')).toBe(false);
    expect(validarCep(undefined)).toBe(false);
  });
});

describe('UFS_VALIDAS', () => {
  test('contém exatamente as 27 UFs (26 estados + DF)', () => {
    expect(UFS_VALIDAS).toHaveLength(27);
  });

  test('inclui UFs conhecidas e não tem duplicatas', () => {
    expect(UFS_VALIDAS).toEqual(expect.arrayContaining(['SP', 'RJ', 'PR', 'DF', 'AM']));
    expect(new Set(UFS_VALIDAS).size).toBe(UFS_VALIDAS.length);
  });

  test('não inclui UF inexistente', () => {
    expect(UFS_VALIDAS).not.toContain('XX');
  });
});

describe('validarEmail', () => {
  test('aceita formatos comuns e válidos', () => {
    expect(validarEmail('joana@example.com')).toBe(true);
    expect(validarEmail('joana.silva+doacao@sub.example.com.br')).toBe(true);
  });

  test('rejeita sem @', () => {
    expect(validarEmail('joana-example.com')).toBe(false);
  });

  test('rejeita sem domínio com ponto (ex: sem .com/.br/etc)', () => {
    expect(validarEmail('joana@example')).toBe(false);
  });

  test('rejeita com espaço', () => {
    expect(validarEmail('joana silva@example.com')).toBe(false);
  });

  test('rejeita vazio/undefined sem lançar exceção', () => {
    expect(validarEmail('')).toBe(false);
    expect(validarEmail(undefined)).toBe(false);
  });

  test('tolera espaço nas extremidades (o próprio validador dá trim antes de checar)', () => {
    expect(validarEmail('  joana@example.com  ')).toBe(true);
  });
});

describe('normalizarEmail', () => {
  test('converte para minúsculas', () => {
    expect(normalizarEmail('Joana@Example.COM')).toBe('joana@example.com');
  });

  test('remove espaços nas extremidades', () => {
    expect(normalizarEmail('  joana@example.com  ')).toBe('joana@example.com');
  });

  test('undefined/null vira string vazia, sem lançar exceção', () => {
    expect(normalizarEmail(undefined)).toBe('');
    expect(normalizarEmail(null)).toBe('');
  });
});

describe('ehEmailDescartavel', () => {
  test('identifica domínios conhecidos de email temporário/descartável', () => {
    expect(ehEmailDescartavel('teste@mailinator.com')).toBe(true);
    expect(ehEmailDescartavel('teste@guerrillamail.com')).toBe(true);
    expect(ehEmailDescartavel('teste@10minutemail.com')).toBe(true);
    expect(ehEmailDescartavel('teste@yopmail.com')).toBe(true);
  });

  test('não bloqueia provedores comuns', () => {
    expect(ehEmailDescartavel('joana@gmail.com')).toBe(false);
    expect(ehEmailDescartavel('joana@hotmail.com')).toBe(false);
    expect(ehEmailDescartavel('joana@outlook.com')).toBe(false);
  });

  test('não bloqueia domínio próprio/corporativo/institucional (não está numa lista fechada de permitidos)', () => {
    expect(ehEmailDescartavel('contato@ongqualquer.org.br')).toBe(false);
    expect(ehEmailDescartavel('joao@empresaqualquer.com.br')).toBe(false);
    expect(ehEmailDescartavel('aluno@usp.br')).toBe(false);
  });

  test('checagem é case-insensitive no domínio', () => {
    expect(ehEmailDescartavel('teste@Mailinator.COM')).toBe(true);
  });

  test('email vazio/malformado não lança exceção', () => {
    expect(ehEmailDescartavel('')).toBe(false);
    expect(ehEmailDescartavel(undefined)).toBe(false);
    expect(ehEmailDescartavel('sem-arroba')).toBe(false);
  });
});

describe('validarTelefone', () => {
  test('celular formatado: aceita e normaliza pra E.164', () => {
    expect(validarTelefone('(11) 99999-8888')).toBe('+5511999998888');
  });

  test('celular sem formatação: aceita e normaliza igual', () => {
    expect(validarTelefone('11999998888')).toBe('+5511999998888');
  });

  test('já em E.164 com +55: aceita (idempotente)', () => {
    expect(validarTelefone('+5511999998888')).toBe('+5511999998888');
  });

  test('fixo (8 dígitos) com DDD: aceita', () => {
    expect(validarTelefone('1133334444')).toBe('+551133334444');
  });

  test('rejeita DDD inexistente', () => {
    expect(validarTelefone('0099998888')).toBeNull();
  });

  test('rejeita número curto demais', () => {
    expect(validarTelefone('11999')).toBeNull();
  });

  test('rejeita número válido de outro país (DDD é conceito só do Brasil)', () => {
    expect(validarTelefone('+14155552671')).toBeNull(); // número americano válido, mas não é BR
  });

  test('vazio/undefined não lança exceção', () => {
    expect(validarTelefone('')).toBeNull();
    expect(validarTelefone(undefined)).toBeNull();
  });

  test('letras/lixo não lançam exceção', () => {
    expect(validarTelefone('abc-def-ghij')).toBeNull();
  });
});

describe('validarCnpj', () => {
  test('aceita CNPJ com dígitos verificadores corretos, com ou sem formatação', () => {
    expect(validarCnpj('11222333000181')).toBe(true);
    expect(validarCnpj('11.222.333/0001-81')).toBe(true);
  });

  test('rejeita CNPJ com dígito verificador incorreto ou sequência repetida', () => {
    expect(validarCnpj('11222333000180')).toBe(false);
    expect(validarCnpj('00000000000000')).toBe(false);
  });
});

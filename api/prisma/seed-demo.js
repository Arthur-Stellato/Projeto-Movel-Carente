// Dados de demonstração para desenvolvimento: 1 admin, 2 usuários comuns e móveis cadastrados.
//
// Uso (de dentro de api/):
//   node prisma/seed-demo.js            -> cria os dados (pode rodar mais de uma vez: não duplica)
//   node prisma/seed-demo.js --forcar   -> permite rodar contra o Supabase (NÃO faça isso num banco público)
//
// Contas (senha de todas: Demo@12345, ou o valor de DEMO_SENHA):
//   admin@movelcarente.example.com   admin
//   maria@movelcarente.example.com   usuária, Cornélio Procópio-PR (8 móveis)
//   joao@movelcarente.example.com    usuário, Curitiba-PR (4 móveis)
//
// Todas já nascem com e-mail verificado e termos aceitos, então logam direto e não
// disparam e-mail nenhum. Para começar do zero, apague o banco local
// (docker compose --profile local-db down -v) e suba de novo.
require('dotenv').config();
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const DOMINIO = 'movelcarente.example.com';
const SENHA = process.env.DEMO_SENHA || 'Demo@12345';
const SALT_ROUNDS = 10; // mesmo custo de hash do auth.service.js: o login compara com bcrypt

// Mesmos nomes/slugs que o README sugere, mais "Estantes e racks".
const CATEGORIAS = [
  ['Sofás', 'sofas'],
  ['Camas e colchões', 'camas-e-colchoes'],
  ['Mesas', 'mesas'],
  ['Cadeiras', 'cadeiras'],
  ['Armários e guarda-roupas', 'armarios-e-guarda-roupas'],
  ['Estantes e racks', 'estantes-e-racks'],
  ['Eletrodomésticos', 'eletrodomesticos'],
  ['Outros', 'outros'],
];

// cpfBase: 9 dígitos; o seed calcula os 2 verificadores (a tabela exige CPF ou CNPJ).
const USUARIOS = [
  { chave: 'admin', email: `admin@${DOMINIO}`, primeiroNome: 'Admin', ultimoNome: 'MóvelCarente', tipo: 'admin', genero: 'prefiro_nao_dizer', cpfBase: '123456789' },
  {
    chave: 'maria', email: `maria@${DOMINIO}`, primeiroNome: 'Maria', ultimoNome: 'Doadora', tipo: 'usuario', genero: 'feminino', cpfBase: '987654321',
    endereco: { cep: '86300000', logradouro: 'Rua Minas Gerais', numero: '100', bairro: 'Centro', cidade: 'Cornélio Procópio', estado: 'PR', latitude: -23.1809, longitude: -50.6428 },
  },
  {
    chave: 'joao', email: `joao@${DOMINIO}`, primeiroNome: 'João', ultimoNome: 'Solicitante', tipo: 'usuario', genero: 'masculino', cpfBase: '111444777',
    endereco: { cep: '80010000', logradouro: 'Rua XV de Novembro', numero: '200', bairro: 'Centro', cidade: 'Curitiba', estado: 'PR', latitude: -25.4284, longitude: -49.2733 },
  },
];

// [doador, categoria (slug), título, descrição, condição, status, criado há N dias]
const ITENS = [
  ['maria', 'sofas', 'Sofá 3 lugares retrátil', 'Sofá cinza de 3 lugares, retrátil e reclinável. Tecido em bom estado, precisa só de uma limpeza. Retirada no centro.', 'usado', 'disponivel', 1],
  ['maria', 'mesas', 'Mesa de jantar com 6 cadeiras', 'Mesa de madeira maciça com 6 cadeiras estofadas. Alguns riscos no tampo, estrutura firme.', 'usado', 'disponivel', 2],
  ['maria', 'armarios-e-guarda-roupas', 'Guarda-roupa 6 portas', 'Guarda-roupa branco de 6 portas e 3 gavetas, desmontado para transporte. Acompanha parafusos.', 'seminovo', 'disponivel', 3],
  ['maria', 'camas-e-colchoes', 'Cama box solteiro com colchão', 'Cama box de solteiro com colchão de espuma D33. Usada por pouco tempo.', 'usado', 'disponivel', 4],
  ['maria', 'estantes-e-racks', 'Estante de livros 5 prateleiras', 'Estante de MDF com 5 prateleiras, ótima para livros e decoração. Sem avarias.', 'seminovo', 'disponivel', 5],
  ['maria', 'cadeiras', 'Cadeira de escritório giratória', 'Cadeira com regulagem de altura e rodízios. Espuma do assento um pouco desgastada.', 'usado', 'disponivel', 6],
  ['maria', 'sofas', 'Poltrona de leitura', 'Poltrona bege confortável, ideal para sala ou quarto. Pés de madeira.', 'seminovo', 'disponivel', 7],
  ['maria', 'armarios-e-guarda-roupas', 'Cômoda 4 gavetas', 'Cômoda de madeira com 4 gavetas amplas. Já combinada com uma pessoa, retirada marcada.', 'usado', 'reservado', 8],
  ['joao', 'estantes-e-racks', 'Rack para TV até 50 polegadas', 'Rack preto com 2 nichos e porta de correr. Cabe TV de até 50".', 'seminovo', 'disponivel', 1],
  ['joao', 'mesas', 'Escrivaninha com gaveteiro', 'Escrivaninha de 1,20 m com gaveteiro de 3 gavetas. Serve para home office ou estudo.', 'usado', 'disponivel', 3],
  ['joao', 'outros', 'Berço de madeira com colchão', 'Berço com grades reguláveis e colchão. Já foi doado, fica aqui como exemplo de item finalizado.', 'usado', 'doado', 9],
  ['joao', 'mesas', 'Mesa de centro de vidro', 'Mesa de centro com tampo de vidro temperado e base de metal. Sem trincas.', 'seminovo', 'disponivel', 2],
];

// CPF com dígitos verificadores válidos (cálculo padrão).
function cpfValido(base9) {
  const dv = (digitos) => {
    const soma = digitos.reduce((acc, d, i) => acc + d * (digitos.length + 1 - i), 0);
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  };
  const d = base9.split('').map(Number);
  const d1 = dv(d);
  const d2 = dv([...d, d1]);
  return `${base9}${d1}${d2}`;
}

async function criar() {
  let host = '';
  try {
    host = new URL(process.env.DATABASE_URL).host;
  } catch {
    // DATABASE_URL ausente/malformada: o Prisma reclama logo abaixo com mensagem própria.
  }
  console.log(`Banco de destino: ${host || '(DATABASE_URL não definida)'}`);

  // Este seed cria um admin com senha conhecida: nunca num banco que alguém de fora alcance.
  if (/supabase\.(co|com)/.test(host) && !process.argv.includes('--forcar')) {
    console.error('Recusado: o destino é o Supabase e este seed cria um admin com senha conhecida. Use o Postgres local ou rode com --forcar.');
    process.exit(1);
  }

  const senhaHash = await bcrypt.hash(SENHA, SALT_ROUNDS);
  const agora = new Date();

  const categorias = {};
  for (const [nome, slug] of CATEGORIAS) {
    categorias[slug] = await prisma.categoria.upsert({ where: { slug }, update: {}, create: { nome, slug } });
  }

  const usuarios = {};
  const enderecos = {};
  for (const u of USUARIOS) {
    usuarios[u.chave] = await prisma.usuario.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        cpf: cpfValido(u.cpfBase),
        senhaHash,
        primeiroNome: u.primeiroNome,
        ultimoNome: u.ultimoNome,
        tipo: u.tipo,
        genero: u.genero,
        emailVerificado: true,
        termosAceitosEm: agora,
      },
    });

    if (u.endereco) {
      enderecos[u.chave] =
        (await prisma.endereco.findFirst({ where: { usuarioId: usuarios[u.chave].id, principal: true } })) ||
        (await prisma.endereco.create({ data: { ...u.endereco, usuarioId: usuarios[u.chave].id, principal: true } }));
    }
  }

  const doadores = [usuarios.maria.id, usuarios.joao.id];
  const jaTem = await prisma.itemDoacao.count({ where: { doadorId: { in: doadores } } });
  if (jaTem > 0) {
    console.log(`Os móveis de demonstração já existem (${jaTem} itens); não criei de novo.`);
  } else {
    const itens = [];
    const imagens = [];
    ITENS.forEach(([doador, slug, titulo, descricao, condicao, status, dias], i) => {
      const end = enderecos[doador];
      const id = crypto.randomUUID();
      itens.push({
        id,
        doadorId: usuarios[doador].id,
        categoriaId: categorias[slug].id,
        titulo,
        descricao,
        condicao,
        status,
        cidade: end.cidade,
        estado: end.estado,
        enderecoId: end.id,
        // coordenada do endereço do doador com um deslocamento mínimo, para os pontos não se sobreporem
        latitude: end.latitude + ((i % 5) - 2) * 0.004,
        longitude: end.longitude + ((i % 5) - 2) * 0.004,
        criadoEm: new Date(agora.getTime() - dias * 24 * 60 * 60 * 1000),
      });
      imagens.push({ itemId: id, url: `https://placehold.co/600x400?text=${encodeURIComponent(titulo)}`, ordem: 0 });
    });
    await prisma.itemDoacao.createMany({ data: itens });
    await prisma.imagemItem.createMany({ data: imagens });
    console.log(`Criados ${itens.length} móveis (${itens.filter((x) => x.status === 'disponivel').length} disponíveis).`);
  }

  console.log('\nContas de demonstração (senha de todas: ' + SENHA + ')');
  for (const u of USUARIOS) console.log(`  ${u.tipo.padEnd(7)} ${u.email}`);
}

criar()
  .catch((err) => {
    console.error('Erro no seed de demonstração:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
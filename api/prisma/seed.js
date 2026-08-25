// Popula CidadeCentroide com um ponto de partida — as 27 capitais estaduais,
// mais Cornélio Procópio-PR (ambiente de desenvolvimento deste projeto).
//
// NÃO é cobertura completa dos ~5.570 municípios brasileiros — é só o
// suficiente pra a busca por raio funcionar de verdade em ambiente de
// desenvolvimento/demo sem precisar geocodificar tudo manualmente. Cidade
// que não estiver aqui, e cujos itens não tenham endereço vinculado (que traz
// coordenada própria via CEP), simplesmente fica de fora da busca por raio —
// continua aparecendo normalmente no filtro por cidade/estado.
//
// Pra expandir depois: a malha de municípios do IBGE tem coordenadas de
// sede municipal de domínio público (https://www.ibge.gov.br/geociencias) —
// dá pra gerar um CSV completo dali e importar em lote.
//
// Roda com: npx prisma db seed  (ou node prisma/seed.js diretamente)

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const CENTROIDES = [
  { cidade: 'Rio Branco', estado: 'AC', latitude: -9.9749, longitude: -67.8243 },
  { cidade: 'Maceió', estado: 'AL', latitude: -9.6498, longitude: -35.7089 },
  { cidade: 'Macapá', estado: 'AP', latitude: 0.0349, longitude: -51.0694 },
  { cidade: 'Manaus', estado: 'AM', latitude: -3.119, longitude: -60.0217 },
  { cidade: 'Salvador', estado: 'BA', latitude: -12.9714, longitude: -38.5014 },
  { cidade: 'Fortaleza', estado: 'CE', latitude: -3.7172, longitude: -38.5433 },
  { cidade: 'Brasília', estado: 'DF', latitude: -15.7939, longitude: -47.8828 },
  { cidade: 'Vitória', estado: 'ES', latitude: -20.3155, longitude: -40.3128 },
  { cidade: 'Goiânia', estado: 'GO', latitude: -16.6869, longitude: -49.2648 },
  { cidade: 'São Luís', estado: 'MA', latitude: -2.5307, longitude: -44.3068 },
  { cidade: 'Cuiabá', estado: 'MT', latitude: -15.6014, longitude: -56.0979 },
  { cidade: 'Campo Grande', estado: 'MS', latitude: -20.4697, longitude: -54.6201 },
  { cidade: 'Belo Horizonte', estado: 'MG', latitude: -19.9167, longitude: -43.9345 },
  { cidade: 'Belém', estado: 'PA', latitude: -1.4558, longitude: -48.5039 },
  { cidade: 'João Pessoa', estado: 'PB', latitude: -7.1195, longitude: -34.845 },
  { cidade: 'Curitiba', estado: 'PR', latitude: -25.4284, longitude: -49.2733 },
  { cidade: 'Cornélio Procópio', estado: 'PR', latitude: -23.1809, longitude: -50.6428 },
  { cidade: 'Recife', estado: 'PE', latitude: -8.0476, longitude: -34.877 },
  { cidade: 'Teresina', estado: 'PI', latitude: -5.0892, longitude: -42.8019 },
  { cidade: 'Rio de Janeiro', estado: 'RJ', latitude: -22.9068, longitude: -43.1729 },
  { cidade: 'Natal', estado: 'RN', latitude: -5.7945, longitude: -35.211 },
  { cidade: 'Porto Alegre', estado: 'RS', latitude: -30.0346, longitude: -51.2177 },
  { cidade: 'Porto Velho', estado: 'RO', latitude: -8.7619, longitude: -63.9039 },
  { cidade: 'Boa Vista', estado: 'RR', latitude: 2.8235, longitude: -60.6758 },
  { cidade: 'Florianópolis', estado: 'SC', latitude: -27.5954, longitude: -48.548 },
  { cidade: 'São Paulo', estado: 'SP', latitude: -23.5505, longitude: -46.6333 },
  { cidade: 'Aracaju', estado: 'SE', latitude: -10.9472, longitude: -37.0731 },
  { cidade: 'Palmas', estado: 'TO', latitude: -10.2491, longitude: -48.3243 },
];

async function main() {
  for (const centroide of CENTROIDES) {
    await prisma.cidadeCentroide.upsert({
      where: { cidade_estado: { cidade: centroide.cidade, estado: centroide.estado } },
      create: centroide,
      update: centroide,
    });
  }
  console.log(`Seed concluído: ${CENTROIDES.length} centroides de cidade.`);
}

main()
  .catch((err) => {
    console.error('Erro ao rodar o seed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

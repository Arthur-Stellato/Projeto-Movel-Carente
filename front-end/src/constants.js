// Espelha os enums fixos do backend (ver ../../api/src/lib/validadores.js e
// prisma/schema.prisma) — mantidos aqui como única fonte pro frontend, sem
// depender de nenhum pacote gerado do Prisma.

export const UFS = [
  'AC', 'AL', 'AP', 'AM', 'BA', 'CE', 'DF', 'ES', 'GO',
  'MA', 'MT', 'MS', 'MG', 'PA', 'PB', 'PR', 'PE', 'PI',
  'RJ', 'RN', 'RS', 'RO', 'RR', 'SC', 'SP', 'SE', 'TO',
];

export const CONDICOES_ITEM = [
  { valor: 'novo', rotulo: 'Novo' },
  { valor: 'seminovo', rotulo: 'Seminovo' },
  { valor: 'usado', rotulo: 'Usado' },
];

export const STATUS_ITEM = {
  disponivel: { rotulo: 'Disponível', cor: 'verde' },
  reservado: { rotulo: 'Reservado', cor: 'ocre' },
  doado: { rotulo: 'Doado', cor: 'neutro' },
  cancelado: { rotulo: 'Cancelado', cor: 'tijolo' },
};

export const STATUS_SOLICITACAO = {
  pendente: { rotulo: 'Pendente', cor: 'ocre' },
  aceita: { rotulo: 'Aceita', cor: 'verde' },
  recusada: { rotulo: 'Recusada', cor: 'tijolo' },
  cancelada: { rotulo: 'Cancelada', cor: 'neutro' },
};

export const STATUS_DENUNCIA = {
  pendente: { rotulo: 'Pendente', cor: 'ocre' },
  analisada: { rotulo: 'Analisada', cor: 'neutro' },
  procedente: { rotulo: 'Procedente', cor: 'tijolo' },
  improcedente: { rotulo: 'Improcedente', cor: 'verde' },
};

export const MOTIVOS_DENUNCIA = [
  { valor: 'conteudo_impropio', rotulo: 'Conteúdo impróprio' },
  { valor: 'golpe', rotulo: 'Golpe' },
  { valor: 'spam', rotulo: 'Spam' },
  { valor: 'item_nao_condiz', rotulo: 'Item não condiz com o anúncio' },
  { valor: 'comportamento_abusivo', rotulo: 'Comportamento abusivo' },
  { valor: 'outro', rotulo: 'Outro' },
];

export const TIPOS_NOTIFICACAO_ICONE = {
  nova_solicitacao: 'bi-bell',
  solicitacao_aceita: 'bi-check-circle',
  solicitacao_recusada: 'bi-x-circle',
  item_denunciado: 'bi-flag',
  sistema: 'bi-info-circle',
};

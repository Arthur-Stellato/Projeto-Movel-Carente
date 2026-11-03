-- Índices de desempenho para as consultas mais quentes da API.
-- Medido com 100 mil itens: listagem 27 ms -> 0,3 ms, busca por raio 470 ms -> 38 ms,
-- notificações 8 ms -> 0,1 ms. Em escala pequena (milhares de itens) o ganho quase não aparece.
--
-- Até aqui itens_doacao, imagens_item e notificacoes não tinham NENHUM índice além da
-- chave primária (o Postgres não cria índice sozinho para chave estrangeira).
--
-- Tudo com IF NOT EXISTS, então pode rodar de novo sem erro.
-- Sem CONCURRENTLY de propósito: o Prisma aplica a migration numa transação e o Postgres
-- não permite CONCURRENTLY dentro de transação. Cada CREATE INDEX bloqueia ESCRITA na tabela
-- (leitura continua) enquanto constrói — alguns segundos para dezenas de milhares de linhas.

-- pg_trgm: extensão padrão do Postgres (contrib), como o unaccent — só precisa ser
-- habilitada. Permite índice para ILIKE, que é o que o Prisma gera em mode: 'insensitive'.
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Listagem pública (GET /itens):
--   WHERE status = ... AND deletado_em IS NULL ORDER BY criado_em DESC
-- Não é índice parcial de propósito: o Prisma parametriza o status, e um índice parcial
-- pode não ser usado quando o plano da consulta é genérico.
-- deletado_em fica em INCLUDE, NÃO na chave: "IS NULL" no meio da chave faz o Postgres perder
-- a ordenação por criado_em e voltar a Seq Scan + Sort (medido). Em INCLUDE, o count(*)
-- da paginação vira Index Only Scan.
CREATE INDEX IF NOT EXISTS itens_listagem_idx
  ON itens_doacao (status, criado_em DESC) INCLUDE (deletado_em);

-- Mesma listagem filtrada por categoria.
CREATE INDEX IF NOT EXISTS itens_categoria_idx
  ON itens_doacao (categoria_id, status, criado_em DESC) INCLUDE (deletado_em);

-- "Meus itens" (GET /itens/meus).
CREATE INDEX IF NOT EXISTS itens_doador_idx
  ON itens_doacao (doador_id, criado_em DESC);

-- Filtros textuais da listagem, todos ILIKE:
--   cidade  -> equals insensitive; titulo/descricao -> contains insensitive (%termo%).
CREATE INDEX IF NOT EXISTS itens_cidade_trgm_idx
  ON itens_doacao USING gin (cidade gin_trgm_ops);
CREATE INDEX IF NOT EXISTS itens_titulo_trgm_idx
  ON itens_doacao USING gin (titulo gin_trgm_ops);
CREATE INDEX IF NOT EXISTS itens_descricao_trgm_idx
  ON itens_doacao USING gin (descricao gin_trgm_ops);

-- Busca por raio (GET /itens?lat=&lng=&raioKm=). A expressão do índice precisa ser IGUAL
-- à usada em listarPorRaio (src/services/item.service.js): se mudar lá, tem que mudar aqui,
-- senão o Postgres ignora o índice sem avisar.
CREATE INDEX IF NOT EXISTS itens_geo_idx
  ON itens_doacao USING gist (geography(ST_MakePoint(longitude, latitude)));

-- Imagens dos itens: toda listagem busca "WHERE item_id IN (...)" aqui.
CREATE INDEX IF NOT EXISTS imagens_item_item_idx
  ON imagens_item (item_id, ordem);

-- Notificações: lista paginada e contagem de não lidas (o badge da navbar, em toda página).
CREATE INDEX IF NOT EXISTS notificacoes_usuario_idx
  ON notificacoes (usuario_id, criado_em DESC);
CREATE INDEX IF NOT EXISTS notificacoes_nao_lidas_idx
  ON notificacoes (usuario_id) WHERE lida = false;

-- "Minhas solicitações": o índice único existente começa por item_id, não ajuda aqui.
CREATE INDEX IF NOT EXISTS solicitacoes_solicitante_idx
  ON solicitacoes_item (solicitante_id);

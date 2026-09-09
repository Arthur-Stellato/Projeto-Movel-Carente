-- Permite busca por cidade sem exigir acento exato ("cornelio" encontra
-- "Cornélio Procópio"). unaccent é uma extensão padrão do Postgres (contrib),
-- não precisa de instalador separado como o PostGIS — vem em qualquer
-- instalação normal, só precisa ser habilitada neste banco.
CREATE EXTENSION IF NOT EXISTS unaccent;

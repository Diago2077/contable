-- ═══════════════════════════════════════════════════════════════════════════
-- 014_cache_ia.sql — Registrar los tokens servidos desde el cache de OpenAI
--
-- OpenAI cachea automaticamente el prefijo de todo prompt de mas de 1024
-- tokens y lo factura a mitad de precio. Como el listado del plan de cuentas
-- va al principio del prompt y la imagen al final, en una carga por lote del
-- mismo contribuyente ese prefijo es identico entre llamadas: el descuento ya
-- se venia aplicando, pero el costo que calculaba la app lo ignoraba y por
-- eso quedaba sobreestimado.
-- ═══════════════════════════════════════════════════════════════════════════

alter table uso_ia add column if not exists tokens_cache integer not null default 0;

comment on column uso_ia.tokens_cache is
  'Parte de tokens_prompt que OpenAI sirvio desde su cache, facturada al precio de cache.';

-- El precio del cache se configura igual que los otros dos, para no tener que
-- deployar si OpenAI cambia el descuento.
alter table configuracion_ia
  add column if not exists precio_cache_por_1m numeric(10, 4) not null default 1.25;

comment on column configuracion_ia.precio_cache_por_1m is
  'USD por millon de tokens de prompt servidos desde cache. En gpt-4o es la mitad del precio de input.';

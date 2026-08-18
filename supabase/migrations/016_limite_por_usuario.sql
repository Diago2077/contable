-- ═══════════════════════════════════════════════════════════════════════════
-- 016_limite_por_usuario.sql — Tope de extraccion por usuario y por hora
--
-- El limite de tokens que ya existia es mensual y por estudio, asi que una
-- sola persona arrastrando trescientos archivos podia agotar el cupo del
-- estudio entero en minutos y dejar sin servicio al resto hasta el mes
-- siguiente. Este tope corta ese caso sin estorbar una carga normal.
--
-- Hace falta saber quien hizo cada llamada, que hasta ahora no se guardaba.
-- ═══════════════════════════════════════════════════════════════════════════

alter table uso_ia add column if not exists usuario_id uuid references usuarios (id) on delete set null;

create index if not exists uso_ia_usuario_fecha_idx on uso_ia (usuario_id, created_at desc);

-- null = sin tope. El valor por defecto da de sobra para una carga por lote
-- normal y sigue frenando el caso de las trescientas de una.
alter table configuracion_ia
  add column if not exists limite_tokens_usuario_hora integer default 500000;

comment on column configuracion_ia.limite_tokens_usuario_hora is
  'Tokens que un mismo usuario puede consumir por hora. null = sin tope.';

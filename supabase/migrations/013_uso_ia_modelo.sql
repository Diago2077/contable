-- ═══════════════════════════════════════════════════════════════════════════
-- 013_uso_ia_modelo.sql — Guarda que modelo se uso en cada llamada
--
-- El modelo es configurable desde /admindrpcs y puede cambiar de una
-- llamada a otra (como paso probando gpt-4o vs gpt-5.6-luna): sin esta
-- columna, el log de consumo no distingue con que modelo se genero cada
-- fila.
-- ═══════════════════════════════════════════════════════════════════════════

alter table uso_ia add column if not exists modelo text;

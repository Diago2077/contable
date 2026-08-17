-- ═══════════════════════════════════════════════════════════════════════════
-- 011_plan_cuentas_estructura.sql — Plan de cuentas: de codigo/descripcion a
-- una estructura jerarquica real, tomada del formato de exportacion de un
-- sistema contable (columnas Cuenta, Denominacion, Nivel, Naturaleza,
-- Asentable, Centro Costo, Moneda, Tipo cambio, Cuenta SSET).
--
-- Decisiones (confirmadas con el usuario):
--   - "Asentable" no restringe todavia que cuenta se puede usar para
--     categorizar una factura -- es solo informativo por ahora.
--   - "Nivel" es un campo independiente (no se deriva de la cantidad de
--     digitos de la cuenta): se carga/importa tal cual.
--   - "Tipo cambio" es texto libre, sin validacion ni opciones fijas.
-- ═══════════════════════════════════════════════════════════════════════════

alter table plan_cuentas rename column codigo to cuenta;
alter table plan_cuentas rename column descripcion to denominacion;

alter table plan_cuentas add column if not exists nivel integer;
alter table plan_cuentas add column if not exists naturaleza text check (naturaleza in ('D', 'A'));
alter table plan_cuentas add column if not exists asentable boolean not null default true;
alter table plan_cuentas add column if not exists centro_costo boolean not null default false;
alter table plan_cuentas add column if not exists moneda text not null default 'PYG';
alter table plan_cuentas add column if not exists tipo_cambio text;
alter table plan_cuentas add column if not exists cuenta_sset text;

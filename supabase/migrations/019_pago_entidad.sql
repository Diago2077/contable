-- ═══════════════════════════════════════════════════════════════════════════
-- 019_pago_entidad.sql — Banco o entidad de cada pago
--
-- Opcional y de texto libre: puede ser un banco, una cooperativa, una casa de
-- cambio o una billetera (Tigo Money, Personal Pay). No se arma una lista
-- cerrada porque las entidades cambian y un pago en efectivo no tiene ninguna.
-- ═══════════════════════════════════════════════════════════════════════════

alter table pagos_factura add column if not exists entidad text;

comment on column pagos_factura.entidad is
  'Banco o entidad por donde se movio el pago (texto libre, opcional).';

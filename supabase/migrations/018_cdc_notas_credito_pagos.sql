-- ═══════════════════════════════════════════════════════════════════════════
-- 018_cdc_notas_credito_pagos.sql — CDC, notas de credito y pagos por factura
--
--   facturas
--     ├── cdc                      codigo de control de la factura electronica
--     ├── notas_credito (N)        reducen lo que se debe/cobra de la factura
--     └── pagos_factura (N)        comprobantes de pago (o cobro, en una venta)
--
-- Sobre cada factura se mantienen, por trigger, el total acreditado y el total
-- pagado, y de ahi salen dos columnas generadas: el saldo y el estado de pago.
-- Quedan como columnas reales (no calculadas en el cliente) para poder
-- filtrar y paginar por estado del lado del servidor, igual que por fecha.
--
--     saldo = total - notas de credito - pagos
--
--     acreditada   las notas de credito cubren toda la factura
--     pendiente    no hay pagos
--     pagada       lo pagado alcanza lo que quedaba despues de las notas
--     parcial      hay pagos pero no alcanzan
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- CDC en facturas
--
-- 44 digitos. Se guarda solo el numero (sin los espacios con que se imprime).
-- Es unico por documento, asi que cuando existe pasa a ser una segunda red
-- anti-duplicados, ademas del indice por numero de factura.
-- ─────────────────────────────────────────────────────────────
alter table facturas add column if not exists cdc text;

alter table facturas drop constraint if exists facturas_cdc_formato;
alter table facturas add constraint facturas_cdc_formato
  check (cdc is null or cdc ~ '^[0-9]{44}$');

create unique index if not exists facturas_cdc_unico
  on facturas (contribuyente_id, cdc) where cdc is not null;

-- Para que las notas y los pagos puedan apuntar a una factura *de la misma
-- empresa y el mismo contribuyente* con una sola clave foranea compuesta, en
-- vez de confiar en que la politica de RLS lo revise.
create unique index if not exists facturas_id_empresa_contribuyente
  on facturas (id, empresa_id, contribuyente_id);

-- ─────────────────────────────────────────────────────────────
-- notas_credito
--
-- Los montos se guardan en positivo: la nota resta, pero el signo lo pone
-- quien la usa. Moneda y tipo de operacion se heredan de la factura.
-- ─────────────────────────────────────────────────────────────
create table if not exists notas_credito (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null,
  contribuyente_id uuid not null,
  factura_id uuid not null,

  numero_nota text,
  fecha_nota date,
  timbrado text,
  timbrado_vencimiento date,
  cdc text check (cdc is null or cdc ~ '^[0-9]{44}$'),
  motivo text,

  exentas numeric(14, 2) not null default 0 check (exentas >= 0),
  gravado_5 numeric(14, 2) not null default 0 check (gravado_5 >= 0),
  gravado_10 numeric(14, 2) not null default 0 check (gravado_10 >= 0),
  iva_5 numeric(14, 2) not null default 0 check (iva_5 >= 0),
  iva_10 numeric(14, 2) not null default 0 check (iva_10 >= 0),
  total numeric(14, 2) not null default 0 check (total >= 0),

  iva_total numeric(14, 2) generated always as (iva_5 + iva_10) stored,
  subtotal numeric(14, 2) generated always as (total - iva_5 - iva_10) stored,

  observaciones text,

  archivo_path text,
  archivo_nombre text,
  archivo_mime text,
  extraccion_raw jsonb,

  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint notas_credito_factura_fkey
    foreign key (factura_id, empresa_id, contribuyente_id)
    references facturas (id, empresa_id, contribuyente_id) on delete cascade
);

create index if not exists notas_credito_factura_idx
  on notas_credito (factura_id, empresa_id, contribuyente_id);
create index if not exists notas_credito_created_by_idx on notas_credito (created_by);

-- La misma nota no se carga dos veces. El numero solo es unico por emisor, y
-- todas las notas de una factura comparten emisor: por eso va por factura.
create unique index if not exists notas_credito_numero_unico
  on notas_credito (factura_id, numero_nota) where numero_nota is not null and numero_nota <> '';
create unique index if not exists notas_credito_cdc_unico
  on notas_credito (contribuyente_id, cdc) where cdc is not null;

drop trigger if exists notas_credito_updated_at on notas_credito;
create trigger notas_credito_updated_at
  before update on notas_credito
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- pagos_factura
--
-- En una compra es un pago al proveedor; en una venta, un cobro al cliente.
-- La tabla es la misma: lo que cambia es como se le llama en pantalla.
-- ─────────────────────────────────────────────────────────────
create table if not exists pagos_factura (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null,
  contribuyente_id uuid not null,
  factura_id uuid not null,

  fecha_pago date not null,
  monto numeric(14, 2) not null check (monto > 0),
  medio_pago text not null default 'transferencia'
    check (medio_pago in ('efectivo', 'transferencia', 'cheque', 'tarjeta', 'otro')),
  referencia text,
  observaciones text,

  archivo_path text,
  archivo_nombre text,
  archivo_mime text,

  created_by uuid references usuarios (id) on delete set null,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  constraint pagos_factura_factura_fkey
    foreign key (factura_id, empresa_id, contribuyente_id)
    references facturas (id, empresa_id, contribuyente_id) on delete cascade
);

create index if not exists pagos_factura_factura_idx
  on pagos_factura (factura_id, empresa_id, contribuyente_id);
create index if not exists pagos_factura_created_by_idx on pagos_factura (created_by);

drop trigger if exists pagos_factura_updated_at on pagos_factura;
create trigger pagos_factura_updated_at
  before update on pagos_factura
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Totales y estado sobre la factura
-- ─────────────────────────────────────────────────────────────
alter table facturas add column if not exists notas_credito_total numeric(14, 2) not null default 0;
alter table facturas add column if not exists pagado_total numeric(14, 2) not null default 0;

alter table facturas add column if not exists saldo numeric(14, 2)
  generated always as (total - notas_credito_total - pagado_total) stored;

alter table facturas add column if not exists estado_pago text
  generated always as (
    case
      when total > 0 and notas_credito_total >= total then 'acreditada'
      when pagado_total <= 0 then 'pendiente'
      when pagado_total >= total - notas_credito_total then 'pagada'
      else 'parcial'
    end
  ) stored;

create index if not exists facturas_estado_pago_idx on facturas (contribuyente_id, estado_pago);

-- Se recalcula desde cero en vez de sumar/restar diferencias: no hay forma de
-- que un dato viejo o un trigger salteado lo desincronice.
--
-- Viven en `private`, que PostgREST no expone, y corren como quien dispara el
-- cambio: la RLS de `facturas` se sigue aplicando.
create or replace function private.recalcular_cobros_factura(p_factura_id uuid)
returns void
language sql set search_path = public as $$
  update facturas f set
    notas_credito_total = coalesce((select sum(n.total) from notas_credito n where n.factura_id = f.id), 0),
    pagado_total = coalesce((select sum(p.monto) from pagos_factura p where p.factura_id = f.id), 0)
  where f.id = p_factura_id;
$$;

create or replace function private.tg_recalcular_cobros()
returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op <> 'DELETE' then
    perform private.recalcular_cobros_factura(new.factura_id);
  end if;
  -- Borrar, o mover un registro de una factura a otra, deja a la anterior vieja
  if tg_op = 'DELETE' or (tg_op = 'UPDATE' and old.factura_id is distinct from new.factura_id) then
    perform private.recalcular_cobros_factura(old.factura_id);
  end if;
  return null;
end;
$$;

drop trigger if exists notas_credito_recalcular on notas_credito;
create trigger notas_credito_recalcular
  after insert or update or delete on notas_credito
  for each row execute function private.tg_recalcular_cobros();

drop trigger if exists pagos_factura_recalcular on pagos_factura;
create trigger pagos_factura_recalcular
  after insert or update or delete on pagos_factura
  for each row execute function private.tg_recalcular_cobros();

-- ─────────────────────────────────────────────────────────────
-- RLS: mismo criterio que el resto, dentro de la empresa
-- ─────────────────────────────────────────────────────────────
alter table notas_credito enable row level security;
drop policy if exists "Acceso por empresa" on notas_credito;
create policy "Acceso por empresa" on notas_credito for all to authenticated
  using (private.es_super_admin() or empresa_id = private.mi_empresa_id())
  with check (private.es_super_admin() or empresa_id = private.mi_empresa_id());

alter table pagos_factura enable row level security;
drop policy if exists "Acceso por empresa" on pagos_factura;
create policy "Acceso por empresa" on pagos_factura for all to authenticated
  using (private.es_super_admin() or empresa_id = private.mi_empresa_id())
  with check (private.es_super_admin() or empresa_id = private.mi_empresa_id());

revoke all on table notas_credito, pagos_factura from anon;
grant select, insert, update, delete on table notas_credito, pagos_factura to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Alta de factura: ahora tambien guarda el CDC
--
-- Se dejan solo los digitos, porque en el papel se imprime en grupos de
-- cuatro separados por espacios. Si despues de limpiarlo no son 44, la
-- restriccion facturas_cdc_formato lo rechaza.
-- ─────────────────────────────────────────────────────────────
create or replace function public.crear_factura_con_detalles(factura jsonb, detalles jsonb default '[]'::jsonb)
returns uuid
language plpgsql security invoker set search_path = public as $$
declare
  nueva_id uuid;
begin
  insert into facturas (
    empresa_id, contribuyente_id, plan_cuenta_id, tipo_operacion,
    numero_factura, fecha_factura, timbrado, timbrado_vencimiento, condicion_venta,
    cdc,
    proveedor_nombre, proveedor_ruc, proveedor_direccion,
    cliente_nombre, cliente_ruc, cliente_direccion,
    moneda, tipo_cambio,
    exentas, gravado_5, gravado_10, iva_5, iva_10, total,
    forma_pago, observaciones,
    archivo_path, archivo_nombre, archivo_mime,
    extraccion_raw, created_by
  )
  select
    (factura->>'empresa_id')::uuid,
    (factura->>'contribuyente_id')::uuid,
    nullif(factura->>'plan_cuenta_id', '')::uuid,
    factura->>'tipo_operacion',
    nullif(factura->>'numero_factura', ''),
    nullif(factura->>'fecha_factura', '')::date,
    nullif(factura->>'timbrado', ''),
    nullif(factura->>'timbrado_vencimiento', '')::date,
    nullif(factura->>'condicion_venta', ''),
    nullif(regexp_replace(coalesce(factura->>'cdc', ''), '\D', '', 'g'), ''),
    nullif(factura->>'proveedor_nombre', ''),
    nullif(factura->>'proveedor_ruc', ''),
    nullif(factura->>'proveedor_direccion', ''),
    nullif(factura->>'cliente_nombre', ''),
    nullif(factura->>'cliente_ruc', ''),
    nullif(factura->>'cliente_direccion', ''),
    coalesce(nullif(factura->>'moneda', ''), 'PYG'),
    nullif(factura->>'tipo_cambio', '')::numeric,
    coalesce((factura->>'exentas')::numeric, 0),
    coalesce((factura->>'gravado_5')::numeric, 0),
    coalesce((factura->>'gravado_10')::numeric, 0),
    coalesce((factura->>'iva_5')::numeric, 0),
    coalesce((factura->>'iva_10')::numeric, 0),
    coalesce((factura->>'total')::numeric, 0),
    nullif(factura->>'forma_pago', ''),
    nullif(factura->>'observaciones', ''),
    nullif(factura->>'archivo_path', ''),
    nullif(factura->>'archivo_nombre', ''),
    nullif(factura->>'archivo_mime', ''),
    factura->'extraccion_raw',
    nullif(factura->>'created_by', '')::uuid
  returning id into nueva_id;

  insert into factura_detalles (factura_id, orden, descripcion, cantidad, precio_unitario, subtotal_linea, tasa_iva)
  select
    nueva_id,
    coalesce((d->>'orden')::int, (ord - 1)::int),
    d->>'descripcion',
    nullif(d->>'cantidad', '')::numeric,
    nullif(d->>'precio_unitario', '')::numeric,
    nullif(d->>'subtotal_linea', '')::numeric,
    nullif(d->>'tasa_iva', '')::smallint
  from jsonb_array_elements(detalles) with ordinality as t (d, ord);

  return nueva_id;
end;
$$;

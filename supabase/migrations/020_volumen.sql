-- ═══════════════════════════════════════════════════════════════════════════
-- 020_volumen.sql — Que las consultas sigan rapidas con muchos datos
--
-- Tres cosas, medidas con 200.000 facturas (20 contribuyentes, 10.000 el que
-- se mira) como usuario con RLS:
--
--   1. Las politicas llamaban a private.es_super_admin() y mi_empresa_id()
--      por CADA FILA. Envueltas en (select ...) Postgres las evalua una vez
--      por consulta. La pagina del listado de facturas bajo de 440 ms a 11 ms
--      y el conteo de 441 ms a 9 ms. La logica de acceso es identica.
--
--   2. El listado ordena por fecha_factura desc NULLS LAST, created_at desc y
--      el indice existente (fecha desc, nulls first) no sirve para ese orden:
--      Postgres ordenaba en memoria todas las facturas del contribuyente. Con
--      el indice que coincide la pagina baja a 0,2 ms.
--
--   3. Los totales de consumo de IA y los limites se calculaban trayendo las
--      filas y sumando en JS, y PostgREST corta en 1000 filas sin avisar:
--      pasadas las 1000 llamadas del mes los totales salian incompletos y el
--      limite mensual dejaba de cortar. Ahora suma la base.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- 1. Politicas con (select ...)
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Ver mi empresa" on empresas;
create policy "Ver mi empresa" on empresas for select to authenticated
  using ((select private.es_super_admin()) or id = (select private.mi_empresa_id()));

drop policy if exists "Super admin crea empresas" on empresas;
create policy "Super admin crea empresas" on empresas for insert to authenticated
  with check ((select private.es_super_admin()));

drop policy if exists "Super admin edita empresas" on empresas;
create policy "Super admin edita empresas" on empresas for update to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

drop policy if exists "Super admin borra empresas" on empresas;
create policy "Super admin borra empresas" on empresas for delete to authenticated
  using ((select private.es_super_admin()));

drop policy if exists "Ver usuarios de mi empresa" on usuarios;
create policy "Ver usuarios de mi empresa" on usuarios for select to authenticated
  using (
    (select private.es_super_admin())
    or id = (select auth.uid())
    or ((select private.es_admin_de_estudio()) and empresa_id = (select private.mi_empresa_id()))
  );

drop policy if exists "Alta de usuarios" on usuarios;
create policy "Alta de usuarios" on usuarios for insert to authenticated
  with check ((select private.es_super_admin()));

drop policy if exists "Edicion de usuarios" on usuarios;
create policy "Edicion de usuarios" on usuarios for update to authenticated
  using (
    (select private.es_super_admin())
    or ((select private.es_admin_de_estudio()) and empresa_id = (select private.mi_empresa_id()) and rol = 'usuario')
  )
  with check (
    (select private.es_super_admin())
    or ((select private.es_admin_de_estudio()) and empresa_id = (select private.mi_empresa_id()) and rol = 'usuario')
  );

drop policy if exists "Baja de usuarios" on usuarios;
create policy "Baja de usuarios" on usuarios for delete to authenticated
  using ((select private.es_super_admin()));

drop policy if exists "Acceso por empresa" on contribuyentes;
create policy "Acceso por empresa" on contribuyentes for all to authenticated
  using ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()))
  with check ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()));

drop policy if exists "Acceso por empresa" on plan_cuentas;
create policy "Acceso por empresa" on plan_cuentas for all to authenticated
  using ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()))
  with check ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()));

drop policy if exists "Acceso por empresa" on facturas;
create policy "Acceso por empresa" on facturas for all to authenticated
  using ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()))
  with check ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()));

drop policy if exists "Acceso por empresa" on factura_detalles;
create policy "Acceso por empresa" on factura_detalles for all to authenticated
  using (exists (
    select 1 from facturas f
    where f.id = factura_id
      and ((select private.es_super_admin()) or f.empresa_id = (select private.mi_empresa_id()))
  ))
  with check (exists (
    select 1 from facturas f
    where f.id = factura_id
      and ((select private.es_super_admin()) or f.empresa_id = (select private.mi_empresa_id()))
  ));

drop policy if exists "Acceso por empresa" on notas_credito;
create policy "Acceso por empresa" on notas_credito for all to authenticated
  using ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()))
  with check ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()));

drop policy if exists "Acceso por empresa" on pagos_factura;
create policy "Acceso por empresa" on pagos_factura for all to authenticated
  using ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()))
  with check ((select private.es_super_admin()) or empresa_id = (select private.mi_empresa_id()));

drop policy if exists "Super admin ve la configuracion de IA" on configuracion_ia;
create policy "Super admin ve la configuracion de IA" on configuracion_ia for select to authenticated
  using ((select private.es_super_admin()));

drop policy if exists "Super admin edita la configuracion de IA" on configuracion_ia;
create policy "Super admin edita la configuracion de IA" on configuracion_ia for update to authenticated
  using ((select private.es_super_admin())) with check ((select private.es_super_admin()));

drop policy if exists "Super admin ve el consumo" on uso_ia;
create policy "Super admin ve el consumo" on uso_ia for select to authenticated
  using ((select private.es_super_admin()));

drop policy if exists "Archivos de mi empresa" on storage.objects;
create policy "Archivos de mi empresa" on storage.objects for all to authenticated
  using (
    bucket_id = 'facturas'
    and ((select private.es_super_admin()) or (storage.foldername(name))[1] = (select private.mi_empresa_id())::text)
  )
  with check (
    bucket_id = 'facturas'
    and ((select private.es_super_admin()) or (storage.foldername(name))[1] = (select private.mi_empresa_id())::text)
  );

-- ─────────────────────────────────────────────────────────────
-- 2. Indice que coincide con el orden del listado de facturas
--    (reemplaza al de 001, que solo cubria "desc" con nulls first)
-- ─────────────────────────────────────────────────────────────
create index if not exists facturas_orden_idx
  on facturas (contribuyente_id, fecha_factura desc nulls last, created_at desc);
drop index if exists facturas_contribuyente_fecha_idx;

-- ─────────────────────────────────────────────────────────────
-- 3. Totales de consumo de IA sumados en la base
--
-- security invoker: quien llama ve lo que su RLS le deja (el super_admin desde
-- la app; el servidor entra con service_role y ve todo). Cualquier filtro en
-- NULL se ignora.
-- ─────────────────────────────────────────────────────────────
create or replace function public.uso_ia_totales(
  p_empresa uuid default null,
  p_usuario uuid default null,
  p_desde timestamptz default null,
  p_hasta timestamptz default null
)
returns table (llamadas bigint, tokens bigint, tokens_cache bigint, costo_usd numeric)
language sql stable security invoker set search_path = public as $$
  select
    count(*),
    coalesce(sum(tokens_total), 0)::bigint,
    coalesce(sum(tokens_cache), 0)::bigint,
    coalesce(sum(costo_usd), 0)
  from uso_ia
  where (p_empresa is null or empresa_id = p_empresa)
    and (p_usuario is null or usuario_id = p_usuario)
    and (p_desde is null or created_at >= p_desde)
    and (p_hasta is null or created_at < p_hasta)
$$;

revoke execute on function public.uso_ia_totales(uuid, uuid, timestamptz, timestamptz) from public, anon;
grant execute on function public.uso_ia_totales(uuid, uuid, timestamptz, timestamptz) to authenticated, service_role;

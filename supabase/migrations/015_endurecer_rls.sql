-- ═══════════════════════════════════════════════════════════════════════════
-- 015_endurecer_rls.sql — Saca los helpers de RLS de la API publica
--
-- mi_empresa_id(), es_super_admin() y es_admin_de_estudio() viven en `public`,
-- y todo lo que esta en `public` queda expuesto por PostgREST en
-- /rest/v1/rpc/. No filtran datos de terceros (cada una responde sobre quien
-- llama) pero no hay motivo para que sean alcanzables desde afuera: existen
-- solo para que las evalue la RLS.
--
-- Revocarles el execute NO es una opcion: se probo y la RLS deja de poder
-- evaluarlas ("permission denied for function mi_empresa_id"), que es tanto
-- como apagar el aislamiento. La salida es moverlas a un esquema que
-- PostgREST no expone, manteniendo el grant que la RLS necesita.
--
-- De paso se resuelven dos avisos de rendimiento del linter:
--   · la politica de select de `usuarios` reevaluaba auth.uid() por fila;
--   · `empresas` y `usuarios` tenian politicas permisivas duplicadas para el
--     mismo rol y accion, y Postgres las evaluaba todas en cada consulta.
-- ═══════════════════════════════════════════════════════════════════════════

create schema if not exists private;
grant usage on schema private to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Helpers, identicos a los de public salvo por el (select auth.uid()),
-- que Postgres evalua una vez por consulta en vez de una por fila.
-- ─────────────────────────────────────────────────────────────
create or replace function private.mi_empresa_id()
returns uuid
language sql stable security definer set search_path = public as $$
  select u.empresa_id
  from usuarios u
  join empresas e on e.id = u.empresa_id
  where u.id = (select auth.uid()) and u.activo = true and e.activo = true
$$;

create or replace function private.es_super_admin()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'super_admin' and activo from public.usuarios where id = (select auth.uid())),
    false
  )
$$;

create or replace function private.es_admin_de_estudio()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'admin' and activo from public.usuarios where id = (select auth.uid())),
    false
  )
$$;

revoke execute on function private.mi_empresa_id() from public, anon;
revoke execute on function private.es_super_admin() from public, anon;
revoke execute on function private.es_admin_de_estudio() from public, anon;
grant execute on function private.mi_empresa_id() to authenticated;
grant execute on function private.es_super_admin() to authenticated;
grant execute on function private.es_admin_de_estudio() to authenticated;

-- ─────────────────────────────────────────────────────────────
-- empresas — el ALL del super_admin se parte en insert/update/delete para
-- que el select quede resuelto por una sola politica.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Ver mi empresa" on empresas;
drop policy if exists "Super admin gestiona empresas" on empresas;

create policy "Ver mi empresa" on empresas for select to authenticated
  using (private.es_super_admin() or id = private.mi_empresa_id());

create policy "Super admin crea empresas" on empresas for insert to authenticated
  with check (private.es_super_admin());

create policy "Super admin edita empresas" on empresas for update to authenticated
  using (private.es_super_admin()) with check (private.es_super_admin());

create policy "Super admin borra empresas" on empresas for delete to authenticated
  using (private.es_super_admin());

-- ─────────────────────────────────────────────────────────────
-- usuarios — mismo criterio, y las dos politicas de update se fusionan en
-- una sola con un OR. Nadie se edita a si mismo: eso sigue igual.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Ver usuarios de mi empresa" on usuarios;
drop policy if exists "Super admin gestiona usuarios" on usuarios;
drop policy if exists "Admin activa usuarios de su empresa" on usuarios;

create policy "Ver usuarios de mi empresa" on usuarios for select to authenticated
  using (
    private.es_super_admin()
    or id = (select auth.uid())
    or (private.es_admin_de_estudio() and empresa_id = private.mi_empresa_id())
  );

create policy "Alta de usuarios" on usuarios for insert to authenticated
  with check (private.es_super_admin());

create policy "Edicion de usuarios" on usuarios for update to authenticated
  using (
    private.es_super_admin()
    or (private.es_admin_de_estudio() and empresa_id = private.mi_empresa_id() and rol = 'usuario')
  )
  with check (
    private.es_super_admin()
    or (private.es_admin_de_estudio() and empresa_id = private.mi_empresa_id() and rol = 'usuario')
  );

create policy "Baja de usuarios" on usuarios for delete to authenticated
  using (private.es_super_admin());

-- ─────────────────────────────────────────────────────────────
-- Resto de las tablas: misma logica de siempre, con el esquema nuevo.
-- ─────────────────────────────────────────────────────────────
drop policy if exists "Acceso por empresa" on contribuyentes;
create policy "Acceso por empresa" on contribuyentes for all to authenticated
  using (private.es_super_admin() or empresa_id = private.mi_empresa_id())
  with check (private.es_super_admin() or empresa_id = private.mi_empresa_id());

drop policy if exists "Acceso por empresa" on plan_cuentas;
create policy "Acceso por empresa" on plan_cuentas for all to authenticated
  using (private.es_super_admin() or empresa_id = private.mi_empresa_id())
  with check (private.es_super_admin() or empresa_id = private.mi_empresa_id());

drop policy if exists "Acceso por empresa" on facturas;
create policy "Acceso por empresa" on facturas for all to authenticated
  using (private.es_super_admin() or empresa_id = private.mi_empresa_id())
  with check (private.es_super_admin() or empresa_id = private.mi_empresa_id());

drop policy if exists "Acceso por empresa" on factura_detalles;
create policy "Acceso por empresa" on factura_detalles for all to authenticated
  using (exists (
    select 1 from facturas f
    where f.id = factura_id and (private.es_super_admin() or f.empresa_id = private.mi_empresa_id())
  ))
  with check (exists (
    select 1 from facturas f
    where f.id = factura_id and (private.es_super_admin() or f.empresa_id = private.mi_empresa_id())
  ));

drop policy if exists "Super admin ve la configuracion de IA" on configuracion_ia;
create policy "Super admin ve la configuracion de IA" on configuracion_ia for select to authenticated
  using (private.es_super_admin());

drop policy if exists "Super admin edita la configuracion de IA" on configuracion_ia;
create policy "Super admin edita la configuracion de IA" on configuracion_ia for update to authenticated
  using (private.es_super_admin()) with check (private.es_super_admin());

drop policy if exists "Super admin ve el consumo" on uso_ia;
create policy "Super admin ve el consumo" on uso_ia for select to authenticated
  using (private.es_super_admin());

drop policy if exists "Archivos de mi empresa" on storage.objects;
create policy "Archivos de mi empresa" on storage.objects for all to authenticated
  using (
    bucket_id = 'facturas'
    and (private.es_super_admin() or (storage.foldername(name))[1] = private.mi_empresa_id()::text)
  )
  with check (
    bucket_id = 'facturas'
    and (private.es_super_admin() or (storage.foldername(name))[1] = private.mi_empresa_id()::text)
  );

-- Ya no las referencia ninguna politica: se van del esquema expuesto.
drop function if exists public.mi_empresa_id();
drop function if exists public.es_super_admin();
drop function if exists public.es_admin_de_estudio();

-- ─────────────────────────────────────────────────────────────
-- Claves foraneas sin indice de cobertura.
--
-- No se tocan contribuyentes_empresa_idx ni facturas_empresa_idx, que el
-- linter reporta como no usados: con la cantidad de filas que hay hoy el
-- planner hace seq scan siempre, asi que "no usado" no dice nada todavia y
-- son justo las columnas por las que filtra la RLS.
-- ─────────────────────────────────────────────────────────────
create index if not exists facturas_created_by_idx on facturas (created_by);
create index if not exists plan_cuentas_empresa_idx on plan_cuentas (empresa_id);
create index if not exists uso_ia_contribuyente_idx on uso_ia (contribuyente_id);

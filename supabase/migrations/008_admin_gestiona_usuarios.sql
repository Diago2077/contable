-- ═══════════════════════════════════════════════════════════════════════════
-- 008_admin_gestiona_usuarios.sql — El admin de un estudio tambien da de
-- alta/edita/desactiva usuarios, pero solo los 'usuario' de SU propio
-- estudio: nunca a otro admin, nunca a otro estudio.
--
-- El alta/edicion/borrado/cambio de contrasena pasan por api/admin/usuarios.ts
-- (necesitan la service_role key para tocar auth.users) y ese endpoint ya
-- fuerza el alcance del lado del servidor. Lo unico que falta ademas es esta
-- policy: activar/desactivar se hace con un update directo del cliente
-- contra PostgREST, sin pasar por el servidor.
-- ═══════════════════════════════════════════════════════════════════════════

-- Mismo patron que mi_empresa_id()/es_super_admin(): security definer para
-- leer `usuarios` saltando la RLS y evitar la recursion infinita.
create or replace function public.es_admin_de_estudio()
returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce(
    (select rol = 'admin' and activo from public.usuarios where id = auth.uid()),
    false
  )
$$;

revoke execute on function public.es_admin_de_estudio() from public, anon;
grant execute on function public.es_admin_de_estudio() to authenticated;

drop policy if exists "Admin activa usuarios de su empresa" on usuarios;
create policy "Admin activa usuarios de su empresa" on usuarios for update to authenticated
  using (es_admin_de_estudio() and empresa_id = mi_empresa_id() and rol = 'usuario')
  with check (es_admin_de_estudio() and empresa_id = mi_empresa_id() and rol = 'usuario');

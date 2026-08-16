-- ═══════════════════════════════════════════════════════════════════════════
-- 009_usuarios_sin_acceso_a_lista.sql — Un usuario raso no ve la lista de
-- usuarios de su estudio, solo su propia fila.
--
-- Hasta ahora cualquiera con `empresa_id` igual podia leer TODAS las filas de
-- `usuarios` de su estudio (era una pantalla de solo lectura para todos).
-- Ahora que gestionar usuarios es exclusivo de admin/super_admin, la lectura
-- se restringe igual: un 'usuario' solo puede leer su propia fila (la
-- necesita el login para saber quien es), nunca las de sus companeros.
-- ═══════════════════════════════════════════════════════════════════════════

drop policy if exists "Ver usuarios de mi empresa" on usuarios;
create policy "Ver usuarios de mi empresa" on usuarios for select to authenticated
  using (
    es_super_admin()
    or id = auth.uid()
    or (es_admin_de_estudio() and empresa_id = mi_empresa_id())
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 017_limites_bucket.sql — Hacer cumplir del lado del servidor lo que la
-- pantalla de carga promete
--
-- El limite de 15 MB y la lista de tipos permitidos vivian solo en el
-- navegador (tipoPermitido / archivoDemasiadoGrande en src/lib/archivos.ts).
-- La politica de Storage valida la ruta -- que empiece con el empresa_id de
-- quien sube -- pero no mira ni el peso ni el contenido, asi que un usuario
-- con su sesion legitima podia subir un archivo de cualquier tipo y tamano a
-- su propia carpeta usando el cliente de Supabase desde la consola.
--
-- No comprometia los datos de otro estudio (el aislamiento por empresa sigue
-- igual), pero es almacenamiento que paga el dueno del sistema y contenido
-- que nadie controla.
-- ═══════════════════════════════════════════════════════════════════════════

update storage.buckets
set
  -- 15 MB, el mismo numero que muestra la pantalla de carga
  file_size_limit = 15 * 1024 * 1024,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
where id = 'facturas';

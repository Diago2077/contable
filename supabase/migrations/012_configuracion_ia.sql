-- ═══════════════════════════════════════════════════════════════════════════
-- 012_configuracion_ia.sql — Configuracion del modelo de IA, editable por el
-- super_admin desde /admindrpcs en vez de constantes fijas en el codigo.
--
-- Tabla singleton (un solo registro posible, via el truco de PK boolean
-- forzada a true): modelo, precios por millon de tokens (para el costo
-- estimado de uso_ia) y parametros de la llamada a OpenAI.
-- ═══════════════════════════════════════════════════════════════════════════

create table if not exists configuracion_ia (
  id boolean primary key default true,
  modelo text not null,
  precio_input_por_1m numeric(10, 4) not null,
  precio_output_por_1m numeric(10, 4) not null,
  -- Solo aplica a modelos gpt-5.x; se ignora para gpt-4o y similares.
  reasoning_effort text check (reasoning_effort in ('none', 'low', 'medium', 'high', 'xhigh', 'max')),
  max_tokens integer not null default 2500,
  updated_at timestamptz not null default now(),
  constraint configuracion_ia_singleton check (id)
);

insert into configuracion_ia (id, modelo, precio_input_por_1m, precio_output_por_1m, reasoning_effort, max_tokens)
values (true, 'gpt-5.6-luna', 1, 6, 'low', 2500)
on conflict (id) do nothing;

alter table configuracion_ia enable row level security;

drop policy if exists "Super admin ve la configuracion de IA" on configuracion_ia;
create policy "Super admin ve la configuracion de IA" on configuracion_ia for select to authenticated
  using (es_super_admin());

drop policy if exists "Super admin edita la configuracion de IA" on configuracion_ia;
create policy "Super admin edita la configuracion de IA" on configuracion_ia for update to authenticated
  using (es_super_admin()) with check (es_super_admin());

revoke all on table configuracion_ia from anon;
grant select, update on table configuracion_ia to authenticated;

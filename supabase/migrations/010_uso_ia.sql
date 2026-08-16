-- ═══════════════════════════════════════════════════════════════════════════
-- 010_uso_ia.sql — Control de consumo de IA por estudio
--
-- Cada llamada a api/extraer.ts que efectivamente le pega a OpenAI deja un
-- registro con los tokens que devolvio la respuesta y un costo estimado en
-- USD (precio fijo por modelo, no exacto pero suficiente para tener una
-- nocion de gasto). El super_admin puede ademas asignarle a cada estudio un
-- limite mensual de tokens: al superarlo, api/extraer.ts corta la
-- extraccion hasta el mes siguiente (o hasta que se le suba/saque el
-- limite).
-- ═══════════════════════════════════════════════════════════════════════════

alter table empresas add column if not exists limite_tokens_mensual integer;

create table if not exists uso_ia (
  id uuid default gen_random_uuid() primary key,
  empresa_id uuid not null references empresas (id) on delete cascade,
  contribuyente_id uuid references contribuyentes (id) on delete set null,
  tokens_prompt integer not null default 0,
  tokens_completion integer not null default 0,
  tokens_total integer not null default 0,
  costo_usd numeric(10, 4) not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists uso_ia_empresa_fecha_idx on uso_ia (empresa_id, created_at desc);

-- Solo lo inserta el servidor con la service_role key (bypassea la RLS); del
-- lado del cliente es de solo lectura, y solo para el super_admin.
alter table uso_ia enable row level security;

drop policy if exists "Super admin ve el consumo" on uso_ia;
create policy "Super admin ve el consumo" on uso_ia for select to authenticated
  using (es_super_admin());

revoke all on table uso_ia from anon;
grant select on table uso_ia to authenticated;

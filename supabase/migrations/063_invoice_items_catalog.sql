create table if not exists public.invoice_items_catalog (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  description text,
  category text,
  unit text default 'unité',
  unit_price numeric(14, 2) not null default 0,
  tva_rate numeric(5, 2) not null default 20,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoice_items_catalog_user_active
  on public.invoice_items_catalog(user_id, is_active, name);

alter table public.invoice_items_catalog enable row level security;

drop policy if exists "Owners read invoice item catalog" on public.invoice_items_catalog;
create policy "Owners read invoice item catalog"
  on public.invoice_items_catalog for select to authenticated
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'read', user_id, null)
  );

drop policy if exists "Owners insert invoice item catalog" on public.invoice_items_catalog;
create policy "Owners insert invoice item catalog"
  on public.invoice_items_catalog for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "Owners update invoice item catalog" on public.invoice_items_catalog;
create policy "Owners update invoice item catalog"
  on public.invoice_items_catalog for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Owners delete invoice item catalog" on public.invoice_items_catalog;
create policy "Owners delete invoice item catalog"
  on public.invoice_items_catalog for delete to authenticated
  using (auth.uid() = user_id);

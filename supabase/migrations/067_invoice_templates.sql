-- ── Invoice templates ─────────────────────────────────────────────────────────
-- Saved invoice setups (client + line items + payment delay) that users can
-- re-apply in one click when creating a new invoice, instead of retyping.

create table if not exists public.invoice_templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  dossier_id uuid references public.dossiers(id) on delete cascade,
  name text not null,
  client_id uuid references public.clients(id) on delete set null,
  items jsonb not null default '[]'::jsonb,
  payment_delay text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_invoice_templates_owner
  on public.invoice_templates(user_id, dossier_id);

alter table public.invoice_templates enable row level security;

drop policy if exists "Members read invoice templates" on public.invoice_templates;
create policy "Members read invoice templates"
  on public.invoice_templates for select
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'read', user_id, dossier_id)
  );

drop policy if exists "Members create invoice templates" on public.invoice_templates;
create policy "Members create invoice templates"
  on public.invoice_templates for insert
  with check (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'create', user_id, dossier_id)
  );

drop policy if exists "Members update invoice templates" on public.invoice_templates;
create policy "Members update invoice templates"
  on public.invoice_templates for update
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'update', user_id, dossier_id)
  )
  with check (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'update', user_id, dossier_id)
  );

drop policy if exists "Members delete invoice templates" on public.invoice_templates;
create policy "Members delete invoice templates"
  on public.invoice_templates for delete
  using (
    auth.uid() = user_id
    or public.member_has_permission('invoice', 'delete', user_id, dossier_id)
  );

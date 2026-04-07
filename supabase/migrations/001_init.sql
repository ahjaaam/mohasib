-- ============================================================
-- Mohasib — Initial Schema
-- Run this in the Supabase SQL Editor (or via supabase db push)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────
-- USERS (extends Supabase auth.users)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name   TEXT,
  company     TEXT,
  ice         TEXT,        -- Identifiant Commun de l'Entreprise (Morocco)
  rc          TEXT,        -- Registre de Commerce
  if_fiscal   TEXT,        -- Identifiant Fiscal
  address     TEXT,
  city        TEXT,
  phone       TEXT,
  email       TEXT,
  currency    TEXT NOT NULL DEFAULT 'MAD',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ─────────────────────────────────────────────
-- CLIENTS
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.clients (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  email       TEXT,
  phone       TEXT,
  address     TEXT,
  city        TEXT,
  ice         TEXT,
  rc          TEXT,
  notes       TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_clients_user_id ON public.clients(user_id);

-- ─────────────────────────────────────────────
-- INVOICES
-- ─────────────────────────────────────────────
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue', 'cancelled');

CREATE TABLE IF NOT EXISTS public.invoices (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  invoice_number  TEXT NOT NULL,
  status          invoice_status NOT NULL DEFAULT 'draft',
  issue_date      DATE NOT NULL DEFAULT CURRENT_DATE,
  due_date        DATE,
  subtotal        NUMERIC(12, 2) NOT NULL DEFAULT 0,
  tax_rate        NUMERIC(5, 2) NOT NULL DEFAULT 20,   -- TVA 20% default Morocco
  tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,
  total           NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency        TEXT NOT NULL DEFAULT 'MAD',
  notes           TEXT,
  items           JSONB NOT NULL DEFAULT '[]',
  -- items schema: [{ description, quantity, unit_price, amount }]
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_invoices_user_id   ON public.invoices(user_id);
CREATE INDEX idx_invoices_client_id ON public.invoices(client_id);
CREATE INDEX idx_invoices_status    ON public.invoices(status);
CREATE UNIQUE INDEX idx_invoices_number ON public.invoices(user_id, invoice_number);

-- ─────────────────────────────────────────────
-- TRANSACTIONS
-- ─────────────────────────────────────────────
CREATE TYPE transaction_type AS ENUM ('income', 'expense');

CREATE TABLE IF NOT EXISTS public.transactions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_id      UUID REFERENCES public.invoices(id) ON DELETE SET NULL,
  client_id       UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  type            transaction_type NOT NULL,
  category        TEXT,
  description     TEXT NOT NULL,
  amount          NUMERIC(12, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'MAD',
  date            DATE NOT NULL DEFAULT CURRENT_DATE,
  payment_method  TEXT,   -- 'cash', 'bank_transfer', 'check', 'card'
  reference       TEXT,
  notes           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transactions_user_id   ON public.transactions(user_id);
CREATE INDEX idx_transactions_type      ON public.transactions(type);
CREATE INDEX idx_transactions_date      ON public.transactions(date);

-- ─────────────────────────────────────────────
-- AUTO-UPDATE updated_at TRIGGER
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_users_updated_at        BEFORE UPDATE ON public.users        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clients_updated_at      BEFORE UPDATE ON public.clients      FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_invoices_updated_at     BEFORE UPDATE ON public.invoices     FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_transactions_updated_at BEFORE UPDATE ON public.transactions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────
-- ROW LEVEL SECURITY
-- ─────────────────────────────────────────────
ALTER TABLE public.users        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Users: only own profile
CREATE POLICY "users_own_profile" ON public.users
  FOR ALL USING (auth.uid() = id);

-- Clients: only own clients
CREATE POLICY "clients_own_data" ON public.clients
  FOR ALL USING (auth.uid() = user_id);

-- Invoices: only own invoices
CREATE POLICY "invoices_own_data" ON public.invoices
  FOR ALL USING (auth.uid() = user_id);

-- Transactions: only own transactions
CREATE POLICY "transactions_own_data" ON public.transactions
  FOR ALL USING (auth.uid() = user_id);

-- ─────────────────────────────────────────────
-- AUTO-CREATE USER PROFILE ON SIGNUP
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', '')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

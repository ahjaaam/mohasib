-- Dedicated inbox email per dossier
ALTER TABLE public.dossiers
  ADD COLUMN IF NOT EXISTS inbox_email TEXT UNIQUE;

-- Email routing rules
CREATE TABLE IF NOT EXISTS public.email_routing_rules (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiduciaire_user_id  UUID REFERENCES auth.users ON DELETE CASCADE,
  dossier_id          UUID REFERENCES public.dossiers ON DELETE CASCADE,
  rule_type           TEXT NOT NULL,   -- 'sender_email' | 'sender_domain' | 'subject_keyword'
  rule_value          TEXT NOT NULL,
  is_active           BOOLEAN DEFAULT TRUE,
  created_at          TIMESTAMPTZ DEFAULT NOW()
);

-- Global inbox for unrouted / pending-assignment emails
CREATE TABLE IF NOT EXISTS public.inbox_global (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fiduciaire_user_id        UUID REFERENCES auth.users ON DELETE CASCADE,
  email_from                TEXT,
  email_subject             TEXT,
  email_body                TEXT,
  received_at               TIMESTAMPTZ DEFAULT NOW(),
  file_url                  TEXT,
  file_name                 TEXT,
  file_type                 TEXT,
  assigned_dossier_id       UUID REFERENCES public.dossiers ON DELETE SET NULL,
  ai_suggested_dossier_id   UUID REFERENCES public.dossiers ON DELETE SET NULL,
  ai_confidence             NUMERIC,
  ai_reasoning              TEXT,
  status                    TEXT DEFAULT 'unassigned',  -- 'unassigned' | 'assigned' | 'ignored'
  assigned_at               TIMESTAMPTZ,
  created_at                TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.email_routing_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inbox_global        ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiduciaire_routing_rules" ON public.email_routing_rules;
CREATE POLICY "fiduciaire_routing_rules" ON public.email_routing_rules
  FOR ALL USING (fiduciaire_user_id = auth.uid());

DROP POLICY IF EXISTS "fiduciaire_inbox_global" ON public.inbox_global
;
CREATE POLICY "fiduciaire_inbox_global" ON public.inbox_global
  FOR ALL USING (fiduciaire_user_id = auth.uid());

-- Backfill inbox_email for existing dossiers
UPDATE public.dossiers
   SET inbox_email = 'factures-' || SUBSTRING(id::TEXT, 1, 6) || '@mohasibai.com'
 WHERE inbox_email IS NULL;

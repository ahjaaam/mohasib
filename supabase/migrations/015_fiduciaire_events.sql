-- Custom calendar events for fiduciaire users

CREATE TABLE IF NOT EXISTS public.fiduciaire_events (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  fiduciaire_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  dossier_id    UUID REFERENCES dossiers(id) ON DELETE SET NULL,
  title         TEXT NOT NULL,
  date          DATE NOT NULL,
  category      TEXT NOT NULL DEFAULT 'custom',
  description   TEXT,
  color         TEXT,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.fiduciaire_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "fiduciaire_events_owner" ON public.fiduciaire_events;
CREATE POLICY "fiduciaire_events_owner" ON public.fiduciaire_events
  FOR ALL USING (fiduciaire_user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_fiduciaire_events_user_date
  ON public.fiduciaire_events(fiduciaire_user_id, date);

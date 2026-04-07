-- ============================================================
-- Mohasib — Chat History (with conversations)
-- Run this in the Supabase SQL Editor after 001_init.sql
-- ============================================================

CREATE TABLE IF NOT EXISTS public.chat_conversations (
  id         UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id    UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title      TEXT NOT NULL DEFAULT 'Nouvelle conversation',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_conversations_user_id ON public.chat_conversations(user_id);

ALTER TABLE public.chat_conversations ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_conversations' AND policyname = 'chat_conversations_own'
  ) THEN
    CREATE POLICY "chat_conversations_own" ON public.chat_conversations
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

CREATE OR REPLACE TRIGGER update_chat_conversations_updated_at
  BEFORE UPDATE ON public.chat_conversations
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─────────────────────────────────────────────

-- Add conversation_id to existing chat_messages if table already exists
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chat_messages') THEN
    -- Add conversation_id column if missing
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'chat_messages' AND column_name = 'conversation_id'
    ) THEN
      ALTER TABLE public.chat_messages
        ADD COLUMN conversation_id UUID REFERENCES public.chat_conversations(id) ON DELETE CASCADE;
    END IF;
  ELSE
    CREATE TABLE public.chat_messages (
      id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
      conversation_id UUID NOT NULL REFERENCES public.chat_conversations(id) ON DELETE CASCADE,
      role            TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
      content         TEXT NOT NULL,
      created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_chat_messages_user_id         ON public.chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_conversation_id ON public.chat_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_created_at      ON public.chat_messages(created_at);

ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'chat_messages' AND policyname = 'chat_messages_own'
  ) THEN
    CREATE POLICY "chat_messages_own" ON public.chat_messages
      FOR ALL USING (auth.uid() = user_id);
  END IF;
END $$;

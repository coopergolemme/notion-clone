create extension if not exists vector;

-- Cross-page linking
create table if not exists page_link (
  from_page_id uuid references page(id) on delete cascade,
  to_page_id   uuid references page(id) on delete cascade,
  created_at   timestamptz default now(),
  primary key (from_page_id, to_page_id)
);

-- Speed up lookups
create index if not exists idx_page_link_from on page_link(from_page_id);
create index if not exists idx_page_link_to   on page_link(to_page_id);

-- Page format: latex | rich
ALTER TABLE page
ADD COLUMN IF NOT EXISTS format text NOT NULL DEFAULT 'rich';

-- Cache synthesized answers/summaries for search queries
CREATE TABLE IF NOT EXISTS ai_answer_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  answer text NOT NULL,
  sources jsonb NOT NULL,     -- [{id,title},...]
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_answer_cache_query_idx ON ai_answer_cache USING gin (to_tsvector('english', query));

-- Change page.embedding to 768 dims for Gemini text-embedding-004
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name='page' AND column_name='embedding'
  ) THEN
    -- If embedding column exists with a different dim, recreate with 768
    BEGIN
      ALTER TABLE page ALTER COLUMN embedding TYPE vector(768);
    EXCEPTION WHEN others THEN
      -- Fallback: drop + recreate if type cast not allowed (no data loss path for MVP)
      ALTER TABLE page DROP COLUMN embedding;
      ALTER TABLE page ADD COLUMN embedding vector(768);
    END;
  ELSE
    ALTER TABLE page ADD COLUMN embedding vector(768);
  END IF;
END $$;

-- Speed up cosine searches
CREATE INDEX IF NOT EXISTS page_embedding_cos_idx
ON page USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);

-- Version history for pages
CREATE TABLE IF NOT EXISTS page_version (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  page_id      uuid NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  title        text NOT NULL,
  content      text NOT NULL,
  format       text NOT NULL DEFAULT 'rich',
  tags         text[] NOT NULL DEFAULT '{}',
  created_at   timestamptz NOT NULL DEFAULT now(),
  created_by   text NULL
);

-- Helper index for quick lookups
CREATE INDEX IF NOT EXISTS page_version_page_idx ON page_version(page_id, created_at DESC);

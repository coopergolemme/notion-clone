create extension if not exists vector;

-- Speed up cosine searches on page.embedding
CREATE INDEX IF NOT EXISTS page_embedding_cos_idx
ON page
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

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

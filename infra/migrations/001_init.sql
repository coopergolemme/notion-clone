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

-- Baseline schema for notion-ai-starter

-- extensions
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS vector;

-- core pages table
CREATE TABLE IF NOT EXISTS page (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  content     text NOT NULL DEFAULT '',
  format      text NOT NULL DEFAULT 'rich',         -- 'rich' | 'latex'
  tags        text[] NOT NULL DEFAULT '{}',         -- keep array for simple UI
  embedding   vector(768),                          -- Gemini text-embedding-004 (cosine)
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- tags as normalized entities for joins/filters
CREATE TABLE IF NOT EXISTS tag (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL UNIQUE
);

-- page <-> tag join (used by search/filter joins)
CREATE TABLE IF NOT EXISTS page_tag (
  page_id     uuid NOT NULL REFERENCES page(id) ON DELETE CASCADE,
  tag_id      uuid NOT NULL REFERENCES tag(id) ON DELETE CASCADE,
  PRIMARY KEY (page_id, tag_id)
);

CREATE INDEX IF NOT EXISTS idx_page_updated_at ON page(updated_at DESC);

-- keep page_tag in sync with page.tags array (simple approach: replace rows on upsert)
CREATE OR REPLACE FUNCTION sync_page_tags() RETURNS trigger AS $$
DECLARE
  t text;
  tid uuid;
BEGIN
  -- clear existing
  DELETE FROM page_tag WHERE page_id = NEW.id;

  -- insert (dedup) from array
  IF NEW.tags IS NOT NULL THEN
    -- normalize to lower-case, trim, drop empties
    WITH norm AS (
      SELECT DISTINCT trim(lower(x)) AS name
      FROM unnest(NEW.tags) AS x
      WHERE trim(x) <> ''
    ), ins_tag AS (
      INSERT INTO tag(name)
      SELECT n.name FROM norm n
      ON CONFLICT (name) DO NOTHING
      RETURNING id, name
    )
    INSERT INTO page_tag(page_id, tag_id)
    SELECT NEW.id, t2.id
    FROM (
      SELECT id, name FROM ins_tag
      UNION
      SELECT t.id, t.name
      FROM tag t
      JOIN norm n ON n.name = t.name
    ) AS t2;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_page_tags_ins ON page;
DROP TRIGGER IF EXISTS trg_page_tags_upd ON page;

CREATE TRIGGER trg_page_tags_ins
AFTER INSERT ON page
FOR EACH ROW EXECUTE FUNCTION sync_page_tags();

CREATE TRIGGER trg_page_tags_upd
AFTER UPDATE OF tags ON page
FOR EACH ROW EXECUTE FUNCTION sync_page_tags();

-- cross-page links (for [[Title]] and backlinks/graph)
CREATE TABLE IF NOT EXISTS page_link (
  from_page_id uuid REFERENCES page(id) ON DELETE CASCADE,
  to_page_id   uuid REFERENCES page(id) ON DELETE CASCADE,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (from_page_id, to_page_id)
);
CREATE INDEX IF NOT EXISTS idx_page_link_from ON page_link(from_page_id);
CREATE INDEX IF NOT EXISTS idx_page_link_to   ON page_link(to_page_id);

-- cache for multi-doc answers (you already created this in another run; keep idempotent)
CREATE TABLE IF NOT EXISTS ai_answer_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  query text NOT NULL,
  answer text NOT NULL,
  sources jsonb NOT NULL,
  created_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS ai_answer_cache_query_idx
  ON ai_answer_cache USING gin (to_tsvector('english', query));

-- embedding index for cosine similarity
CREATE INDEX IF NOT EXISTS page_embedding_cos_idx
  ON page USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

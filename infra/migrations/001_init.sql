create extension if not exists vector;

-- Speed up cosine searches on page.embedding
CREATE INDEX IF NOT EXISTS page_embedding_cos_idx
ON page
USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

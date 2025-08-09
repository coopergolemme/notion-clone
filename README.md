# Notion-Style AI Database — Starter Repo

An end-to-end starter for a Notion-like database with AI features (summarize, related pages, tag suggestions). 
Stack: **React + TypeScript + Tailwind** (web), **Fastify + TypeScript** (api), **PostgreSQL + pgvector** (db).

## Quick start (local)

### 1) Prereqs
- Node 18+ & pnpm (`npm i -g pnpm`)
- Docker (for Postgres + pgvector)
- (Optional) OpenAI key for embeddings/summarization

### 2) Boot the database
```bash
docker compose -f infra/docker-compose.yml up -d
# create schema
DATABASE_URL=postgres://postgres:postgres@localhost:5432/notion_ai pnpm -C infra migrate
```

### 3) Install deps
```bash
pnpm i -w
```

### 4) Run API
```bash
cp api/.env.example api/.env
# edit api/.env (DATABASE_URL, OPENAI_API_KEY optional)
pnpm -C api dev
```

### 5) Run Web
```bash
pnpm -C web dev
```

Visit web app at http://localhost:5173 and API at http://localhost:3001/health

## Monorepo layout
```
/api   - Fastify (TypeScript) REST API
/web   - React + TS app (Vite), Tailwind
/infra - Docker Compose + SQL migrations
```

## Features (MVP)
- Pages CRUD with tags
- Semantic related pages + search (pgvector)
- Summarize page & suggest tags (LLM)
- Table + Page view (basic editor) + AI side panel

## Notes
- pgvector is installed via Docker image; embeddings functions are stubbed and will no-op without `OPENAI_API_KEY`.
- This is a teaching starter: intentionally minimal, easy to extend.

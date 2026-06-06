# Heuristic

AI-powered job application co-pilot. Capture job descriptions, tailor your CV with RAG, generate cover letters, track applications.

## Stack
- **Backend**: NestJS + TypeScript + Prisma + PostgreSQL (with pgvector)
- **Frontend**: Next.js 14 (App Router) + Tailwind + shadcn/ui
- **LLM**: Hybrid — Ollama (local, free) for extraction tasks, Claude Haiku for quality-critical paths
- **Embeddings**: Local via `@xenova/transformers` (bge-small-en)
- **Extension**: Plasmo framework (v0.2+)
- **Infra**: Docker Compose locally, Hetzner VPS + Caddy + GitHub Actions (v0.3)

## Getting started

```bash
# 1. Install dependencies
pnpm install

# 2. Start Postgres
pnpm db:up

# 3. Run migrations + seed CV bullets
pnpm db:migrate
pnpm db:seed

# 4. Pull the local LLM model (one time, ~2GB)
ollama pull qwen2.5:3b

# 5. Start backend and frontend in parallel
pnpm dev
```

API runs on `http://localhost:3001`, web on `http://localhost:3000`.

## Architecture

See `docs/ARCHITECTURE.md` (TODO).

## Status

- [x] v0.1 — auth, JD ingestion, bullet retrieval, suggested rewrites
- [ ] v0.2 — browser extension, cover letters, match scoring
- [ ] v0.3 — deployment, reminders, analytics

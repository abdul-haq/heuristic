# Heuristic

AI-powered job application co-pilot. Capture job descriptions, get your CV tailored via RAG, generate cover letters, compile ready-to-use LaTeX output, and track every application — all from one dashboard.

Built as a full-stack portfolio project demonstrating real AI engineering: RAG over CV bullets with pgvector, hybrid local/cloud LLM inference, structured outputs, versioned generations, dynamic LaTeX CV compilation, and an LLM cost/latency observability layer.

> Built by Abdul Haq — M.Sc. student in High Integrity Systems, Frankfurt UAS. Currently seeking a Werkstudent role (15–20h/week) in the Rhein-Main or surrounding area.

---

## What it does

### Capture
Paste any job description. The LLM extracts structured fields — company, role, required skills, German level, work format — and embeds the text for semantic matching. Works in English and German.

### Analyze
Instantly see:
- **Match score** (0–100) combining semantic similarity (60%) and keyword coverage (40%)
- **Matched keywords** — which of your skills appear in the JD
- **Missing keywords** — what the JD requires that your CV doesn't mention
- **Red flags** — German level gaps, full-time vs Werkstudent, location mismatches

### Tailor
One click generates CV bullet rewrites optimized for this specific JD. The system:
1. Retrieves your most relevant bullets via pgvector cosine similarity
2. Rewrites each one to mirror JD vocabulary — without inventing experience
3. Shows side-by-side original vs tailored diff
4. Lets you accept or reject each rewrite
5. Saves up to 3 versions so you can compare and switch

### Compile
Click "Compile CV" to get a tailored CV instantly:
- **Plain text** — paste directly into job portals (StepStone, LinkedIn, Personio)
- **LaTeX** — copy into Overleaf and compile
- **Download .tex** — upload to Overleaf and compile

Your CV formatting, header, skills section, and education are preserved exactly — only the experience bullets are swapped with tailored versions.

### Cover Letters
Generate English or German cover letters grounded in your actual CV bullets. Proper German business conventions (formal Sie, Sehr geehrte Damen und Herren, Mit freundlichen Grüßen). Up to 3 versions stored per JD.

### Track
Every application moves through: Captured → Applied → Interview → Offer → Rejected. Dashboard shows stats at a glance: total applications, callback rate, interviews, offers.

### CV Setup
- **Import from PDF** — upload your existing CV as a PDF. The AI extracts every bullet point, tags skills (react, nodejs, php, etc.), and embeds them for RAG matching.
- **Set template** — upload your `.tex` file once. Every compiled CV uses your exact formatting.

---

## How the RAG pipeline works

```
1. Upload CV (PDF)
   └── Extract text → LLM parses bullets → bge-small-en embeds each one → pgvector stores

2. Capture JD
   └── LLM extracts fields → bge-small-en embeds JD text → pgvector stores

3. Tailor CV
   └── Cosine similarity: JD embedding vs all bullet embeddings
       └── Top-K most relevant bullets retrieved
           └── LLM rewrites each bullet for this JD

4. Compile CV
   └── Accepted rewrites → injected into your .tex template → LaTeX output
```

No LangChain. No managed vector database. The retrieval is a raw SQL query using pgvector's `<=>` cosine distance operator. Every piece is visible and debuggable.

---

## Tech stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS + TypeScript |
| **Auth** | Custom bcrypt + JWT (no third-party auth library) |
| **Database** | PostgreSQL 16 + pgvector extension |
| **ORM** | Prisma |
| **Frontend** | Next.js 14 (App Router) + Tailwind CSS |
| **Local LLM** | Ollama — qwen2.5:3b (extraction, bullet parsing) |
| **Cloud LLM** | Anthropic Claude Haiku (rewriting, cover letters) |
| **Embeddings** | `@xenova/transformers` — bge-small-en-v1.5, 384 dims, runs in Node.js |
| **Monorepo** | pnpm workspaces |
| **Infrastructure** | Docker Compose (Postgres + pgvector) |

---

## Architecture

```
┌─────────────────────────────────────────────────────┐
│              Frontend (Next.js 14)                   │
│                                                     │
│  /          Login/signup                            │
│  /jds       Dashboard — stats, JD table, capture   │
│  /jds/:id   JD detail — analysis, rewrites, letter │
│  /cv        CV setup — PDF import, template upload  │
└──────────────────────┬──────────────────────────────┘
                       │ REST API
┌──────────────────────┴──────────────────────────────┐
│              Backend (NestJS)                        │
│                                                     │
│  AuthModule     — signup, login, JWT guard          │
│  JdsModule      — capture, analyze, rewrites,       │
│                   cover letters, versioning         │
│  BulletsModule  — list, embed, retrieve top-K,      │
│                   PDF upload, template upload,       │
│                   LaTeX compiler                    │
│  LlmModule      — Ollama provider, Claude provider, │
│                   embeddings, router, cost logging  │
│  PrismaModule   — database access                   │
└──────────────────────┬──────────────────────────────┘
                       │
┌──────────────────────┴──────────────────────────────┐
│         PostgreSQL 16 + pgvector                     │
│                                                     │
│  User, CVVariant, CVBullet (vector 384)             │
│  JobDescription (vector 384), Application           │
│  RewriteSet, RewriteItem, CoverLetterGeneration     │
│  LLMCall                                            │
└─────────────────────────────────────────────────────┘
```

---

## Key architectural decisions

**pgvector over Pinecone/Weaviate**
Self-hosted, no vendor lock-in, co-located with relational data. For <100K vectors the performance is identical. Eliminates a network hop and a separate service to manage.

**No LangChain**
Direct API calls to Ollama and Anthropic. 100 lines of custom router code that's fully transparent vs. a framework that hides prompt manipulation. Every prompt is a versioned string in the codebase.

**Local embeddings via Transformers.js**
`bge-small-en-v1.5` runs inside Node.js — no Python, no GPU, no API call per embedding, no cost. Fast and portable.

**Hybrid LLM routing**
Extraction tasks (structured JSON, keyword tagging) run on local Ollama — free, good enough for structured output. Quality-critical tasks (bullet rewriting, German cover letters) route to Claude Haiku (~2 cents per application). Falls back to Ollama if no API key is set.

**Custom auth**
bcrypt + JWT, no Clerk or Auth.js. Portfolio project — showing you understand auth matters more than using a library.

**Dynamic LaTeX template**
Users upload their own `.tex` file. The compiler parses the experience section, finds `\resumeSubheading` and `\resumeItem` patterns, and swaps in tailored bullets while preserving all formatting. No hardcoded template — works for any user's CV design.

**Max 3 versions per JD**
Rewrite sets and cover letters auto-cleanup to 3 versions. Prevents unbounded storage growth, keeps the UI simple, and covers the "compare last two attempts" use case.

---

## LLM observability

Every LLM call is logged to the `LLMCall` table:

| Field | Description |
|-------|-------------|
| `provider` | "ollama" or "anthropic" |
| `model` | Model name used |
| `taskType` | "extract_jd", "rewrite_bullet", "draft_letter", "extract_cv_bullets" |
| `inputTokens` | Tokens sent |
| `outputTokens` | Tokens received |
| `costCents` | Cost in cents (Ollama = 0) |
| `latencyMs` | End-to-end latency |
| `success` | Whether the call succeeded |

**Per-application cost on Claude Haiku:**
- JD extraction: ~$0.004
- 6 bullet rewrites: ~$0.011
- Cover letter: ~$0.006
- **Total: ~$0.02 per application**

$5 of API credit → ~250 full applications.

---

## Project structure

```
heuristic/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma       # 10 database models
│   │   │   └── seed.ts             # Seeds CV bullets with embeddings
│   │   └── src/
│   │       ├── auth/               # Signup, login, JWT
│   │       ├── bullets/
│   │       │   ├── bullets.module.ts   # List, retrieve, embed
│   │       │   ├── cv-upload.ts        # PDF → bullets pipeline
│   │       │   └── cv-compiler.ts      # LaTeX template compiler
│   │       ├── jds/
│   │       │   └── jds.module.ts       # Capture, analyze, rewrites, letters
│   │       ├── llm/
│   │       │   └── llm.module.ts       # Ollama, Claude, embeddings, router
│   │       └── prisma/
│   │           └── prisma.module.ts
│   └── web/
│       ├── app/
│       │   ├── page.tsx            # Login/signup
│       │   ├── jds/
│       │   │   ├── page.tsx        # Dashboard
│       │   │   └── [id]/page.tsx   # JD detail (orchestrator)
│       │   └── cv/
│       │       └── page.tsx        # CV setup
│       └── components/jd/
│           ├── JdHeader.tsx
│           ├── KeywordPanels.tsx
│           ├── Tabs.tsx
│           ├── RewritesTab.tsx
│           ├── RewriteCard.tsx
│           ├── CoverLetterTab.tsx
│           └── VersionSwitcher.tsx
├── docs/
│   ├── ARCHITECTURE.md
│   └── SAMPLE_JDS.md
└── docker-compose.yml
```

---

## Roadmap

- [x] v0.1 — Auth, JD capture, RAG retrieval, bullet rewrites
- [x] v0.2 — Cover letters (EN + DE), match scoring, keyword analysis, red flags
- [x] v0.3 — Persistence + versioning (max 3), status tracking, analytics dashboard
- [x] v0.4 — CV PDF import, dynamic LaTeX template compiler, plain text output
- [ ] v0.5 — Deployment (Hetzner VPS + Caddy + HTTPS + GitHub Actions CI/CD)
- [ ] v0.6 — Chrome extension (one-click JD capture from LinkedIn/StepStone/Indeed)
- [ ] v0.7 — Eval harness, Ollama vs Claude quality comparison, interview question generator

---

## License

MIT
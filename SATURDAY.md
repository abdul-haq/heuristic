# SATURDAY.md — Heuristic v0.1 playbook

Goal: by Sunday evening, you have Heuristic v0.1 running locally — you can sign up, paste a JD, see it parsed by Ollama, and get Claude-quality (or Ollama-quality if no API key yet) bullet rewrites against your CV.

Print this. Check off each box as you go. **Do not skip ahead. Do not expand scope.**

---

## Friday evening — 1 hour — setup the environment

This is the one-time setup. Get it out of the way Friday so Saturday is pure code.

- [ ] Open PowerShell as Administrator. Run: `wsl --install -d Ubuntu-22.04`
- [ ] Restart Windows.
- [ ] Open Ubuntu from Start menu. Pick a username + password. Wait for setup.
- [ ] Run inside Ubuntu:
  ```bash
  sudo apt update && sudo apt upgrade -y
  sudo apt install -y curl git build-essential
  ```
- [ ] Install Node 22 (we'll use nvm so future you can switch):
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  source ~/.bashrc
  nvm install 22
  nvm use 22
  node --version  # should be v22.x
  ```
- [ ] Install pnpm:
  ```bash
  npm install -g pnpm
  pnpm --version
  ```
- [ ] Install Docker Desktop for Windows from docker.com. In settings, enable "Use the WSL 2 based engine" and enable integration with your Ubuntu distro.
- [ ] Verify Docker works inside WSL:
  ```bash
  docker run hello-world
  ```
- [ ] Install Ollama inside Ubuntu:
  ```bash
  curl -fsSL https://ollama.com/install.sh | sh
  ollama --version
  ```
- [ ] Pull the small local model (this is ~2GB, do it Friday so it's ready):
  ```bash
  ollama pull qwen2.5:3b
  ollama list  # confirm it's there
  ```
- [ ] Install VS Code on Windows. Install the "WSL" extension. Open Ubuntu, run `code .` from a folder — it should open VS Code on Windows connected to WSL.
- [ ] Go to bed.

---

## Saturday morning — 9:00–12:00 — backend skeleton + database

### 9:00 — Set up the repo (30 min)

- [ ] Create a folder in WSL: `mkdir ~/projects && cd ~/projects`
- [ ] Copy all the scaffolded files I gave you into `~/projects/heuristic/`. Easiest path: I'll bundle them; you extract them here.
- [ ] `cd heuristic && pnpm install` — wait for it.
- [ ] Initialize git:
  ```bash
  git init
  git add .
  git commit -m "chore: initial scaffold"
  ```
- [ ] Create a public repo on GitHub called `heuristic`. Don't initialize with anything (no README, no .gitignore). Then:
  ```bash
  git remote add origin git@github.com:abdul-haq/heuristic.git
  git branch -M main
  git push -u origin main
  ```
  (If SSH isn't set up, use the HTTPS URL — same idea.)

### 9:30 — Start Postgres (15 min)

- [ ] `pnpm db:up` — Docker pulls pgvector image and starts Postgres on 5432.
- [ ] Verify: `docker ps` should show `heuristic-postgres` running.
- [ ] Copy `.env.example` to `.env` in `apps/api/`:
  ```bash
  cp apps/api/.env.example apps/api/.env
  ```
- [ ] Edit `apps/api/.env`, change `JWT_SECRET` to something random. Leave `ANTHROPIC_API_KEY` empty for now.

### 9:45 — Database schema + seed (1h)

- [ ] Run the migration (creates tables AND enables pgvector):
  ```bash
  pnpm db:migrate --name init
  ```
- [ ] Prisma will ask to apply 00_enable_pgvector first — say yes.
- [ ] If you hit "extension already exists" — that's fine, ignore.
- [ ] Seed your CV bullets:
  ```bash
  pnpm db:seed
  ```
- [ ] First seed run downloads bge-small-en-v1.5 (~30MB) — let it finish.
- [ ] Open Prisma Studio to confirm: `pnpm db:studio`. You should see your user and 14 bullets, each with an embedding. Close the browser tab when done.

### 10:45 — Run the API (1h)

- [ ] In one terminal:
  ```bash
  pnpm dev:api
  ```
- [ ] You should see: `Heuristic API running on http://localhost:3001/api`
- [ ] In another terminal, test auth:
  ```bash
  curl -X POST http://localhost:3001/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"email":"abdulhaq.dev@gmail.com","password":"changeme123"}'
  ```
- [ ] Should return `{"token":"eyJ...","user":{...}}`. Save the token in a shell variable:
  ```bash
  TOKEN="eyJ..."
  ```
- [ ] Test JD capture:
  ```bash
  curl -X POST http://localhost:3001/api/jds \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $TOKEN" \
    -d '{"rawText":"Looking for a Werkstudent Full-Stack dev with React, Node.js, PostgreSQL.","platform":"manual"}'
  ```
- [ ] This is slow on first run (Ollama loads the model). 30–90 seconds is normal. Subsequent calls are fast.
- [ ] Test rewrites:
  ```bash
  curl -X POST http://localhost:3001/api/jds/<JD_ID_FROM_PREVIOUS>/suggest-rewrites \
    -H "Authorization: Bearer $TOKEN"
  ```
- [ ] You should see your bullets paired with tailored rewrites.

🎉 **The backend works.** Commit:
```bash
git add . && git commit -m "feat: working v0.1 backend with auth, JD ingestion, RAG rewrites"
git push
```

### 12:00 — LUNCH BREAK. Eat real food. Not at your desk.

---

## Saturday afternoon — 13:00–18:00 — frontend

### 13:00 — Run the web app (30 min)

- [ ] New terminal: `pnpm dev:web`
- [ ] Open http://localhost:3000
- [ ] Log in with `abdulhaq.dev@gmail.com / changeme123`
- [ ] Land on `/jds`. Empty list.
- [ ] Paste sample JD #1 from `docs/SAMPLE_JDS.md` into the textarea. Click "Capture & analyze."
- [ ] Wait ~30s. Refresh. JD should appear.
- [ ] Click into it. See must-haves, nice-to-haves extracted. Click "Generate."
- [ ] Watch bullet rewrites appear (also slow on Ollama, faster later).
- [ ] Try sample JD #2 (German) and #3 (AI).

### 14:00 — Polish (3h)

The frontend is intentionally barebones. This block is yours to make it presentable. Pick from this list, in this order — do not jump ahead:

- [ ] Add a header bar with the Heuristic logo + sign out
- [ ] Show a loading skeleton while JDs are being captured (right now you just wait for refresh)
- [ ] Add a "delete JD" button
- [ ] Show the JD's German level requirement as a colored badge
- [ ] (Stretch) Add a stats strip on `/jds` showing total JDs, average must-haves, etc.

### 17:00 — Write the README properly (1h)

The README is *part of the portfolio*. Spend real time here:

- [ ] Open `README.md`. Replace the placeholder with:
  - One-paragraph product description
  - A "How it works" section with the RAG flow explained in 3 sentences
  - A screenshot of the dashboard (use Windows Snip & Sketch)
  - A screenshot of the JD detail view with rewrites
  - A "Tech decisions" section explaining why pgvector over Pinecone, why no LangChain, why hybrid Ollama+Claude
  - Setup instructions
- [ ] Commit and push.

### 18:00 — STOP. Done for the day.

---

## Sunday morning — 10:00–13:00 — quality + evaluation harness

This is what separates this project from any other AI portfolio piece.

### 10:00 — Build a tiny eval set (1.5h)

- [ ] Create `apps/api/evals/bullet-rewrite.json` with 5 cases:
  ```json
  [
    {
      "jd": "...",
      "originalBullet": "...",
      "shouldContainKeywords": ["postgresql", "rest"],
      "shouldNotExceedWords": 25,
      "shouldPreserveNumbers": ["15k", "500ms"]
    }
  ]
  ```
- [ ] Create `apps/api/evals/run.ts` — a script that loads each case, calls the LLM, and checks each constraint, printing a pass/fail per case.
- [ ] Run it: `pnpm tsx apps/api/evals/run.ts`
- [ ] If it passes 4/5, you're done. If not, iterate on the prompt in `jds.module.ts`.

### 11:30 — Anthropic API key (if you want) (30 min)

- [ ] Go to `console.anthropic.com`. Sign up. Add €5 credit (or use any free trial).
- [ ] Generate API key. Paste into `apps/api/.env` as `ANTHROPIC_API_KEY`.
- [ ] Restart the API.
- [ ] Re-run the eval. You should see scores go up.
- [ ] Add a note in the README: "When configured with Claude, eval scores improve from X to Y."

### 12:00 — Documentation polish (1h)

- [ ] Create `docs/ARCHITECTURE.md` with a simple diagram (ASCII or excalidraw): extension/web → API → (Postgres+pgvector, Ollama, Claude)
- [ ] Add a `docs/DECISIONS.md` listing 5 tech decisions and why
- [ ] Push everything

### 13:00 — STOP. v0.1 is shipped.

---

## Sunday afternoon — 14:00–17:00 — apply to jobs

Yes, with your *current* CV. The portfolio piece is real and on GitHub now, but it doesn't have screenshots in a polished form yet. Apply anyway. Add a line to your LinkedIn:

> "Currently building Heuristic — an open-source AI co-pilot for job applications with RAG over CV bullets and structured LLM extraction. github.com/abdul-haq/heuristic"

That one line in your LinkedIn `About` section gets attention.

- [ ] Open StepStone, LinkedIn, university career portal
- [ ] Find 8 Werkstudent roles you genuinely fit
- [ ] For each: send the best-matching CV variant + a short tailored cover letter
- [ ] Log each in a spreadsheet (or in Heuristic, even though analytics aren't built yet — just storing them works)

### 17:00 — REST. Time with your wife. You did it.

---

## What you have at the end of the weekend

- A working full-stack AI app on your laptop
- A public GitHub repo with real commits
- Real RAG, real embeddings, real prompt engineering, real eval harness
- A first batch of 8 applications out the door
- A story to tell in any interview that asks "what have you been working on"

This is more than 95% of bootcamp grads ship in 12 weeks. You did it in two days.

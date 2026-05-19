# KyaDekhe — क्या देखे

> Discover Hindi films and series you haven't seen — intelligently.

KyaDekhe is a Bollywood-first discovery app that goes beyond "you liked a thriller, here's another thriller." It understands **why** you'll love something: emotional weight, attention required, who you'll watch with, your nostalgia triggers, and more.

---

## What it is

- **Swipe to rate** — Tinder-style card stack. Swipe right (loved), left (skip), or up (save to Watch Next)
- **Mood-based discovery** — Sunday afternoon vibes, need to cry, NRI feelings, late-night solo watch
- **Natural language search** — "Like Dil Chahta Hai but grittier" — Claude parses it and finds matches
- **Personalized feed** — Era-filtered, platform-filtered, taste-cluster recommendations
- **Collections** — Save and organise titles into custom lists
- **Why KyaDekhe** — AI-generated explanation of why a specific title matches your taste

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Framework | Next.js 14 (App Router) |
| Auth + DB | Supabase (Postgres + RLS + SSR auth) |
| AI | Claude `claude-sonnet-4-6` via Anthropic SDK |
| Content source | TMDB API |
| Ratings enrichment | IMDb TSV datasets |
| UI | Tailwind CSS v3 + shadcn/ui (base-ui) |
| Animations | Framer Motion |
| Deployment | Vercel (planned) |

---

## Content scope

**V1 is Bollywood-first.** The ingest pipeline filters to:
- `original_language: hi` (Hindi)
- `origin_country: IN` (India)

South-Indian films with Hindi dub and international content will be added in later phases.

---

## Project structure

```
app/
  (app)/          # Protected routes (auth + onboarding gate)
    discover/     # Swipe-based discovery
    feed/         # Personalized recommendation feed
    mood/         # Mood-filtered browsing
    ask/          # Natural language query
    title/[id]/   # Title detail + personalised why
    collections/  # Saved lists
  api/
    recommendations/  # Multi-filter recommendation engine
    ask/              # Claude-powered NL search
    why/              # Taste-cluster explanation cache
    ratings/          # Rate a title + trigger taste vector recompute
    collections/      # CRUD for collections + items
    cron/             # Streaming availability refresh
  auth/             # Login, signup, OAuth callback
  onboarding/       # First-run taste profile
components/
  swipe-card/       # Framer Motion gesture card
  title-card/       # Poster + tags + streaming badges
  collection-picker/ # Bottom sheet for saving to list
  streaming-pills/  # Platform badges (Netflix, Prime, etc.)
  bottom-nav/       # Mobile bottom navigation
lib/
  recommender.ts    # Multi-stage filtering + taste-vector scoring
  taste-vector.ts   # Tag-weighted user taste profile
  claude.ts         # AI tagging + NL query + why-explanation
  tmdb.ts           # TMDB API client
  moods.ts          # Mood presets → tag filter maps
  supabase/         # Typed client, server, service clients
scripts/
  01-ingest-tmdb.ts      # Discover + upsert Bollywood titles from TMDB
  02-enrich-imdb.ts      # Enrich with IMDb ratings from TSV dump
  03-quality-gate.ts     # Filter low-quality entries
  04-streaming-sync.ts   # Sync streaming availability per region
  05-tag-with-claude.ts  # Batch AI tagging (emotional weight, era, etc.)
  06-seed-onboarding.ts  # Seed curated onboarding titles
supabase/
  schema.sql             # Full DB schema + RLS policies
```

---

## Database schema

9 tables with full RLS:

| Table | Purpose |
|-------|---------|
| `titles` | Core film/series catalogue |
| `title_tags` | AI-generated tag vectors (Claude) |
| `streaming_availability` | Platform × region × availability type |
| `users` | Profile, region, onboarding state |
| `ratings` | Per-user swipe ratings |
| `user_taste_vectors` | Computed tag-weight vectors |
| `collections` | User-created watchlists |
| `collection_items` | Titles in collections |
| `recommendation_log` | What was shown and what action was taken |
| `why_cache` | Cached AI explanations per title × taste cluster |

---

## Environment variables

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=
TMDB_API_KEY=
TMDB_READ_ACCESS_TOKEN=
```

---

## Running locally

```bash
# Install dependencies
npm install

# Start dev server
npm run dev
```

---

## Data pipeline (run once to populate the DB)

```bash
# 1. Ingest Bollywood titles from TMDB (~100-200 titles per run, resumable)
npm run ingest

# 2. Enrich with IMDb ratings (requires local IMDb TSV dump)
npm run enrich

# 3. Quality gate — removes low-vote-count entries
npm run gate

# 4. Sync streaming availability per region
npm run streaming

# 5. AI-tag titles with emotional weight, era, attention level, etc.
npm run tag

# 6. Seed onboarding titles (curated starter set)
npm run seed
```

---

## AI tag taxonomy

Each title gets tagged across 8 dimensions:

| Dimension | Example values |
|-----------|---------------|
| `emotional_weight` | featherlight, breezy, medium, heavy, devastating |
| `humour_style` | slapstick, dry wit, absurdist, dark comedy |
| `attention_required` | background-able, half-attentive, full focus required |
| `watch_with` | alone, with partner, with family, with parents |
| `era` | classic (pre-70s), 70s-80s masala, 90s blockbuster, 2000s multiplex, contemporary |
| `setting` | small town India, metro India, NRI/diaspora, rural India |
| `nostalgia_trigger` | high nostalgia value for Indian audience |
| `pacing` | slow burn, steady, fast-paced, frenetic |

---

## Roadmap

- [ ] Deploy to Vercel
- [ ] Apply Supabase schema migrations
- [ ] Run full TMDB ingest (all pages)
- [ ] Streaming availability for IN, CA, UK, US regions
- [ ] Push notifications for new titles
- [ ] Social features (share collections)
- [ ] South Indian films with Hindi dub (Phase 2)
- [ ] International cinema with Hindi dub (Phase 3)

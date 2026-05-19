# Papyrus Stability + Persistence Report
**Date:** 2026-05-18  
**Phase:** Stable Demo Environment  
**Build status:** ✅ Passing (`npm run build` — 0 errors, 0 warnings)

---

## Summary

All eight Codex directive priorities have been implemented. Papyrus now supports real Supabase authentication, cloud-persisted documents and job groups, structured logging across all API routes, in-memory rate limiting, and hardened file validation. The app remains fully functional in demo mode (no Supabase) with transparent localStorage fallback.

---

## Priority Completion Checklist

### ✅ Priority 1 — Real Authentication (Supabase Auth)
**Files:** `lib/supabase/client.ts`, `lib/supabase/server.ts`, `app/login/page.tsx`, `middleware.ts`

- `createBrowserClient` (client-side) and `createServerClient` (server-side/middleware) from `@supabase/ssr`
- `app/login/page.tsx` calls `supabase.auth.signInWithPassword()` when Supabase is configured; falls back to demo credential check otherwise
- `middleware.ts` validates JWTs server-side via `supabase.auth.getUser()` (never `getSession`) on every request
- `/workspace` protected — unauthenticated users redirected to `/login`
- `/login` redirects authenticated users straight to `/workspace`
- Logout flow: `supabase.auth.signOut()` in workspace page, then `router.push("/login")`
- Demo credentials (`papyrus@corello.ai` / `corello123`) still work in both modes

### ✅ Priority 2 — Cloud Persistence (Supabase Postgres)
**Files:** `lib/persistence.ts`, `supabase/schema.sql`

- `documents` table: mirrors `PapyrusDocument` — all fields, JSONB for `artifacts` and `chat_history`
- `job_groups` table: mirrors `JobGroup` — document IDs as text array
- Row Level Security: `auth.uid() = user_id` enforced for all CRUD on both tables
- `update_updated_at()` trigger keeps `updated_at` accurate
- `loadDocuments()` — loads from Supabase (or localStorage fallback), maps DB rows to `PapyrusDocument`
- `persistDocument()` — writes to localStorage immediately, then syncs to Supabase
- `persistUpdate()` — patches chat history + artifacts in both stores
- `persistDelete()` — removes from both stores
- `loadJobGroups()` / `persistJobGroups()` — full round-trip for job group state
- All Supabase ops wrapped in try/catch — failures log a warning and fall through to localStorage

### ✅ Priority 3 — Architecture Boundary
**Files:** `lib/persistence.ts`, `lib/supabase/client.ts`, `lib/supabase/server.ts`

- `isSupabaseConfigured` boolean exported from persistence layer — single source of truth
- Supabase client imported lazily inside `getClient()` via `require()` — prevents bundling errors when env vars are absent
- Clean module boundaries: workspace page calls persistence API, never touches Supabase directly
- `autoGroupDocument`, `getAllJobGroups`, `saveArtifact` re-exported from persistence for clean imports

### ✅ Priority 4 — Route Protection
**File:** `middleware.ts`

- Next.js middleware runs on every non-static request
- Supabase JWT validated server-side on every request (not just on login)
- matcher excludes: `api/`, `_next/static`, `_next/image`, `favicon.ico`, `.png`, `.svg`
- Pure passthrough when Supabase is not configured (demo mode unaffected)

### ✅ Priority 5 — Upload Robustness
**File:** `app/api/documents/upload/route.ts`

- **File size validation:** Hard cap at 20 MB; returns HTTP 413 with clear message
- **MIME type validation:** Allowlist (`application/pdf`, `image/*`); returns HTTP 415 for unsupported types
- **Rate limiting:** 20 uploads/minute per IP; returns HTTP 429 with `Retry-After` header
- `detectMimeType()` uses file extension as authoritative source (ignores potentially spoofed `Content-Type`)
- `requestId` (UUID) threaded through all log entries for distributed tracing

### ✅ Priority 6 — Observability (Structured Logging)
**File:** `lib/logger.ts` + all four API routes

- `createLogger(service)` factory — emits JSON lines: `{level, service, message, timestamp, ...data}`
- `console.error` for errors, `console.warn` for warnings, `console.log` for info/debug — compatible with Vercel log drains
- **upload route:** start, extraction method, page count, completion, errors all logged
- **chat route:** request received, stream complete, stream errors logged
- **vision route:** analysis started (with mimeType, hasQuestion, hasDocCtx), complete, errors logged
- **artifacts route:** generation started (with type + text length), complete (with content length), errors logged
- All log entries include `ip` (from `x-forwarded-for` / `x-real-ip`) for request attribution

### ✅ Priority 7 — Production Safety (Rate Limiting)
**File:** `lib/rate-limit.ts` + all four API routes

- Map-based in-memory store, auto-pruned every 5 minutes
- Per-route limits:
  - `upload`: 20 req/min per IP
  - `chat`: 60 req/min per IP
  - `vision`: 30 req/min per IP
  - `artifacts`: 30 req/min per IP
- All 429 responses include `Retry-After` header
- `getRequestId(request)` extracts real IP from `x-forwarded-for` or `x-real-ip`
- Resets per serverless instance (acceptable for prototype; upgrade to Upstash Redis for global limits)

### ✅ Priority 8 — Documentation
**Files:** `DEPLOY.md`, `.env.example`, `supabase/schema.sql`

- `DEPLOY.md` — updated with Supabase setup section (create project → run schema → configure auth → add env vars), updated env vars table, updated Known Limitations (removed stale entries), added production scaling roadmap
- `.env.example` — added `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` with comments
- `supabase/schema.sql` — complete schema with RLS policies, indexes, and setup instructions in comments

---

## New Files Created

| File | Purpose |
|---|---|
| `lib/supabase/client.ts` | Browser-side Supabase client (SSR-safe) |
| `lib/supabase/server.ts` | Server-side Supabase client (cookie-based) |
| `lib/logger.ts` | Structured JSON logging factory |
| `lib/rate-limit.ts` | In-memory per-IP rate limiter |
| `lib/persistence.ts` | Unified data layer (Supabase + localStorage) |
| `middleware.ts` | JWT-validated route protection |
| `supabase/schema.sql` | Postgres schema with RLS |

## Files Modified

| File | Changes |
|---|---|
| `app/workspace/page.tsx` | Added `useRouter`, Supabase persistence calls, logout handler, loading skeleton |
| `app/login/page.tsx` | Supabase `signInWithPassword` with demo fallback |
| `components/workspace/NavPanel.tsx` | Added `onLogout` prop, wired to logout button |
| `app/api/documents/upload/route.ts` | Rate limiting, MIME/size validation, structured logging |
| `app/api/chat/route.ts` | Rate limiting, input validation, structured logging |
| `app/api/vision/analyze/route.ts` | Rate limiting, structured logging |
| `app/api/artifacts/generate/route.ts` | Rate limiting, structured logging |
| `.env.example` | Added Supabase env vars |
| `DEPLOY.md` | Complete Supabase setup guide, updated limitations |

---

## Operational Modes

| Mode | Trigger | Auth | Persistence | AI |
|---|---|---|---|---|
| **Full production** | All env vars set | Supabase JWT | Supabase Postgres | Claude (real) |
| **Demo + persistence** | Supabase set, no Anthropic | Supabase JWT | Supabase Postgres | Mock responses |
| **Demo mode** | No Supabase, Anthropic set | Hardcoded credentials | localStorage | Claude (real) |
| **Local mock** | No env vars | Hardcoded credentials | localStorage | Mock responses |

All four modes work without code changes — environment variables drive behavior.

---

## Build Output

```
Route (app)
├ ○ /
├ ○ /_not-found
├ ƒ /api/artifacts/generate
├ ƒ /api/chat
├ ƒ /api/documents/upload
├ ƒ /api/vision/analyze
├ ○ /login
└ ○ /workspace

ƒ Proxy (Middleware)
○ (Static)   prerendered as static content
ƒ (Dynamic)  server-rendered on demand
```

TypeScript: 0 errors. Build time: ~1.6s compile + ~1.9s type check.

# Papyrus by Corello — Deployment Guide

## Demo Credentials
```
Email:    papyrus@corello.ai
Password: corello123
```

---

## PAPYRUS EXTERNAL DEPLOYMENT READY REPORT

### 1. Build Status

| Check | Status |
|---|---|
| `npm run lint` | ✅ 0 errors, 7 warnings (unused imports — safe) |
| TypeScript | ✅ 0 errors |
| `npm run build` | ✅ Clean — all routes compiled |
| `proxy.ts` (route protection) | ✅ Migrated from deprecated `middleware.ts` (Next.js 16 req.) |
| `.env.local` committed | ✅ No — covered by `.env*` in `.gitignore` |
| `.env.example` present | ✅ Yes |

Build output:
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
```

---

### 2. Files Changed (this session)

| File | Change |
|---|---|
| `proxy.ts` | NEW — route protection (Next.js 16 replaces `middleware.ts`) |
| `middleware.ts` | DELETED — deprecated in Next.js 16 |
| `app/workspace/page.tsx` | Fixed function ordering bug; switched `fileUrlsRef` → state |
| `lib/language-context.tsx` | Fixed setState-in-effect → lazy `useState` initializer |
| `components/workspace/NavPanel.tsx` | Fixed unused-expression lint error |
| `components/workspace/AICopilot.tsx` | Fixed React Compiler lint errors |
| `components/workspace/CameraModal.tsx` | Fixed unescaped entities + React Compiler lint |
| `components/workspace/DriveConnectModal.tsx` | Fixed `any` lint + unescaped entity |

---

### 3. GitHub Commands

**This is a new repo** (1 local commit, no remote). Run these in order:

**Step 1** — Create a new repo at [github.com/new](https://github.com/new):
- Name: `papyrus` (or your preferred name)
- Visibility: Private (recommended — API keys go in Vercel, not here)
- Do **NOT** initialize with README/gitignore (you already have one)

**Step 2** — Push from your machine:
```bash
cd "/Users/carlos/Desktop/Papyrus by Corello/Dev/papyrus"

git add .
git commit -m "Papyrus external demo deployment"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/papyrus.git
git push -u origin main
```

Replace `YOUR_USERNAME` with your actual GitHub username.

**For all future deploys**, just:
```bash
git add .
git commit -m "your message"
git push
```
Vercel auto-deploys on every push to `main`.

---

### 4. Vercel Steps

1. Go to **[vercel.com/new](https://vercel.com/new)**
2. Click **"Import Git Repository"** → select your `papyrus` repo
3. Framework: **Next.js** (auto-detected)
4. Root Directory: `/` (leave as default)
5. Click **"Deploy"** — the first deploy will fail until you add env vars (see Step 5)
6. After the first deploy completes (even if it fails), go to:
   `Vercel → Your Project → Settings → Environment Variables`
7. Add the variables from Section 5 below
8. Go to **Deployments → Latest → ⋯ → Redeploy**
9. ✅ Your app is live

---

### 5. Environment Variables to Paste into Vercel

Go to: `Settings → Environment Variables` → set for **Production, Preview, Development**

**Required — AI features:**
```
ANTHROPIC_API_KEY = sk-ant-YOUR_KEY_HERE
```
Get yours at [console.anthropic.com](https://console.anthropic.com).

**Optional — Branding:**
```
NEXT_PUBLIC_APP_NAME = Papyrus
NEXT_PUBLIC_COMPANY  = Corello
```

**Optional — Real auth + cloud persistence (Supabase):**
```
NEXT_PUBLIC_SUPABASE_URL      = https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```
> Without Supabase: app runs in demo mode (localStorage). Users share the same demo account.  
> With Supabase: real per-user accounts + documents persist to Postgres.

---

### 6. Expected Public URL Format

After deployment:
```
https://papyrus-[hash].vercel.app
```
Example: `https://papyrus-abc123.vercel.app`

To find your URL:
- Vercel Dashboard → Your Project → **Domains** tab
- Or top of the Deployments page

To add a custom domain (e.g. `papyrus.corello.ai`):
- Vercel → Project → Settings → **Domains** → Add Domain
- Add a CNAME record at your DNS provider pointing to `cname.vercel-dns.com`

---

### 7. Final Test Checklist (Before Sharing)

Run through this after Vercel deployment is live:

- [ ] **Login page loads** — visit your Vercel URL
- [ ] **Demo login works** — `papyrus@corello.ai` / `corello123`
- [ ] **Onboarding tour appears** — should show on first login
- [ ] **Upload a PDF** — drag or click "Scan New Traveler"
- [ ] **AI field extraction runs** — metadata panel fills in
- [ ] **Chat works** — type a question, get a response
- [ ] **Artifact generation works** — click "Traveler Summary"
- [ ] **Camera capture works** — requires HTTPS ✓ (Vercel provides this)
- [ ] **Microphone works** — click mic icon in chat
- [ ] **Language switcher works** — try ES/FR/PT at bottom of nav
- [ ] **Logout works** — click logout in nav footer

---

### 8. Known Limitations

| Limitation | Impact | Notes |
|---|---|---|
| **Demo mode auth** | All users share one login | Add Supabase for real per-user accounts |
| **20 MB upload cap** | Very large PDFs fail | Compress before upload |
| **60s Vercel Hobby timeout** | Long Claude extractions may time out | Upgrade to Vercel Pro ($20/mo) for 300s timeouts |
| **In-memory rate limits** | Reset on cold start | Fine for prototype |
| **No file storage** | Original files only in-session | Add Vercel Blob for persistent originals |
| **Single Anthropic key** | All users share quota | Fine for prototype |

---

## Supabase Setup (Optional — for real auth)

Only needed if you want per-user accounts and persistent cloud storage.

### 1. Create a Supabase project
1. Go to **[supabase.com](https://supabase.com)** → New project
2. Note your **Project URL** and **anon key** from Settings → API

### 2. Run the database schema
1. Supabase → **SQL Editor** → paste and run `supabase/schema.sql`

### 3. Configure authentication
1. **Authentication → Providers → Email** → enable **Email/Password**
2. **Authentication → Settings** → disable **"Confirm email"**
3. **Authentication → Users → Add User**:
   - Email: `papyrus@corello.ai` / Password: `corello123`

### 4. Add to Vercel
Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel env vars → Redeploy.

---

## How to Redeploy

Every `git push` to `main` triggers a new Vercel deployment automatically.

Manual redeploy:
```
Vercel Dashboard → Deployments → Latest → ⋯ → Redeploy
```

---

## Required Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `ANTHROPIC_API_KEY` | **Yes** | Powers all AI features |
| `NEXT_PUBLIC_SUPABASE_URL` | No* | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | No* | Supabase anon key |
| `NEXT_PUBLIC_APP_NAME` | No | Defaults to "Papyrus" |
| `NEXT_PUBLIC_COMPANY` | No | Defaults to "Corello" |

*Both Supabase vars must be set together, or neither.

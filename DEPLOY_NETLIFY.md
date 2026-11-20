# SpeakUp AI – Netlify & Supabase Deployment Guide

## 1. Local Installation & Development

```bash
npm install
npm run dev
```

The development server runs on `http://localhost:3000`.

---

## 2. Supabase Database & Auth Setup

1. Create a new project at [supabase.com](https://supabase.com).
2. Open **SQL Editor** in your Supabase Dashboard.
3. Paste the entire contents of `supabase/schema.sql` and click **Run**.
4. Go to **Project Settings → API** and copy:
   - **Project URL** (`VITE_SUPABASE_URL`)
   - **anon public key** (`VITE_SUPABASE_ANON_KEY`)
   - **service_role secret key** (`SUPABASE_SERVICE_ROLE_KEY`, server-only)
5. Under **Authentication → Providers**, enable **Email** and/or **Google**.

---

## 3. Netlify Deployment Steps

### Option A: Deploy via Netlify CLI

```bash
# Install Netlify CLI globally
npm install -g netlify-cli

# Login to Netlify
netlify login

# Initialize your Netlify site
netlify init

# Set secure server-side environment variables
netlify env:set GEMINI_API_KEY "your-gemini-api-key"
netlify env:set VITE_SUPABASE_URL "https://your-project.supabase.co"
netlify env:set VITE_SUPABASE_ANON_KEY "your-supabase-anon-key"
netlify env:set SUPABASE_SERVICE_ROLE_KEY "your-supabase-service-role-key"

# Build and deploy to production
npm run build
netlify deploy --prod
```

### Option B: Deploy via GitHub + Netlify Dashboard

1. Push this repository to GitHub.
2. In Netlify, click **Add new site → Import an existing project**.
3. Netlify automatically reads `netlify.toml`:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
   - **Functions directory:** `netlify/functions`
4. Open **Site configuration → Environment variables** and add:
   - `GEMINI_API_KEY` (required for `netlify/functions/ai-speakup.ts`)
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
5. Click **Trigger deploy → Deploy site**.

---

## 4. Security & Routing Verification

- `GEMINI_API_KEY` is used **only** inside `server.ts` and `netlify/functions/ai-speakup.ts` and is never bundled into frontend JavaScript.
- `netlify.toml` maps `/api/*` to `/.netlify/functions/ai-speakup/:splat` and `/*` to `/index.html` (`status = 200`), preventing 404 errors on page refresh.

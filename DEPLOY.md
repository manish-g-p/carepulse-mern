# Deploying CarePulse for free

This deploys a **live, clickable** CarePulse:

- **Frontend** (React/Vite) on **Vercel** — free, always on.
- **Backend** (all services combined into one process, `backend/combined-server.js`)
  on **Render**'s free web tier — talks to your existing free **MongoDB Atlas**.
- **On-device AI** (whisper transcription, speaker diarization, NLLB translation)
  is **not** part of the hosted demo — it needs far more RAM than a free host
  gives (NLLB alone wants ~2.5 GB; free tiers give 512 MB). Those features run in
  the local Docker stack (`docker compose up`). The hosted app shows a short
  "Demo mode" banner saying exactly this.

Everything else works live: doctor register/login, patients, sessions & records,
the patient portal (invite → activate → view transcripts), medication reminders,
the admin dashboard, and the audit log.

> **What you have to do yourself:** create the Vercel and Render accounts and click
> "deploy" — I can't create accounts or sign in for you. Every config file and
> command you need is here; follow it top to bottom.

---

## 0. Before you start

- The repo is already on GitHub (`main`). Vercel and Render both deploy straight
  from it.
- You already have a **MongoDB Atlas** free cluster (the app uses it today).
- Generate two fresh secrets for the demo (don't reuse the ones in your local
  `.env` if you'd rather keep them private):

  ```bash
  # JWT_SECRET
  node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
  # AUDIO_ENCRYPTION_KEY (must be exactly 64 hex chars)
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

- **Atlas network access:** Render's free instances have changing outbound IPs, so
  in Atlas → **Network Access**, add `0.0.0.0/0` (allow from anywhere). Without
  this, the backend can't reach your database. (On a paid Render plan you'd allow
  its fixed egress IPs instead.)

---

## 1. Backend → Render

1. Sign in to <https://render.com> with your GitHub account.
2. **New +** → **Blueprint**, pick this repo. Render reads [`render.yaml`](render.yaml)
   and proposes a service named `carepulse-api` (root `backend`, `npm ci` /
   `npm start`, free plan, health check `/api/health`).
3. It will ask you to fill the secret env vars (they're intentionally **not** in
   the repo). Set:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas connection string (`mongodb+srv://…`) |
   | `JWT_SECRET` | the 96-char hex you generated |
   | `ADMIN_PASSKEY` | an admin passkey for the demo (e.g. a 6-digit number) |
   | `AUDIO_ENCRYPTION_KEY` | the 64-char hex you generated |
   | `CLIENT_ORIGIN` | leave blank for now — you'll set it in step 3 |
   | `COMBINED_DB` | `carepulse` (already defaulted in the blueprint) |

4. Deploy. When it's live, copy the URL, e.g. `https://carepulse-api.onrender.com`.
   Check `https://carepulse-api.onrender.com/api/health` returns
   `{"status":"ok",...}`.

> The demo starts with an **empty** `carepulse` database (separate from your
> real per-service DBs), so register a fresh doctor in the deployed app. Your
> real recordings are never exposed by the demo.

---

## 2. Frontend → Vercel

1. Sign in to <https://vercel.com> with GitHub, **Add New… → Project**, import the
   repo.
2. Set **Root Directory** to `frontend`. Vercel auto-detects Vite
   (build `npm run build`, output `dist`). [`frontend/vercel.json`](frontend/vercel.json)
   already handles SPA routing so deep links / refreshes don't 404.
3. Add environment variables:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | `https://carepulse-api.onrender.com/api` (your Render URL + `/api`) |
   | `VITE_DEMO_MODE` | `true` |

4. Deploy. Copy the URL, e.g. `https://carepulse.vercel.app`.

---

## 3. Connect the two (CORS)

1. Back in Render → your service → **Environment**, set `CLIENT_ORIGIN` to your
   Vercel URL (e.g. `https://carepulse.vercel.app`) and save. Render redeploys.
2. Open the Vercel URL, register a doctor, and confirm you can log in and create a
   patient. Done — that link is your live demo.

---

## Good to know (free-tier realities)

- **Cold starts:** the free Render backend sleeps after ~15 min idle; the first
  request then takes ~30–60 s to wake. Normal for a free demo — just wait.
- **Ephemeral disk:** uploaded files (ID docs, and any audio) don't survive a
  restart on free hosting. Fine for a demo; a persistent object store (e.g. a
  free S3-compatible bucket) would be the next step.
- **The AI features** (record → transcript → diarization → translation) only run
  in the local stack. To show them off, clone the repo and:

  ```bash
  cd mern
  docker compose --profile containers up -d   # gateway + services + speech worker
  npm --prefix backend run worker             # (or the containerized worker)
  # NLLB translate server for translation (optional): see backend/pyservices
  ```

  See the main README / `ARCHITECTURE.md` for the full local setup.

## Why "combined" for hosting but split locally?

Locally and in Docker, CarePulse runs as four independent services
(auth / patient / conversation / notification), each with its own database,
behind an nginx gateway — that's the real, scalable architecture. A single free
instance can't host four always-on services, so `backend/combined-server.js`
mounts all of their routes in **one** process against **one** database. Same
route code, same models, same JWTs — only the composition differs. It's a
deliberate hosting trade-off, not a rewrite.

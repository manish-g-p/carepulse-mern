# Deploying CarePulse for free

This deploys a **live, clickable** CarePulse (currently running at
**<https://carepulse-mern.vercel.app>**):

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
> "deploy" — nobody can create accounts or sign in for you. Every config file and
> command you need is here; follow it top to bottom, in order.

**Why the order matters:** the frontend and backend each need the other's URL. So
you deploy the **backend first** (get its URL), build the **frontend** pointing at
it, then come back and give the backend the **frontend's** URL for CORS. Don't skip
ahead.

---

## Step 0 — Gather your secrets (before touching any website)

You'll paste four secret values into Render. Open `backend/.env` and copy these:

- `MONGO_URI` — your full Atlas string (`mongodb+srv://…`)
- `JWT_SECRET`
- `AUDIO_ENCRYPTION_KEY` (must be exactly 64 hex characters)
- `ADMIN_PASSKEY`

Reusing the existing values is fine — the demo uses a **separate empty database**
(`carepulse`), so there's no conflict with your local per-service DBs. Prefer fresh
ones? Generate with:

```bash
# JWT_SECRET
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
# AUDIO_ENCRYPTION_KEY (exactly 64 hex chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> **`ADMIN_PASSKEY` is shareable-or-not, your call.** The demo is public; if you want
> someone to try the admin dashboard, you'll hand them this passkey — pick a
> throwaway value, or keep it private and demo admin yourself.

---

## Step 1 — Atlas: open network access

Render's free instances get **changing** outbound IPs, so you must allow all IPs.
Credentials still protect the DB — this only permits connection *attempts*.

1. <https://cloud.mongodb.com> → sign in.
2. Left sidebar → **Network Access** (under "Security").
3. **+ ADD IP ADDRESS** → **ALLOW ACCESS FROM ANYWHERE** (fills in `0.0.0.0/0`) → **Confirm**.
4. Wait until the entry's status goes from *Pending* to **Active** (~1 min).

This is the #1 cause of "can't connect to the database" later, so do it first.

---

## Step 2 — Render: deploy the backend

1. <https://render.com> → **Sign in with GitHub**, authorize it to see the repo.
2. Top-right **New +** → **Blueprint**.
3. **Connect** the `carepulse-mern` repo. Render finds [`render.yaml`](render.yaml)
   and proposes a service named **carepulse-api**.
4. It prompts for the env vars marked `sync: false` (not stored in the repo). Enter:

   | Key | Value |
   |---|---|
   | `MONGO_URI` | your Atlas string from Step 0 |
   | `JWT_SECRET` | from Step 0 |
   | `ADMIN_PASSKEY` | your chosen passkey |
   | `AUDIO_ENCRYPTION_KEY` | the 64-hex value from Step 0 |
   | `CLIENT_ORIGIN` | **leave blank for now** — set in Step 4 |

   (`COMBINED_DB` is already `carepulse` from the blueprint — leave it.)
5. **Apply**. Render clones → `npm ci` → `npm start`. This first sync lands you on the
   **Blueprint** page; when it shows a green **"Create web service carepulse-api"**,
   click that link (or left sidebar **Resources → carepulse-api**) to open the actual
   **service** page.
6. On the service page, confirm the **status pill** (under the name) says **"Live"**
   (green). Watch the **Logs** tab for success:
   ```
   [combined-server] listening on 10000 (db: carepulse)
   MongoDB connected: …/carepulse
   ```
   (Render injects its own port; the number won't be 5000 — that's expected.)
7. Copy the URL at the top of the service page. **Render often appends a random
   suffix** if the plain name is taken, e.g. `https://carepulse-api-bs04.onrender.com`.
   That full string is your backend base URL.

**Test it:** open `https://<your-service>.onrender.com/api/health` in a browser tab.
You want:
```json
{"status":"ok","service":"combined","db":"carepulse"}
```
Two things that look like errors but aren't:
- Opening the **root** URL (no `/api/health`) returns `{"message":"Not found"}` — normal,
  there's no page at `/`, only API routes. It still confirms the server is up.
- The **first** request after a deploy/idle can spin for ~30–60s (free-tier cold
  start). Wait; refresh once if needed.

> ⚠️ **If the status is stuck failing / red in Logs:** almost always a missing or wrong
> `MONGO_URI` (the server exits if it can't reach Mongo), or Atlas didn't get
> `0.0.0.0/0` (Step 1). Fix in **Environment** → **Save Changes** (auto-redeploys).

> The demo starts with an **empty** `carepulse` database (separate from your real
> per-service DBs), so register a fresh doctor in the deployed app. Your real
> recordings are never exposed by the demo.

---

## Step 3 — Vercel: deploy the frontend

**Critical:** Vite bakes `VITE_*` env vars in at **build time**, so set them *before*
the first build (or redeploy after).

1. <https://vercel.com> → **Continue with GitHub**.
2. **Add New… → Project** → **Import** the `carepulse-mern` repo.
3. On the configure screen:
   - **Root Directory:** click **Edit** → set to **`frontend`**. *(Essential — the repo
     root isn't the frontend.)*
   - Framework auto-detects **Vite**; leave build command / output as-is.
     [`frontend/vercel.json`](frontend/vercel.json) already handles SPA routing so deep
     links / refreshes don't 404.
4. Expand **Environment Variables** and add **both, before deploying**:

   | Key | Value |
   |---|---|
   | `VITE_API_URL` | your Render URL **+ `/api`**, e.g. `https://carepulse-api-bs04.onrender.com/api` |
   | `VITE_DEMO_MODE` | `true` |

   Double-check `VITE_API_URL` ends in `/api` with **no trailing slash** after it.
5. **Deploy** (~1–2 min). Copy the resulting URL, e.g. `https://carepulse-mern.vercel.app`.

---

## Step 4 — Connect them (CORS)

The backend won't accept browser calls from the frontend until it knows its origin.

1. **Render** → `carepulse-api` → **Environment** tab.
2. Set **`CLIENT_ORIGIN`** to your **exact** Vercel origin — scheme + host, **no path,
   no trailing slash**:
   ```
   https://carepulse-mern.vercel.app
   ```
   > ⚠️ **The trailing slash is the #1 silent failure here.** The browser sends its
   > origin as `https://carepulse-mern.vercel.app` (no `/`), and CORS matching is exact.
   > If you paste `…app/`, every request is blocked.
3. **Save Changes.** Render redeploys (~1–2 min). Wait for **Live**.

---

## Step 5 — Verify end-to-end

1. Open your Vercel URL.
2. Go to `/doctor/register`, open **DevTools → Network**, and register a test doctor.
3. Success = the register request returns **201** and you land on the doctor dashboard
   ("Welcome back 👋"). Create a patient to confirm the write path.
4. Visit `/doctor/conversation` — you should see the yellow **"Demo mode"** banner.

### Troubleshooting (the four things that actually go wrong)

| Symptom | Cause → Fix |
|---|---|
| Register/login fails with a **CORS error** in the console | `CLIENT_ORIGIN` doesn't exactly match the Vercel origin — remove any trailing slash, match `https://…` exactly, re-save on Render. |
| First request hangs ~30–60s, then works | Render free **cold start** after idle. Normal — wait. |
| **500** on register, or Logs show a Mongo/`querySrv` error | Atlas missing `0.0.0.0/0` (Step 1), or a wrong/unescaped-password `MONGO_URI`. |
| Frontend calls go to **`localhost:8080`** instead of Render | `VITE_API_URL` wasn't set at build time → set it in Vercel, then **Deployments → ⋯ → Redeploy**. |

---

## Good to know (free-tier realities)

- **Cold starts:** the free Render backend sleeps after ~15 min idle; the first request
  then takes ~30–60s to wake.
- **Ephemeral disk:** uploaded files (ID docs, any audio) don't survive a restart on
  free hosting. Fine for a demo; a persistent object store (e.g. a free S3-compatible
  bucket) is the next step.
- **The AI features** (record → transcript → diarization → translation) only run in the
  local stack. To show them off, clone the repo and:

  ```bash
  cd mern
  docker compose --profile containers up -d   # gateway + services + speech worker
  # NLLB translate server for translation (optional): see backend/pyservices
  ```

  See the main README / `ARCHITECTURE.md` for the full local setup.

## Why "combined" for hosting but split locally?

Locally and in Docker, CarePulse runs as four independent services
(auth / patient / conversation / notification), each with its own database, behind an
nginx gateway — that's the real, scalable architecture. A single free instance can't
host four always-on services, so `backend/combined-server.js` mounts all of their
routes in **one** process against **one** database. Same route code, same models, same
JWTs — only the composition differs. It's a deliberate hosting trade-off, not a rewrite.

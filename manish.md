# CarePulse — The Complete Project Record (Day 1 → Day 33)

One document, everything: what this project is, what it does, how it's built,
the full day-by-day history, how to run it, and every hard-won lesson.
(Secrets live only in `backend/.env`, which is gitignored — none appear here.)

- **Repo:** https://github.com/manish-g-p/carepulse-mern (public, branch `main`)
- **Live app (24/7):** https://carepulse-mern.vercel.app
- **Live API:** https://carepulse-api-ismz.onrender.com
- **Local path:** `D:\healthcare-main\healthcare-main\mern`

---

## 1. What is this project?

**CarePulse** is a **doctor↔patient consultation recorder**. A doctor records a
consented conversation; CarePulse turns the raw audio into a **structured,
searchable, translated clinical record** — automatically, using **only free,
self-hosted, open-source AI** (no paid APIs, ever).

It began as an ordinary MERN patient/appointment app and grew, in small
daily-commit increments, into a **four-microservice system** behind an nginx
gateway, with a RabbitMQ speech worker, real-time transcription, and PHI-grade
security.

### Project rules (held throughout)
- **$0 budget** — free/self-hosted/open-source only.
- **Honest git history** — "Day N" is a work-unit label, not a calendar claim.
  Real timestamps, no backdating.
- **AI assists, never decides** — key items and reminders are *suggestions* the
  doctor confirms.
- Honest claims: the project **integrates and self-hosts pre-trained
  open-source models** (Whisper, pyannote, NLLB) — it does not train models.

---

## 2. What does it do, exactly?

```
consent gate → record → live transcript (WebSocket) → speaker diarization
→ role labels → key items → Excel export → translation → encrypted storage + audit
```

1. **Consent gate** — recording cannot start without explicit, timestamped
   consent (enforced server-side).
2. **Record** — browser mic capture (`MediaRecorder`).
3. **Live transcript** — text appears *while talking*, streamed over a
   **WebSocket** (HTTP-polling fallback). Transcription is incremental — only
   audio past a committed offset is reprocessed, so a pass costs the same at
   minute 1 or minute 60.
4. **Speaker diarization** — separates **2–4 speakers**, incl. a **"patient
   party"** (family member in the room), via neural **pyannote.audio** with
   MFCC clustering as a zero-setup fallback.
5. **Role labels** — `Speaker 1/2/3` → **Doctor / Patient / Patient Party**;
   doctor can relabel inline.
6. **Key items** — medications, dosage/timing, symptoms as chips + inline
   highlights (word-boundary keyword/regex; doctor confirms).
7. **Excel export** — timestamped, role-labelled `.xlsx`.
8. **Translation** — **18 languages, any→any, source auto-detected** from the
   speech (English, Hindi, Kannada, Tamil, Telugu, Malayalam, Marathi,
   Bengali, Gujarati, Punjabi, Urdu, Spanish, French, German, Arabic, Russian,
   Chinese, Japanese) — as text, spoken aloud (Web Speech), and live.
9. **Patient portal** — doctor issues a signed invite link; patient sets a
   password; **read-only** access to their own transcripts + Excel.
10. **Medication reminders** — suggested from key items (frequency → dose
    times, "for N days" → end date); doctor confirms; patient dashboard shows
    them with a "due today" badge.
11. **Security (PHI-grade, still free):**
    - **AES-256-GCM at rest** for audio **and** transcript text (field-level)
    - **RBAC** (`admin` / `doctor` / `patient`) via JWT
    - **Append-only audit log** + admin view across all doctors
    - **5-minute signed download URLs** (session+kind-scoped)
    - Right-to-delete + opt-in retention windows (`RETENTION_DAYS`)

---

## 3. Architecture

```
browser → nginx gateway :8080 ─ /api/auth/*         → auth-service :5001         (carepulse_auth)
                              ─ /api/conversations* → conversation-service :5003 (carepulse_conversations)
                              ─ /api/reminders      → notification-service :5004 (carepulse_notifications)
                              ─ /api/* + /uploads/* → patient-service :5002      (carepulse_patients)
                              ─ /                   → frontend HOST :5173 (Vite)
conversation-service → RabbitMQ :5672 → speech worker (whisper + pyannote)
conversation-service → NLLB translate server HOST :5555
```

- **JWT (shared secret) is the ONLY thing crossing service boundaries** —
  services never query each other's databases. The portal invite is a
  doctor-triggered signed JWT from the patient service; the auth service only
  verifies the signature.
- **Graceful degradation everywhere:** broker down → in-process speech;
  translate server down → UI hides; pyannote fails → MFCC fallback.
- **Hosted (free) mode:** `backend/combined-server.js` mounts all four
  services' routes in ONE process against ONE db (`carepulse`) so it fits a
  single free Render instance — same code, different composition.

**Entrypoints (`backend/`):** `auth-server.js` · `patient-server.js` ·
`conversation-server.js` · `notification-server.js` · `worker.js` ·
`combined-server.js` (shared bootstrap `config/createService.js` with an
`onServer` hook for the live WebSocket).

### Tech stack (every AI piece free + self-hosted)

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, React Router, React Hook Form + Zod, Tailwind, Axios |
| Backend | Node.js, Express, Mongoose (Atlas free M0), `ws`, Multer |
| Speech-to-text | **whisper.cpp**, `small` model, 8 threads |
| Diarization | **pyannote.audio** (neural) → MFCC clustering fallback |
| Translation | **NLLB-200** distilled 600M (local Flask server, 18 languages any→any) |
| Async / infra | RabbitMQ, nginx gateway, Docker Compose |
| Crypto | AES-256-GCM for audio + transcript text at rest |
| Hosting | Vercel + Render + Atlas (free) · Cloudflare quick tunnel for full-AI demos |

---

## 4. The complete day-by-day ledger

| Day | Commit | What was built |
|---|---|---|
| 0 | `dc6d205` | Doctor auth (model, register/login, JWT middleware) |
| 1 | `6b2aa5a` | ConversationSession model, start/stop endpoints, page shell |
| 2 | `392a122` | Browser audio capture + upload + playback |
| 3 | `b902106` | whisper.cpp transcription (prebuilt binaries — no compiler on this machine) |
| 4 | `4c44d90` | MFCC-clustering diarization (librosa + scikit-learn) |
| 5 | `d6f7330` | Speaker → role labels, inline relabeling |
| 6 | `a022038` | Excel export (exceljs), ownership-checked download |
| 7 | `486b25d` | Consent gate + append-only AuditLog |
| 8 | `69870c7` | AES-256-GCM audio encryption (+ fixed leaked credentials, rotated) |
| 9 | `47ed6d4` | Doctor dashboard |
| 10 | `7c1ef0b` | Translation with Kannada — NLLB (LibreTranslate lacked Kannada) |
| 11 | `850b9fc` | Key items (medications/timings/symptoms) |
| 12 | `ef4d6ec` | Audit viewer |
| 13 | `a3df42f` | Right-to-delete (session + audio + audit) |
| 14 | `d9b0879` | Inline key-item highlighting |
| 15 | `4e77acd` | Multi-speaker (2–4, patient party) |
| 16 | `c41ba41` | Spoken translation (Web Speech) |
| 17 | `8334cd0` | Live transcript (5s HTTP poll) |
| 18 | `cb30f41` | Incremental live (committed offset + revisable tail) |
| 19 | `67de9b3` | Live translation |
| 20 | `6531172` | Speech worker + RabbitMQ + nginx gateway |
| 21 | `447d980` | Per-domain services + per-service databases; monolith deleted |
| 22 | `9769736` | Containerized speech worker (Linux whisper/ffmpeg/python image) |
| 23 | `34bcb44` | Containerized API services — full compose topology, container-DNS gateway |
| 24 | `c9bb6c6` | Patient portal (signed invite → activate → read-only own transcripts) |
| 25 | `3ce159a` | WebSocket live transcript (first-message JWT auth; poll = fallback) |
| 26 | `a0bbcde` | Notification service (4th microservice) — medication reminders; fixed word-boundary bug in key-item extraction |
| 27 | `098efb0` | Retention windows (opt-in, per-service ownership, verified on an isolated test DB) |
| 28 | `756675f` | Signed short-lived download URLs (5-min, session+kind pinned) |
| 29 | `ee2ee9d` | Field-level transcript encryption (mongoose getters/setters; idempotent migration with backup) |
| 30 | `8d96207` | Audit-log admin view (+ one-role-per-browser login fix) |
| — | `23e209c` | Free deployment: combined server + Render/Vercel configs |
| — | `095c6a1` `8bf5af1` | DEPLOY.md walkthrough · README rewritten to reflect the real system |
| — | `c4686c0` | Hugging Face Space files (now historical — HF made compute Spaces paid) |
| — | `cd30a90` | `start-demo.bat` + Cloudflare-tunnel support (public full-AI demo, $0, no card) |
| 31 | `b1efebf` | **Neural diarization (pyannote.audio)** — real-conversation accuracy; MFCC fallback kept |
| 32 | `c58dd33` | **Whisper `small` default** — drug names fixed (measured A/B: meds extracted 0/3 → 2/3) |
| 33 | `346fa26` | **8-thread whisper (~25% faster) + auto-detected any-to-any translation (3 → 18 languages, zero extra download)** |
| 34 | `27866cb` | **Health Records module** — doctor directory, documents (Cloudinary/local), visits, appointment email reminders (daily 9 AM), AI pharmacy assistant (Gemini + openFDA), overview dashboard, profile management |
| — | `a37eeb2` | CDN cache purge on Cloudinary document delete (`invalidate: true`) |

**Verification discipline:** every day was verified end-to-end (usually through
the gateway with synthetic multi-voice clips), test data was prefix-tagged and
cleaned from the DBs afterward, and failures were reported with evidence.

**Repo history note:** the repository was recreated on 2026-07-17 (fresh push
of the identical clean history) — all commits authored by
`Manisha G P <147315037+manish-g-p@users.noreply.github.com>`.

---

## 5. Current state — everything works

- ✅ Transcription (whisper `small`, 8 threads), verified E2E
- ✅ Diarization: doctor / patient / patient-party separated (pyannote; 100% on
  an 8-turn 3-voice test)
- ✅ Translation: 18 languages any→any, source auto-detected (verified en→hi,
  en→ta through the API)
- ✅ Live demo: Vercel + Render + Atlas, CORS verified, register→Atlas write
  verified end-to-end
- ✅ Full-AI public demo via `start-demo.bat` (Cloudflare quick tunnel)
- ⚠️ Known limits (honest): CPU inference ≈ real-time (the live transcript is
  the UX answer); "ORS" mis-transcribes on synthetic TTS voices (untested with
  a real human voice); no diarizer can split one person voicing two roles.

---

## 6. How to run it

### One-click public demo (full AI)
Double-click **`start-demo.bat`** — starts Docker, the full stack, the
frontend, the HOST speech worker (the container worker has no pyannote), and a
Cloudflare quick tunnel; prints a public `https://<random>.trycloudflare.com`
URL. Live only while the window is open; new URL each run.

### Manual (dev)
```bash
docker compose --profile containers up -d   # rabbitmq + gateway + 4 services + worker
docker compose stop worker                  # use the host worker instead (pyannote)
cd backend && npm run worker                # host speech worker
cd frontend && npm run dev                  # :5173 (gateway proxies / to it)
# open http://localhost:8080  (NOT :5173 — API is same-origin via the gateway)
```
Translation server (optional):
`"D:/healthcare-main/venv/Scripts/python.exe" backend/pyservices/translate_server.py` (:5555)

### Environment (`backend/.env`, gitignored — see `.env.example`)
`MONGO_URI` · `JWT_SECRET` · `ADMIN_PASSKEY` · `AUDIO_ENCRYPTION_KEY` ·
`HF_TOKEN` (pyannote gated models) · `HF_HOME` · `PYANNOTE_PYTHON` ·
`WHISPER_MODEL` · `WHISPER_THREADS` · optional `RETENTION_DAYS`

### Local machine layout (everything heavy on D:)
- `D:\healthcare-main\venv` — torch / pyannote / NLLB venv
  (a **short path is required**: deeper than ~60 chars breaks torch installs
  while Windows MAX_PATH is off)
- `D:\healthcare-main\hf-cache` — HuggingFace models (`HF_HOME`)
- `D:\healthcare-main\pip-cache`, `npm-cache` — package caches
- Whisper models: `mern/backend/bin/whisper/models` (gitignored)
- `C:\Users\<user>\.wslconfig` caps WSL2 at 6 GB / 4 CPUs — without it WSL
  hoards half the RAM and the whole machine crawls

---

## 7. Hard-won gotchas (do not relearn)

1. **`.env` paths must use forward slashes** (`D:/...`) — dotenv treats `\b`
   as a backspace escape; `mern\backend\bin` silently became `mernackendin`
   and broke all transcription for a session.
2. **compose `environment:` beats `env_file:`** — containers load
   `backend/.env` (host Windows paths); pin Linux paths (e.g.
   `WHISPER_MODEL=/models/ggml-small.bin`) in docker-compose.
3. **Run exactly ONE speech worker.** Two consumers race requeued jobs and a
   crashed orphan can write a transient `failed`. Check:
   `rabbitmqctl list_queues name messages consumers` → must be 1. Trust the
   DB, not the first status you poll. On Windows, killing a shell can orphan
   its `node worker.js` child — kill by CommandLine match.
4. **Docker Desktop self-terminates** on this machine — check, restart, poll.
5. **Windows curl can't read Git-Bash paths** (`/d/...`) for `-F` uploads —
   `cd` to the file's dir and use relative paths.
6. **No C/C++ toolchain** — prebuilt wheels/binaries only.
7. **Synthetic test clips:** joining SAPI voices with digital silence makes
   whisper stop early — join with quiet pink noise
   (`anoisesrc=d=0.5:c=pink:a=0.005`). Fake a 3rd voice by pitch-shifting
   (`asetrate=22050*0.82,...,atempo=1.2195`).
8. **`doctorId` is an ObjectId** in sessions — cleanup scripts must match with
   `new ObjectId(id)` or they silently delete nothing.
9. **Transcripts are encrypted at rest** — read via the mongoose model
   (getters decrypt), never the raw driver.
10. **pyannote 4.x:** `token=` kwarg; result wrapped in `DiarizeOutput`; pass
    WAVs in-memory (its torchcodec/ffmpeg decoder may not load); gated repos
    to accept incl. **`speaker-diarization-community-1`**.
11. **Vercel:** `VITE_*` vars are build-time; "Redeploy" with build cache can
    ship a stale bundle — verify by checking which backend URL the served JS
    contains. `CLIENT_ORIGIN` must match the exact origin, **no trailing
    slash**.
12. **Render:** reconnecting a recreated repo can re-detect the runtime as
    Docker and fail (`open Dockerfile: no such file`) — recreate from the
    Blueprint (`render.yaml`) instead; the service URL suffix changes.
13. **Deleting a GitHub repo + recreating (same name) is the reliable way to
    reset cached contributor data** — new repo, fresh computation; then
    reconnect Render/Vercel.
14. **Reverting code frees no disk space** — source is ~0 bytes packed; the
    gigabytes are Docker images, models, and the venv.

---

## 8. Deployment (all free)

- **Vercel** (frontend) + **Render** (`combined-server.js`) + **Atlas** — the
  24/7 demo, everything except heavy AI (free tiers have 512 MB; NLLB alone
  needs ~2.5 GB). Full walkthrough with gotchas: `DEPLOY.md`.
- **Cloudflare quick tunnel** (`start-demo.bat`) — the accepted $0/no-card way
  to put the FULL AI on a public URL; live while the laptop runs.
- **Dead ends, documented:** Hugging Face compute Spaces (now PRO-only),
  Oracle Always-Free (genuinely free forever but requires a card at signup —
  declined). There is **no** free + no-card + always-on host for a 2.5 GB
  model.
- **Kubernetes:** deliberately not used — it's an orchestrator, not free
  compute; it solves none of this project's actual constraints.

---

## 8b. Day 34 — Health Records module (2026-07-18, committed `27866cb` + `a37eeb2`)

A patient-record layer on top of the consultation recorder, reachable from the
doctor dashboard ("Health records" button) and gated by the same doctor JWT.
Everything stays $0: Cloudinary/Gemini/Gmail-SMTP are optional free tiers and
every feature degrades gracefully when its key is unset.

| Feature | Backend | Frontend |
|---|---|---|
| Profile management (name/specialization/password) | `GET/PUT /api/auth/doctor/me` | `/doctor/profile` |
| Personal doctor directory (add/edit/delete, search, specialization filter) | `/api/doctors` (`DoctorContact` model) | `/doctor/doctors` |
| Medical documents (5 categories, upload/preview/download/delete; Cloudinary or local-disk fallback) | `/api/documents` (`MedicalDocument`) | `/doctor/documents` |
| Visit history (linked doctor, diagnosis, treatment notes, attached documents) | `/api/visits` (`Visit`) | `/doctor/visits` |
| Appointment scheduling (reminders, daily 9 AM email sweep + manual trigger, mark completed) | `/api/health-appointments` (`HealthAppointment`) | `/doctor/appointments` |
| AI pharmacy assistant (Gemini prescription parsing; openFDA drug info + generic alternatives, incl. paracetamol→acetaminophen-style aliases) | `/api/pharmacy` | `/doctor/pharmacy` |
| Dashboard (counts, upcoming appointments, recent visits) | `/api/overview` | `/doctor/overview` |

- Owned by the patient-service (mounted in `patient-server.js` AND
  `combined-server.js`); records scoped by `ownerId` from the JWT; visit/
  appointment references are ownership-checked server-side.
- New deps: `cloudinary`, `nodemailer`. New optional env (documented in
  `.env.example`): `CLOUDINARY_*`, `GEMINI_API_KEY`, `SMTP_USER/PASS`, `OPENFDA_API_KEY`.
- Verified end-to-end on an isolated test DB (`carepulse_feature_test`,
  dropped afterward) + a real-browser UI pass; frontend `npm run build` clean.

**All three integrations verified live with real keys (2026-07-18):**
- **Gemini**: model churn bit twice — `gemini-2.0-flash` free quota is now 0 and
  `gemini-2.5-flash` is closed to new keys. Default is **`gemini-flash-latest`**
  (Google's rolling alias — survives deprecations). Parse endpoint returns 200.
- **Cloudinary**: upload → public CDN URL → delete verified on the real account.
  Gotcha: the dashboard "API environment variable" must be pasted whole
  (`cloudinary://key:secret@cloud`) — the bare API key or the placeholder
  template fails; a malformed URL now logs a warning and falls back to local
  disk instead of 500ing. Deletes pass `invalidate: true` so the CDN cache is
  purged too (a deleted medical doc must not keep serving from edge cache).
- **Email**: Gmail app password (requires 2-Step Verification first —
  myaccount.google.com/apppasswords 404s without it). Real reminder sent
  (`{checked:1, sent:1}`), second sweep `{checked:0}` — once-only confirmed.
- Render env vars for the hosted demo: `GEMINI_API_KEY`, `CLOUDINARY_URL`,
  `SMTP_USER`, `SMTP_PASS` (all optional, now in render.yaml + DEPLOY.md).

## 9. Remaining ideas (optional, none blocking)

- TLS checkbox (hosting-time; the tunnel already serves HTTPS)
- Web Push delivery for reminders (currently in-app)
- NLP upgrade for key items (currently deterministic keyword/regex)
- Persistent object storage for uploads on the hosted demo
- K8s manifests as a local portfolio artifact
- Re-test "ORS" with a real human voice

## 10. See also

- `README.md` — public overview + live links + architecture diagram
- `ARCHITECTURE.md` — design decisions, free-stack table, phase checklists
- `DEPLOY.md` — deployment walkthrough (Vercel/Render/tunnel)
- `devlog/2026-07-08.md` — the full narrative build log, day by day

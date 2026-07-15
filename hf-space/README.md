---
title: CarePulse API
emoji: 🩺
colorFrom: blue
colorTo: green
sdk: docker
app_port: 7860
pinned: false
---

# CarePulse API (Hugging Face Space)

The CarePulse backend running with on-device AI — **whisper transcription +
speaker diarization** — on the free CPU tier. It's the combined single-process
backend from [manish-g-p/carepulse-mern](https://github.com/manish-g-p/carepulse-mern)
plus the Linux speech tooling, built by the `Dockerfile` in this Space.

The React frontend lives on Vercel (**<https://carepulse-mern.vercel.app>**) and
points at this Space for the API.

**Required Space secrets** (Settings → Variables and secrets):
`MONGO_URI`, `JWT_SECRET`, `ADMIN_PASSKEY`, `AUDIO_ENCRYPTION_KEY`,
`CLIENT_ORIGIN` (the Vercel URL). See the repo's `DEPLOY.md` for the full guide.

> Free CPU is slower than a laptop — a short clip takes ~20–40s to transcribe —
> and the Space pauses after ~48h idle (wakes on visit). Translation (NLLB) is
> not included in this image; the translate UI hides itself when it's absent.

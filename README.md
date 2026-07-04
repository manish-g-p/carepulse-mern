# CarePulse — MERN Edition

A MongoDB + Express + React + Node.js rebuild of the original Next.js/Appwrite CarePulse healthcare app. Same three flows as the original: patient onboarding, appointment booking, and an admin dashboard for scheduling/cancelling appointments.

## What changed from the original

| Concern | Original | This version |
|---|---|---|
| Frontend | Next.js (App Router) | React 18 + Vite + React Router |
| Backend | Appwrite (BaaS) | Express REST API (Node.js) |
| Database | Appwrite Databases | MongoDB (Mongoose) |
| File storage | Appwrite Storage | Local disk via multer (`backend/uploads`) |
| Auth | Appwrite users + phone-OTP passkey | Lightweight patient identity (generated `userId`, no password) + JWT-protected admin routes |
| SMS reminders | Twilio via Appwrite Messaging | Not included (dropped per project scope) |

Patients aren't required to log in — same as the original, they're identified by a generated `userId` carried in the URL. The admin dashboard is protected by a passkey (`ADMIN_PASSKEY` env var) that now issues a real JWT instead of a client-side-only check.

## Project structure

```
mern/
  backend/     Express API + MongoDB models
  frontend/    React (Vite) SPA
```

## Prerequisites

- Node.js 18+
- A MongoDB instance (local `mongod`, or a free MongoDB Atlas cluster)

## Backend setup

```bash
cd mern/backend
cp .env.example .env     # edit MONGO_URI, JWT_SECRET, ADMIN_PASSKEY
npm install
npm run dev              # http://localhost:5000
```

Env vars (`backend/.env`):

- `PORT` — API port (default 5000)
- `MONGO_URI` — MongoDB connection string
- `JWT_SECRET` — any long random string, used to sign admin session tokens
- `ADMIN_PASSKEY` — the 6-digit (or any) code used to unlock `/admin`
- `CLIENT_ORIGIN` — the frontend URL, for CORS (default `http://localhost:5173`)

Uploaded ID documents are saved to `backend/uploads/` and served at `/uploads/<filename>`.

## Frontend setup

```bash
cd mern/frontend
cp .env.example .env      # set VITE_API_URL if backend isn't on localhost:5000
npm install
npm run dev                # http://localhost:5173
```

## Routes

- `/` — patient starts here (name/email/phone)
- `/patients/:userId/register` — full intake form (personal, medical, insurance, ID upload, consent)
- `/patients/:userId/new-appointment` — request an appointment
- `/patients/:userId/new-appointment/success` — confirmation screen
- `/admin` — passkey-gated dashboard: stat cards + appointments table with schedule/cancel actions

## API reference

| Method | Path | Auth | Purpose |
|---|---|---|---|
| POST | `/api/users` | — | Create (or fetch existing) patient identity by email |
| GET | `/api/users/:userId` | — | Fetch identity |
| POST | `/api/patients` | — | Submit full registration (multipart, field `identificationDocument`) |
| GET | `/api/patients/user/:userId` | — | Fetch a patient's registration record |
| POST | `/api/appointments` | — | Request an appointment |
| GET | `/api/appointments/:id` | — | Fetch one appointment |
| GET | `/api/appointments` | admin | List all appointments + status counts |
| PUT | `/api/appointments/:id` | admin | Schedule or cancel an appointment |
| POST | `/api/auth/admin-login` | — | Exchange passkey for a JWT |

## One manual step: copy the binary image assets

All SVG icons were already copied into `frontend/public/assets/icons`. The **PNG photos/backgrounds and the success GIF** couldn't be copied automatically in this session (binary files can't be moved through the text-based tools available here), so copy these two folders from the original project into the new one:

```
healthcare-main/public/assets/images   ->  mern/frontend/public/assets/images
healthcare-main/public/assets/gifs     ->  mern/frontend/public/assets/gifs
```

That's a straight folder copy — same filenames, same relative path, no code changes needed. Everything in the app already references `/assets/images/...` and `/assets/gifs/...`.

## Notes / follow-ups if you want full parity

- SMS notifications were intentionally dropped. To add them back, wire Twilio (or another SMS provider) into `updateAppointment` in `backend/controllers/appointmentController.js`.
- File storage is local disk, fine for development. For production, swap `multer.diskStorage` for an S3-compatible multer storage engine.

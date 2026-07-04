# CarePulse

A full-stack healthcare patient management system built with the MERN stack (MongoDB, Express, React, Node.js). CarePulse lets patients register, book appointments, and track their requests, while an admin dashboard gives staff a real-time view of scheduled, pending, and cancelled appointments.

## Features

- **Patient onboarding** — quick start form (name, email, phone) followed by a detailed intake form covering personal info, medical history, insurance, and ID verification with document upload.
- **Appointment booking** — patients pick a physician, date/time, and reason, then get a confirmation screen with their request details.
- **Admin dashboard** — passkey-protected view with live stat cards (scheduled/pending/cancelled counts) and a searchable appointments table where staff can schedule or cancel requests.
- **Secure file uploads** — ID documents are handled server-side with Multer and served back to the app.
- **JWT-based admin auth** — the admin passkey exchanges for a signed JWT used to authorize all admin-only API routes.

## Tech stack

- **Frontend**: React 18, Vite, React Router, React Hook Form + Zod for validation, Axios
- **Backend**: Node.js, Express, MongoDB with Mongoose
- **Auth**: JWT for admin sessions
- **File handling**: Multer (local disk storage)

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
- `ADMIN_PASSKEY` — the code used to unlock `/admin`
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

## Possible extensions

- SMS/email appointment reminders (e.g. via Twilio or a transactional email provider)
- Cloud file storage (S3-compatible) for ID documents in production
- Patient-facing login so users can view their own appointment history across devices

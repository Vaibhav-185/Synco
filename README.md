# Synco

**Keep your class timetable, see when friends are free, and get a nudge before class.**

Synco is a timetable-sharing web app for college students. You photograph your class timetable, an AI reads it into a structured weekly schedule, you review and confirm it, and Synco tells you when your friends are free and nudges you before class.

## Features

- **AI timetable upload with review** - Upload a JPEG or PNG of your class timetable. Google Gemini Vision extracts the grid, merged cells, breaks, and legend; a deterministic normalizer structures subjects, labs, parallel batches (C1/C2/C3), rooms, and faculty. Nothing saves before you confirm it in the UI.
- **Manual timetable editing** - Add, edit, or delete individual slots by hand.
- **Live availability and agenda** - See who is in class right now, the next class with a countdown, a today agenda, and a week grid.
- **Friends and sharing** - Send and accept friend requests, share timetables with approval, keep a friend in private mode, or share only free time. Shared timetables are read-only.
- **Groups** - Find common free slots across a group of friends.
- **Class alerts** - Push notifications before class start, via installable PWA on Android and iPhone.
- **Themes** - Light, dark, and system modes with a calm Quiet Premium visual style.
- **Account controls** - Profile, password change, sharing settings, and account deletion. Privacy policy and terms pages included.

## How it works

1. The frontend posts the image to the backend upload endpoint (`multipart/form-data`, 10 MB limit).
2. The backend runs the Gemini extraction chain and normalizes the output.
3. The frontend shows the extracted timetable in a review step; confirming saves it.
4. Saved timetables feed availability, friends, groups, and the push scheduler.

## Tech stack

| Part | Stack |
| --- | --- |
| Frontend | React 19, Vite, React Router, axios, custom CSS design system, PWA (manifest, service worker, Web Push) |
| Backend | Node.js 20, Express, MongoDB Atlas via Mongoose, JWT auth, bcrypt, Google Gemini via `@google/genai`, web-push, node-cron |
| Deploy | Vercel (frontend), Render (backend) |

## Local development

```bash
# backend
cd backend
npm install
npm run dev        # http://localhost:8000

# frontend (in a second terminal)
cd frontend
npm install
npm run dev        # http://localhost:5173
```

Backend environment variables: `PORT`, `MONGO_URI`, `JWT_SECRET`, `GEMINI_API_KEY`, `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NOTIFY_WINDOW_MINUTES`, `FRONTEND_URL`.

Frontend environment variable: `VITE_API_URL` (defaults to `http://localhost:8000/api`).

## Verification

Backend test suites (all offline, deterministic):

```bash
cd backend && npm test
```

Covers normalizer (41 checks), extractor fallback chain (15 checks), sharing policy (13 checks), account validation (12 checks).

Frontend checks:

```bash
cd frontend && npm test      # upload regression suite (vitest)
cd frontend && npm run build
cd frontend && npm run lint
```

The upload regression suite covers successful upload, network failure, validation failure, cancellation, and loading-state reset.

## Deployment

- Frontend: Vercel at `https://synco-three.vercel.app`
- Backend: Render at `https://synco-backend-qz0c.onrender.com`

Deployment configs live in `render.yaml` and `frontend/vercel.json`.

## Roadmap

1. Ship the upload-resilience update (cancel, validation, stuck-state fix).
2. Extend timetable extraction beyond the first supported format.
3. Connect a custom domain and complete the two-account live test matrix.
4. Grow the private beta (5 users) toward the first college launch, then more.

Native mobile apps are a future option once the PWA proves demand.

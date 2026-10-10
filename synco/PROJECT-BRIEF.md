# Synco — Project Brief

## What it is
Synco is a timetable-sharing web app for college students. Students photograph
their class timetable; AI reads it into a structured weekly schedule. From that
single input, Synco shows live availability, the next class with a countdown,
a today agenda plus week grid, friend availability, group free-slot discovery,
and push reminders before class.

## How it works
- **Frontend:** React + Vite, hosted on Vercel (`synco-three.vercel.app`).
  Installable as a PWA on Android and iPhone, with Light, Dark, and System
  themes in a calm Quiet Premium visual style.
- **Backend:** Node.js + Express on Render, MongoDB Atlas for data, JWT
  authentication with hardened CORS, rate limits, and validated uploads.
- **Timetable AI:** Google Gemini Vision extracts the grid, merged cells,
  breaks, and legend. A deterministic normalizer structures subjects, labs,
  parallel batches (C1/C2/C3), rooms, and faculty. Nothing saves before the
  student reviews and confirms it in the UI.
- **Reliability:** a 5-model Gemini fallback chain with bounded retries
  survives peak-hour overloads (proven in production logs: primary shed load,
  fallback delivered). Class reminders run on a scheduler with durable,
  restart-safe deduplication.

## What it does today
- AI timetable upload with review, plus manual add, edit, and delete.
- Live status (in class or free), next-class countdown, today agenda, week view.
- Friends with requests, per-friend timetable sharing (approval-based, with a
  private mode), and read-only shared timetables.
- Groups with common free-slot discovery across members.
- Class-alert push notifications on Android and iPhone.
- Profile with personal info, password change, sharing controls, and account
  deletion; privacy policy and terms pages included.

## Verification
Real uploads verified end to end (41-slot timetable saved). Automated suites
are green: 41 normalizer checks, 15 extractor fallback checks, 13 sharing
policy checks, 12 account validation checks, and frontend upload regression
tests covering success, network failure, validation, cancellation, and
loading-state reset. Production login and core flows are live.

## Roadmap
1. Ship the upload-resilience update (cancel, validation, stuck-state fix).
2. Extend timetable extraction beyond the first supported format.
3. Connect a custom domain and finish the two-account live test matrix.
4. Grow the private beta (5 users) to the first college launch, then expand
   to more colleges. Native mobile apps only after the PWA proves demand.

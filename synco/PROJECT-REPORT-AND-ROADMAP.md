# Synco — Project Progress Report & Roadmap
_Prepared Oct 9, 2026. Based on a full code survey + this week's live debugging sessions._

---

## PART 1 — WHAT SYNCO IS

A timetable-sharing web app for college students. Photograph your timetable → Gemini AI extracts it → review/edit in the UI → saved to MongoDB. From there: live "free right now / next class" status, shared friend timetables, group free-slot discovery, and push notifications 10 minutes before class.

**Stack**: React+Vite (5173) · Express 5 + Mongoose (8000) · MongoDB Atlas · JWT auth · `@google/genai` 2.24.0 · `web-push` + `node-cron` · macOS `sips` for image compression.

---

## PART 2 — ACHIEVEMENTS TO DATE

### A. Core pipeline — working end-to-end ✔
- **AI extraction with a resilient 5-model fallback chain** ([timetableExtractor.js](backend/services/timetableExtractor.js), 386 lines): `gemini-3.6-flash → 3.5-flash → 3.8-flash → 3.7-flash → gemini-flash-latest`. Per-model 3 attempts, 90s timeout, 4s→8s jittered backoff on 503/network errors, instant advance on 429 (per-model quota) or timeout, fail-fast on 400/401/403. SDK's hidden retries disabled (`retryOptions:{attempts:1}`) so quota is never silently multiplied.
- **Image lean pipeline** (`leanImageForGemini`): macOS-native `sips` (zero added dependencies) resizes to ≤1600px and recompresses down to ≤300KB. Guard: if the lean output is larger than the original, send the original. Live-verified: 449,977 → 236,660 bytes.
- **Deterministic normalizer** ([timetableNormalizer.js](backend/services/timetableNormalizer.js), 727 lines): converts Gemini's raw OCR JSON into structured slots (subject/code/faculty/room/day/type incl. lab, break, activity, proctoring, project), handling parallel-lab batches (C1/C2/C3), reference tables, and notes. Protected by a **41/41 passing offline regression** ([testNormalizerOffline.js](backend/scripts/testNormalizerOffline.js)).
- **Review-before-save UI** ([TimetableReview.jsx](frontend/src/components/TimetableReview.jsx)): editable grid, global batch selector, per-slot delete, add custom slot, confirm/discard — no bad data reaches the DB unreviewed.
- **22/22 passing mock suite** for the extractor chain (timeout/503/429/fallback ordering verified offline, no quota burned).

### B. Live milestone: first fully successful upload ✔
**Oct 9, 2:28 AM** — the real 450KB timetable photo went photo → extraction → review → save, and **41 slots were confirmed in MongoDB** (direct DB count: Mon 8, Tue–Thu 7 each, Fri 6, Sat 6, Sun 0; matches the dashboard's "41 slots this week"). Notably at ~2:28 AM — consistent with the off-peak success pattern (1 AM / mid-afternoon). The Gemini 503 "high demand" failures at India-evening peak were **provider capacity shedding**, exhaustively exonerated locally (network, DNS, key, env, code all cleared with hard evidence).

### C. Timetable management API — complete
8 endpoints ([timetable.js](backend/routes/timetable.js)): upload, confirm, my-slots, live status (self + any user), and full slot CRUD (create/read/update/delete) — all JWT-protected, error responses classified into friendly messages (quota vs high-demand vs timeout vs bad image), single-response guarantee, temp files always cleaned.

### D. Social layer — implemented
- **Friends**: search, request, accept/reject, list, status lookup, unfriend — 7 endpoints with friendship-model integrity.
- **Groups**: create, list, add/remove members, delete, and the standout feature — **group free-slot discovery**: intersects every member's timetable across Mon–Sat, 08:00–20:00, and reports who's free when, so the group can pick a meeting time.
- **Batch-aware slot resolution** ([batchView.js](backend/services/batchView.js)): when a lab runs parallel sections (C1/C2/C3), each student sees the room/faculty for *their* batch — derived entirely from persisted data, nothing hardcoded.

### E. Push notifications — built, one bug outstanding
- Full `web-push` stack: VAPID keys in env, subscription endpoints (subscribe/unsubscribe/test), minimal service worker ([sw.js](frontend/public/sw.js)) handling push + click, client subscription UI ([EnableNotifications.jsx](frontend/src/components/EnableNotifications.jsx)).
- **node-cron scheduler** ([notificationScheduler.js](backend/services/notificationScheduler.js)): every 5 minutes, IST-explicit (Asia/Kolkata via Intl), 10-minute pre-class window, "Class starting soon" with subject/room/faculty.
- **Durable dedupe** via a unique Mongo index on (user, slot, date, start-time) — survives restarts without in-memory state; dead subscriptions auto-cleaned so re-subscribing works.
- ⚠️ Outstanding: an intermittent **"push service error"** during sends — user-flagged, diagnosis queued (see roadmap).

### F. Security & ops hygiene
- JWT auth middleware on every private route; ownership checks on slot/group mutations.
- `.env` discipline: 7 vars, never logged; API key never exposed in any error path.
- `/uploads` served statically; multer for multipart handling.
- Server-side error mapping so raw provider errors never leak to the client.

---

## PART 3 — FUTURE STEPS (prioritized)

### Priority 1 — Reliability & the known bug
1. **Diagnose the web-push "push service error"** — the last broken thing in a now-working product. Capture the exact provider error from `notificationService.js`, distinguish expired subscriptions vs VAPID audience mismatch vs payload limits.
2. **PORT hardening in server.js** — `app.listen(process.env.PORT)` silently binds to port 0 if PORT is missing. One-line fallback to 8000.
3. **Off-peak auto-retry queue** (optional but high value): when all 5 models shed at peak, enqueue the job and retry automatically at ~1 AM / after the 12:30 PM IST quota reset, notifying the user when done — instead of making them remember to retry.

### Priority 2 — Data quality (the 4 latent normalizer bugs)
4. **Catalog code mismatch**: `PEC22IS553/554` vs legend `22IS553/554` — normalize both forms to one canonical code.
5. **Faculty initials**: `extractFacultyFromLine` misses `AV` — add it to the initials set.
6. **"TEA" false positive**: `upper.includes('TEA')` also matches "TEAM" — require word-boundary matching.
7. **In-review UI cell editing**: currently you can delete/add slots but not edit a misread room/faculty inline; the CN-lab "202" misread case shows this is the natural fix point.

### Priority 3 — Product growth
8. **Compare-with-friend view**: two timetables side by side, highlighting shared free hours (the group endpoint already has the core intersection logic to reuse).
9. **Mobile app / PWA**: add a manifest + offline shell to the existing service worker for install-to-homescreen; push already works.
10. **Multi-timetable support**: semesters change — version timetables by date range instead of overwriting.
11. **Export**: ICS download for Google Calendar/Apple Calendar sync.
12. **Admin/insight dashboard**: extraction success rate per model, peak-hour failure heatmap — data you're already logging.

### Priority 4 — Engineering maturity
13. **Get it under git** — the repo has no version control; every edit session is unprotected. `git init` + first commit is 10 minutes and the single highest-leverage safety step.
14. **Move mock suites out of /tmp** — `/tmp/synco-extractor-timeout-mock-test.js` (22 checks) and friends get wiped on restart; relocate into `backend/tests/` so they run via `npm test`.
15. **CI**: run the 41-check normalizer regression + 22-check extractor mock on every change.
16. **Log rotation** for the tee'd dev log, and structured logging (levels) instead of emoji-only lines when debugging in production.

---

## PART 4 — KEY FILES MAP

| Area | File | Notes |
|---|---|---|
| Extractor | [backend/services/timetableExtractor.js](backend/services/timetableExtractor.js) | 5-model chain, image lean, error classification. ⚠️ duplicate-block editing hazard — always `node --check` + grep-verify after batch edits |
| Normalizer | [backend/services/timetableNormalizer.js](backend/services/timetableNormalizer.js) | 727 lines, 41-check regression |
| Push scheduler | [backend/services/notificationScheduler.js](backend/services/notificationScheduler.js) | cron */5min, IST-explicit, dedupe via Mongo index |
| Batch resolution | [backend/services/batchView.js](backend/services/batchView.js) | parallel-lab C1/C2/C3 → per-student view |
| Routes | [backend/routes/](backend/routes/) | auth(3), timetable(8), friends(7), groups(6), notifications(4) — 28 endpoints total |
| Review UI | [frontend/src/components/TimetableReview.jsx](frontend/src/components/TimetableReview.jsx) | edit/delete/add-slot/confirm |
| Dashboard | [frontend/src/pages/Dashboard.jsx](frontend/src/pages/Dashboard.jsx) | upload, status banner, weekly grid; axios has NO timeout (waits out the full chain — intended) |

## Rules carried forward
User approval before changes · no speculative fixes · `.env` contents never printed · mocked tests by default, live tests only with explicit approval · don't burn quota with peak-hour retries.

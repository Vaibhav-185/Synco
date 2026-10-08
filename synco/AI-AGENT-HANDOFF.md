# Synco — AI Agent Handoff Briefing
_Generated: Oct 2026. Source: live debugging sessions through Oct 7-8._

## What the project is
**Synco** is a timetable-sharing web app at `/Users/vaibhav/synco` (NOT a git repo). Students photograph their college timetable; the backend sends the image to Google Gemini, a deterministic normalizer structures the raw OCR output, the student reviews/edits in a UI, then it's saved to MongoDB. Later, a node-cron scheduler sends "class starting soon" push notifications 10 minutes before each class.

## Stack
| Layer | Tech | Port |
|---|---|---|
| Frontend | React + Vite | 5173 |
| Backend | Express 5 + Mongoose | 8000 |
| Auth | JWT | — |
| AI | `@google/genai` v2.24.0 (Gemini API, free tier) | — |
| DB | MongoDB Atlas `syncodb.juxgwax.mongodb.net/syncodb` | — |

`backend/.env` holds 7 vars: PORT, MONGO_URI, JWT_SECRET, GEMINI_API_KEY, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT. **Never print, log, or echo any of these — especially the API key** (53-char `AQ.`-format string).

## How the extraction pipeline works
`backend/services/timetableExtractor.js` is the core file. Flow:
1. Image uploaded → `leanImageForGemini()` compresses it via macOS `sips` (max width 1600px, JPEG quality 80, recompress loop down to ≤300KB, floor quality 30). Caller-guard: if leaned bytes are LARGER than the original, send the original untouched. Verified live: user's 449,977-byte photo → 236,660 bytes.
2. `extractRawTimetable()` walks a 5-model fallback chain: `['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest']`. MAX_ATTEMPTS=3 per model, 90s request timeout each, backoff 4s→8s ±25% jitter on retryable errors.
3. Response is JSON-parsed against a strict schema (gridEntries, referenceTable, notes).
4. `backend/services/timetableNormalizer.js` deterministically structures it (41-check offline regression in `backend/scripts/testNormalizerOffline.js`, currently 41/41 PASS).
5. User reviews in the frontend, then it's persisted to MongoDB.

**Error semantics in the chain**:
- 503 / network codes → retry same model with backoff, then advance to next model
- 429 → this model's free-tier quota is burned; advance immediately
- Timeout (90s) → advance immediately, no same-model retry
- 400/401/403/unexpected → fail fast via `classifyExtractionError`
- Success logs `✅ Timetable extracted via <model> (fallback N)`

## Current state: the Gemini overload problem
The whole effort this week has been around uploads failing at India-evening peak (~5-9 PM IST). All 9 model attempts repeatedly returned Google's OWN 503: `"This model is currently experiencing high demand. Spikes in demand are usually temporary. Please try again later."` — provider capacity shedding, nothing wrong with Synco's code, network, key, or DNS (all exhaustively exonerated: 4/4 curl probes OK, TLS 0.1-0.35s, no VPN, no proxy vars, dotenv parses cleanly).

Successes historically land around **1 AM** or **mid-afternoon**, suggesting off-peak windows are the practical fix. Quota resets ~12:30 PM IST daily.

**Free-tier constraints**: 20 requests/day PER MODEL. Recent failed runs burned ~2 full model quotas. Never spam retries.

## Verified vs not verified
✅ Verified live/mock: 5-model chain logic (22-check mock suite `/tmp/synco-extractor-timeout-mock-test.js`, all passing), image lean pipeline, error classification, frontend error display.
⚠️ NOT yet verified live: an actual successful upload end-to-end with the full 5-model chain — repeatedly blocked by peak-hour shedding.
❌ Known Open Issues (listed but not yet chased):
- Catalog codes like `PEC22IS553/554` vs legend format `22IS553/554` mismatch in the normalizer
- `extractFacultyFromLine` misses the "AV" faculty prefix
- `upper.includes('TEA')` would also match "TEAM" (false positive for tea breaks)
- Web-push "push service error" during notification send — user-flagged, diagnosis unfinished
- `backend/server.js` line 32 `app.listen(process.env.PORT)` brittle if PORT env missing (optional hardening: fallback to 8000)

## Editing hazard (learned the hard way)
Multi-part `str_replace` batches on `backend/services/timetableExtractor.js` have repeatedly produced duplicate blocks — the task is flagged as a specific pattern that bites. After ANY multi-change batch on that file, always: run `node --check backend/services/timetableExtractor.js`, `grep -c "↳ diagnostic"` (expect exactly 1), and `grep MODEL_CHAIN` (expect len 5) to confirm no drift.

## How to run
User runs these THEMSELVES in their own terminal (the agent's tooling drops background processes and has stray `PORT=0`, so it cannot babysit dev servers):
```bash
cd ~/synco/backend  && npm run dev 2>&1 | tee -a /tmp/synco-live.log   # tees full backend log
cd ~/synco/frontend && npm run dev
```
Backend startup banner: `◇ injected env (7) from .env` → `✅ Connected to MongoDB` → `🚀 Server running on port 8000`.

## Queue of things to try next (in priority order)
1. Off-peak live retry (e.g. late night or after ~12:30 PM IST next day) — most likely to finally verify a successful upload end-to-end
2. Diagnose the web-push "push service error"
3. Fix the four latent normalizer bugs listed under Known Open Issues
4. PORT fallback hardening in server.js
5. In-review UI: add per-cell editing so students can fix lab-room misreads without re-uploading the photo
6. If evening usage stays unavoidable: consider a server-side off-peak auto-retry queue instead of failing immediately

## Rules for whoever picks this up
- Get user approval before code changes; no speculative fixes
- Never touch or print `.env` contents
- Mock/stub tests offline by default; only run live_extractor calls with explicit approval
- Don't burn quota with repeated live retries during peak hours

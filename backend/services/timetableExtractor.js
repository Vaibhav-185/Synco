const { GoogleGenAI, Type } = require('@google/genai');
const fs = require('fs');

/**
 * Extracts raw timetable grid entries and subject legend from an image using Gemini Flash Vision.
 *
 * Model fallback chain (same vision + JSON-schema call for every model):
 * - Primary: gemini-3.6-flash. Fallbacks: gemini-3.5-flash, then gemini-3.8-flash.
 *   Free-tier quota is PER MODEL (20 req/day each), so fallbacks also add quota headroom.
 *
 * Retry policy (owned here — the SDK's own internal retries are disabled):
 * - Max 3 attempts per model.
 * - Retries only transient 503 (high demand) and retryable network failures,
 *   with exponential backoff + ±25% jitter (~4s after attempt 1, ~8s after attempt 2).
 * - 429 (per-model quota) does NOT retry the same model: it advances to the next
 *   model in the chain, whose quota is independent.
 * - 400 (bad image), 401/403 (key/access), timeouts (504) and unexpected errors
 *   fail fast — never retried, never advanced (they are request/key-level, not
 *   model-capacity problems).
 * - Each HTTP attempt is bounded by a 60s timeout (enforced by the SDK via httpOptions.timeout).
 * - Worst case: 3 models × 3 attempts = 9 requests, spread across 3 separate daily quotas.
 *
 * Errors thrown to callers are always user-friendly. The underlying provider
 * status is preserved on `err.underlying` (safe fields only) for server-side
 * debugging, and never includes API keys, headers, stack traces or raw
 * provider JSON.
 *
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<object>} Raw JSON extracted from image
 */

// Ring of flash-tier models; each has an independent free-tier quota AND (as of
// Oct 7 evening's live evidence) a separate overload pool — 3.6/3.5/3.8 all
// returned 'high demand' 503s together, so the deeper the ring the better the
// odds of landing on a pool with headroom. 3.7 + latest verified SERVING Oct 2.
const MODEL_CHAIN = ['gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-3.8-flash', 'gemini-3.7-flash', 'gemini-flash-latest'];
const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 4000;
const JITTER_FACTOR = 0.25; // ±25%
// 90s per attempt: a real timetable extraction takes close to a minute on
// gemini-3.6-flash (observed 58.5s on a small image). 60s was too tight and
// aborted attempts that were about to succeed.
const REQUEST_TIMEOUT_MS = 90000;

// Leaner upload requests avoid provider-side shedding of heavy multimodal
// calls (observed Oct 7 evening: small API probes answered instantly while
// real uploads got repeated 503/504). Timetable photos stay fully legible to
// Vision far below these caps.
const IMAGE_MAX_WIDTH_PX = 1600;
const IMAGE_JPEG_QUALITY = 80;
const IMAGE_TARGET_MAX_BYTES = 300 * 1024;

const RETRYABLE_NETWORK_CODES = new Set([
  'ECONNRESET',
  'ECONNREFUSED',
  'ETIMEDOUT',
  'EAI_AGAIN',
  'ENOTFOUND',
  'EPIPE',
  'EHOSTUNREACH',
  'ENETUNREACH',
]);

function sleepWithJitter(attempt) {
  const backoff = BASE_DELAY_MS * Math.pow(2, attempt - 1); // 4s, 8s, ...
  const jitter = backoff * JITTER_FACTOR * (Math.random() * 2 - 1); // ±25%
  return new Promise((resolve) => setTimeout(resolve, Math.max(500, Math.round(backoff + jitter))));
}

function isRetryableError(err) {
  if (!err) return false;
  // Transient provider-side overload.
  if (err.status === 503) return true;
  // Retryable network-level failures (undici sets err.code; fetch failures may nest the cause).
  const code = err.code || (err.cause && err.cause.code);
  if (code && RETRYABLE_NETWORK_CODES.has(code)) return true;
  const msg = (err.message || '').toLowerCase();
  if (msg.includes('fetch failed') || msg.includes('network error') || msg.includes('socket hang up')) return true;
  return false;
}

function isTimeoutError(err) {
  if (!err) return false;
  if (err.name === 'AbortError' || err.name === 'TimeoutError') return true;
  const msg = (err.message || '').toLowerCase();
  return msg.includes('aborted') || msg.includes('timed out') || msg.includes('timeout');
}

/**
 * Builds a safe, user-friendly error. `underlying` carries only non-sensitive
 * metadata (numeric status, error name/code) for server-side logs.
 */
function makeExtractionError(userMessage, httpStatus, underlying) {
  const e = new Error(userMessage);
  e.httpStatus = httpStatus;
  e.underlying = underlying || null;
  return e;
}

function classifyExtractionError(err) {
  const status = typeof err.status === 'number' ? err.status : undefined;

  if (status === 429) {
    return makeExtractionError(
      'Gemini is rate-limiting or the daily quota for this model is used up. Please try again later, or add your slots manually.',
      429,
      { status }
    );
  }
  if (status === 503) {
    return makeExtractionError(
      'The Gemini timetable service is temporarily unavailable due to high demand. Please try again in a few minutes.',
      503,
      { status }
    );
  }
  if (status === 504 || isTimeoutError(err)) {
    return makeExtractionError(
      'The timetable extraction took too long and timed out. Please try again.',
      504,
      { status: status || null, name: err.name || null }
    );
  }
  if (status === 400) {
    return makeExtractionError(
      'The uploaded image could not be processed as a timetable. Please upload a clear, readable image.',
      400,
      { status }
    );
  }
  if (status === 401 || status === 403) {
    return makeExtractionError(
      'The timetable extraction service is misconfigured (API key or access problem). Please contact the administrator.',
      502,
      { status }
    );
  }
  return makeExtractionError(
    'Timetable extraction failed unexpectedly. Please try again, or add your slots manually.',
    502,
    { status: status || null, name: err.name || null, code: err.code || null }
  );
}

/**
 * Image lean using macOS's built-in `sips` binary (zero extra dependencies).
 * Downscale to IMAGE_MAX_WIDTH_PX wide, JPEG at IMAGE_JPEG_QUALITY, then
 * re-compress at progressively lower quality until under
 * IMAGE_TARGET_MAX_BYTES. Any failure throws — the caller falls back to the
 * untouched original image.
 */
function leanImageForGemini(imagePath) {
  const { execFile } = require('child_process');
  const os = require('os');
  const outFile = `${os.tmpdir()}/synco-lean-${Date.now()}.jpg`;

  const runSips = (args) => new Promise((resolve, reject) => {
    execFile('sips', args, { timeout: 10000 }, (err) => (err ? reject(err) : resolve()));
  });

  return (async () => {
    await runSips(['-Z', String(IMAGE_MAX_WIDTH_PX), '-s', 'format', 'jpeg', '-s', 'formatOptions', String(IMAGE_JPEG_QUALITY), imagePath, '--out', outFile]);
    let size = fs.statSync(outFile).size;
    let quality = IMAGE_JPEG_QUALITY;
    while (size > IMAGE_TARGET_MAX_BYTES && quality > 30) {
      quality -= 10;
      await runSips(['-s', 'format', 'jpeg', '-s', 'formatOptions', String(quality), outFile, '--out', outFile]);
      size = fs.statSync(outFile).size;
    }
    const buf = fs.readFileSync(outFile);
    try { fs.unlinkSync(outFile); } catch (e) { /* temp cleanup best-effort */ }
    return buf;
  })();
}

async function extractRawTimetable(imagePath) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.includes('your_') || apiKey === 'YOUR_GEMINI_API_KEY') {
    throw makeExtractionError(
      'The timetable extraction service is not configured (missing API key). Please contact the administrator.',
      502,
      { name: 'MissingApiKey' }
    );
  }

  const ai = new GoogleGenAI({ apiKey });

  // Lean the image before base64-encoding it (see constants above for why).
  // Any sips failure falls back to the exact original bytes.
  let imageBuffer = null;
  let mimeType = 'image/jpeg';
  if (imagePath.endsWith('.png')) mimeType = 'image/png';
  if (imagePath.endsWith('.webp')) mimeType = 'image/webp';

  try {
    const bytesPre = fs.statSync(imagePath).size;
    const leaned = await leanImageForGemini(imagePath);
    if (leaned && leaned.length < bytesPre) {
      imageBuffer = leaned;
      mimeType = 'image/jpeg'; // sips output format
      console.log(`🖼️ Image request size: ${bytesPre} → ${leaned.length} bytes`);
    } else {
      imageBuffer = fs.readFileSync(imagePath);
      console.log(`🖼️ Image kept at original size (${bytesPre} bytes; lean made no improvement)`);
    }
  } catch (leanErr) {
    imageBuffer = fs.readFileSync(imagePath);
    console.log(`🖼️ Image lean skipped (${leanErr && leanErr.message || 'unknown error'}); sending original bytes.`);
  }

  const base64Data = imageBuffer.toString('base64');

  const prompt = `Analyze this college timetable image as a structured 2D grid and table.
Extract all timetable entries, merged cell spans, breaks, and the subject/faculty reference table at the bottom.

Instructions:
1. Examine column headers for time slots (e.g. 09:00-10:00, 10:00-11:00, 11:00-11:15, 11:15-12:15, 12:15-01:15, 01:15-02:00, 02:00-03:00, 03:00-04:00, 04:00-05:00).
2. Examine row headers for days of the week (e.g. MON, TUE, WED, THU, FRI, SAT).
3. For every cell in the grid:
   - Identify the Day (Monday, Tuesday, etc.)
   - Identify the exact startTime and endTime in 24-hour HH:MM format (e.g. "09:00", "10:00", "11:15", "13:15", "14:00", "15:00", "17:00").
   - If a cell is merged across multiple hours (e.g. 03:00-05:00 or 02:00-05:00), preserve the full range (e.g. startTime: "15:00", endTime: "17:00").
   - Extract raw text inside the cell completely without altering abbreviations.
   - If the cell is a Tea Break or Lunch Break, set isBreak=true and breakLabel="Tea Break" or "Lunch Break".
4. Extract the reference table / legend below the grid:
   - SL.No / SUB.CODE
   - Full subject title
   - Faculty initials
   - Faculty full name
5. Extract any NOTE or footnote text below the table (e.g. biweekly schedule rules).
`;

  const schema = {
    type: Type.OBJECT,
    properties: {
      days: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Days present in table e.g. ["Monday", "Tuesday", ...]'
      },
      timeSlots: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Header time slot strings'
      },
      gridEntries: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            day: { type: Type.STRING, description: 'Full day name e.g. Monday' },
            startTime: { type: Type.STRING, description: '24h format HH:MM e.g. 09:00' },
            endTime: { type: Type.STRING, description: '24h format HH:MM e.g. 10:00' },
            rawText: { type: Type.STRING, description: 'Exact text inside cell' },
            isBreak: { type: Type.BOOLEAN },
            breakLabel: { type: Type.STRING }
          },
          required: ['day', 'startTime', 'endTime', 'rawText']
        }
      },
      referenceTable: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            code: { type: Type.STRING },
            subject: { type: Type.STRING },
            initials: { type: Type.STRING },
            faculty: { type: Type.STRING }
          },
          required: ['code', 'subject', 'initials']
        }
      },
      notes: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
        description: 'Footnotes or special rule notes'
      }
    },
    required: ['gridEntries', 'referenceTable']
  };

  const requestConfig = {
    responseMimeType: 'application/json',
    responseSchema: schema,
    temperature: 0.1,
    maxOutputTokens: 8192,
    // SDK-level HTTP controls (verified against installed @google/genai):
    // - timeout: 60s per-attempt deadline enforced by the SDK's own AbortController.
    // - retryOptions.attempts: 1 disables the SDK's hidden default retries
    //   (default was 5 attempts incl. 429/503 — this was silently multiplying
    //   quota usage; retry policy is owned by the loop below instead).
    httpOptions: {
      timeout: REQUEST_TIMEOUT_MS,
      retryOptions: { attempts: 1 },
    },
  };

  let lastError = null;
  for (let modelIndex = 0; modelIndex < MODEL_CHAIN.length; modelIndex++) {
    const model = MODEL_CHAIN[modelIndex];
    const isLastModel = modelIndex === MODEL_CHAIN.length - 1;

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model,
          contents: [
            {
              role: 'user',
              parts: [
                { inlineData: { mimeType, data: base64Data } },
                { text: prompt }
              ]
            }
          ],
          config: requestConfig,
        });

        let parsed;
        try {
          parsed = JSON.parse(response.text);
        } catch (parseErr) {
          throw makeExtractionError(
            'The timetable extraction returned an unreadable response. Please try again.',
            502,
            { name: 'UnparseableModelResponse' }
          );
        }
        console.log(`✅ Timetable extracted via ${model}${modelIndex > 0 ? ` (fallback ${modelIndex})` : ''}`);
        return parsed;
      } catch (err) {
        // Errors we created ourselves (already classified) must not be re-retried or re-wrapped.
        if (err && err.httpStatus && err.underlying) throw err;

        lastError = err;

        // 429 = THIS model's quota/rate limit. Its quota is independent per model,
        // so advance to the next model instead of retrying the same one.
        if (err.status === 429) {
          if (!isLastModel) {
            console.log(`⚠️ ${model} quota/rate limited (429). Trying next model in chain...`);
            break;
          }
          break; // last model → classify as 429 below
        }

        // A per-attempt timeout is an attempt-level failure, not a permanent
        // one: the model may just be slow, and a different chain model may be
        // faster. Treat it like 503 — advance to the next model instead of
        // failing the whole upload. (Retrying the same model is skipped: it
        // already had a full, fair 90-second budget.) Historical note: the
        // 60s cap aborted attempts that were about to succeed — a real 3.6
        // extraction observed 58.5s.
        if (isTimeoutError(err) && !isLastModel) {
          console.log(`⚠️ ${model} timed out. Trying next model in chain...`);
          break;
        }

        // Non-retryable (400 bad image, 401/403 key issues, unexpected) — fail
        // fast; these are request/key-level, not model-capacity. Log the
        // provider's own reason (status + message head; never contains the
        // API key) so Render logs show WHY instead of only a bare 400.
        if (!isRetryableError(err)) {
          console.log(`⚠️ ${model} rejected the request (status=${err.status || 'unknown'}). Failing fast.`);
          console.log(`   ↳ provider: ${err.name || 'Error'}: ${String(err.message || '').slice(0, 300)}`);
          throw classifyExtractionError(err);
        }

        // Retryable (503 / network): backoff within this model, then advance.
        if (attempt < MAX_ATTEMPTS) {
          console.log(`⚠️ Gemini transient error on ${model} (status=${err.status || 'network'}, attempt ${attempt}/${MAX_ATTEMPTS}). Retrying after backoff...`);
          // ONE diagnostic line (name + message head; provider payloads occasionally
          // bury the real cause in err.message).
          console.log(`   ↳ diagnostic: ${err.name || 'Error'}: ${String(err.message || '').slice(0, 160)}`);
          await sleepWithJitter(attempt);
          continue;
        }
        if (!isLastModel) {
          console.log(`⚠️ ${model} still unavailable after ${MAX_ATTEMPTS} attempts. Trying next model in chain...`);
        }
        break;
      }
    }
  }

  throw classifyExtractionError(lastError || new Error('Unknown extraction failure'));
}

module.exports = { extractRawTimetable };

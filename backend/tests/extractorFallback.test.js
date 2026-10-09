// Mocked extractor fallback tests — no network, no Gemini quota.
// Mocks @google/genai via require-cache injection and forces the image lean
// to fall back to raw bytes (child_process stubbed). Run: node ./tests/extractorFallback.test.js
process.env.SYNCO_NO_BACKOFF = '1';
process.env.GEMINI_API_KEY = 'test-dummy-key-never-logged';

const path = require('path');
const fs = require('fs');
const os = require('os');
const Module = require('module');

// ── Mock @google/genai before the extractor loads it ─────────
let script = [];   // actions consumed in order
let callLog = [];  // model names per generateContent call
const VALID = JSON.stringify({
  gridEntries: [{ day: 'Monday', startTime: '09:00', endTime: '10:00', rawText: 'DC' }],
  referenceTable: [{ code: '22ET51', subject: 'Digital Communication', initials: 'P' }]
});

function mockResponse(action) {
  if (action.text !== undefined) return { text: action.text };
  if (action.noCandidates) return { text: undefined, candidates: undefined };
  if (action.emptyParts) return { text: undefined, candidates: [{ content: { parts: [] } }] };
  if (action.json !== undefined) return { text: JSON.stringify(action.json) };
  throw new Error('bad mock action');
}

const genaiPath = require.resolve('@google/genai', { paths: [path.join(__dirname, '..')] });
require.cache[genaiPath] = {
  id: genaiPath, filename: genaiPath, loaded: true,
  exports: {
    GoogleGenAI: class {
      constructor() {}
      models = {
        generateContent: async (cfg) => {
          callLog.push(cfg.model);
          const action = script.shift();
          if (!action) throw new Error('mock script exhausted');
          if (action.throwErr) {
            const e = new Error(action.throwErr.message || 'mock');
            e.status = action.throwErr.status;
            e.name = action.throwErr.name || 'ApiError';
            if (action.throwErr.code) e.code = action.throwErr.code;
            throw e;
          }
          return mockResponse(action);
        }
      }
    },
    Type: { OBJECT: 'o', ARRAY: 'a', STRING: 's', BOOLEAN: 'b' }
  }
};

// ── Force lean fallback (no sips outside macOS) ──────────────
const childProcess = require('child_process');
const realExecFile = childProcess.execFile;
childProcess.execFile = (a, b, c, cb) => cb(new Error('no sips in tests'));

// ── Capture logs to prove secrets never leak ─────────────────
const logs = [];
const realLog = console.log;
console.log = (...a) => { logs.push(a.map(String).join(' ')); };

const { extractRawTimetable } = require('../services/timetableExtractor');

const img = path.join(os.tmpdir(), `synco-test-img-${Date.now()}.jpg`);
fs.writeFileSync(img, Buffer.from([0xff, 0xd8, 0xff, 0xd9]));

const results = [];
const check = (name, cond) => results.push([cond ? 'PASS' : 'FAIL', name]);
const err503 = { throwErr: { status: 503, message: 'high demand' } };

async function run() {
  // T1: primary 503 x3 -> fallback success (no quota burned on retries elsewhere)
  script = [err503, err503, err503, { text: VALID }]; callLog = [];
  let out = await extractRawTimetable(img);
  check('T1 fallback success after 503-out', !!out.gridEntries && out.gridEntries.length === 1);
  check('T1 3 calls on 3.6 + 1 on 3.5', callLog.length === 4 &&
    callLog.slice(0, 3).every(m => m === 'gemini-3.6-flash') && callLog[3] === 'gemini-3.5-flash');

  // T2: malformed JSON on model 1 advances (no same-model retry), model 2 wins
  script = [{ text: 'not json{{{' }, { text: VALID }]; callLog = [];
  out = await extractRawTimetable(img);
  check('T2 malformed advances to success', !!out.gridEntries);
  check('T2 exactly 2 calls, one per model', callLog.length === 2 &&
    callLog[0] === 'gemini-3.6-flash' && callLog[1] === 'gemini-3.5-flash');

  // T3: 200 with empty parts (live fallback-pool shape) advances
  script = [{ emptyParts: true }, { text: VALID }]; callLog = [];
  out = await extractRawTimetable(img);
  check('T3 empty-parts advances to success', !!out.gridEntries);
  check('T3 advanced past model 1', callLog[1] === 'gemini-3.5-flash');

  // T4: valid JSON but empty grid is rejected as a miss, next model wins
  script = [{ json: { gridEntries: [], referenceTable: [] } }, { text: VALID }]; callLog = [];
  out = await extractRawTimetable(img);
  check('T4 empty grid advances to success', !!out.gridEntries && out.gridEntries.length === 1);

  // T5: missing API key throws before any HTTP call
  const savedKey = process.env.GEMINI_API_KEY;
  delete process.env.GEMINI_API_KEY;
  script = [{ text: VALID }]; callLog = [];
  let e = null;
  try { await extractRawTimetable(img); } catch (err) { e = err; }
  check('T5 missing key throws 502 without HTTP', e && e.httpStatus === 502 && callLog.length === 0);
  process.env.GEMINI_API_KEY = savedKey;

  // T6: provider 403 (bad key) fails fast: 1 call, no advance, no retry
  script = [{ throwErr: { status: 403, message: 'API_KEY_INVALID' } }, { text: VALID }]; callLog = [];
  e = null;
  try { await extractRawTimetable(img); } catch (err) { e = err; }
  check('T6 403 fails fast as 502 misconfigured', e && e.httpStatus === 502 && /misconfigured/.test(e.message));
  check('T6 exactly 1 call', callLog.length === 1);

  // T7: all models 503-out -> 503 high-demand error, 15 bounded calls
  script = Array.from({ length: 15 }, () => err503); callLog = [];
  e = null;
  try { await extractRawTimetable(img); } catch (err) { e = err; }
  check('T7 all-503 throws 503', e && e.httpStatus === 503 && /high demand/.test(e.message));
  check('T7 bounded at 15 calls', callLog.length === 15);

  // T8: all models empty -> 502 unreadable (not a hang, not a crash)
  script = Array.from({ length: 5 }, () => ({ emptyParts: true })); callLog = [];
  e = null;
  try { await extractRawTimetable(img); } catch (err) { e = err; }
  check('T8 all-empty throws 502 unreadable', e && e.httpStatus === 502 && /unreadable/.test(e.message));
  check('T8 tried all 5 models once each', callLog.length === 5);

  // T9: secrets never logged
  check('T9 dummy key absent from all logs', !logs.join('\n').includes('test-dummy-key-never-logged'));

  childProcess.execFile = realExecFile;
  console.log = realLog;
  fs.unlinkSync(img);
  let fails = 0;
  for (const [s, n] of results) { realLog(`${s} — ${n}`); if (s === 'FAIL') fails++; }
  realLog(`\nEXTRACTOR FALLBACK OFFLINE: ${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
}
run().catch(e => { console.log = realLog; realLog('HARNESS ERROR', e); process.exit(2); });

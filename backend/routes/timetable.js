const router = require('express').Router();
const multer = require('multer');
const path   = require('path');
const fs     = require('fs');
const auth   = require('../middleware/auth');
const Slot   = require('../models/Slot');
const { extractRawTimetable } = require('../services/timetableExtractor');
const { normalizeTimetableData, normalizeTime } = require('../services/timetableNormalizer');
const { resolveBatchView } = require('../services/batchView');

// ── MULTER SETUP ──────────────────────────────────────────
// Absolute destination (cwd-independent) + sanitized filenames so a hostile
// originalname can't traverse paths. Temp files are deleted after extraction.
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
try { fs.mkdirSync(UPLOAD_DIR, { recursive: true }); } catch (e) { /* ignore */ }
function sanitizeName(name) {
  return path.basename(String(name || 'timetable'))
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .slice(0, 100) || 'timetable';
}
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename:    (req, file, cb) => cb(null, `${Date.now()}-${sanitizeName(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg','image/png','image/jpg','image/webp'];
    allowed.includes(file.mimetype) ? cb(null, true) : cb(new Error('Images only'));
  }
});

// Helper for safe file cleanup
function safeUnlink(filePath) {
  if (filePath && fs.existsSync(filePath)) {
    try { fs.unlinkSync(filePath); } catch (e) { /* ignore */ }
  }
}

// Helper to get current HH:MM in Asia/Kolkata
function getCurrentKolkataTime() {
  const now = new Date();
  const options = { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false };
  const parts = new Intl.DateTimeFormat('en-GB', options).formatToParts(now);
  let hour = '00', minute = '00';
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value.padStart(2, '0');
    if (p.type === 'minute') minute = p.value.padStart(2, '0');
  }
  const dayName = now.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  return { timeStr: `${hour}:${minute}`, dayName };
}

// ── UPLOAD + EXTRACT PREVIEW ──────────────────────────────
// POST /api/timetable/upload
// Extracts timetable via Gemini Vision and returns PREVIEW data (does not modify DB yet)
router.post('/upload', auth, upload.single('timetable'), async (req, res) => {
  let filePath = null;
  try {
    if (!req.file) return res.status(400).json({ message: 'No image uploaded' });
    filePath = req.file.path;

    // 1. Vision AI extraction
    const rawData = await extractRawTimetable(filePath);

    // 2. Deterministic normalization & validation
    const normalized = normalizeTimetableData(rawData);

    // Clean up uploaded file
    safeUnlink(filePath);

    res.json({
      message: `Successfully extracted ${normalized.slots.length} entries for review`,
      preview: true,
      slots: normalized.slots,
      notes: normalized.notes,
      uncertainEntries: normalized.uncertainEntries
    });

  } catch (err) {
    console.error('Upload error:', err.message, '| underlying:', JSON.stringify(err.underlying || null));
    safeUnlink(filePath);
    // The extractor returns pre-classified, user-friendly errors with a safe
    // HTTP status on err.httpStatus. For anything unexpected, never surface
    // raw err.message (it can contain provider JSON) — send a generic message.
    const status = typeof err.httpStatus === 'number' ? err.httpStatus : 500;
    const message = err.httpStatus
      ? err.message
      : 'Timetable extraction failed. Please try again, or add your slots manually.';
    res.status(status).json({ message });
  }
});

// ── CONFIRM AND SAVE SLOTS ───────────────────────────────
// POST /api/timetable/confirm
// Saves user-reviewed and finalized slots to MongoDB
router.post('/confirm', auth, async (req, res) => {
  try {
    const { slots } = req.body;
    if (!Array.isArray(slots)) {
      return res.status(400).json({ message: 'Invalid slots data payload' });
    }

    // Delete old slots for this user
    await Slot.deleteMany({ userId: req.userId });

    // Save user-reviewed slots to MongoDB
    const slotsToSave = slots.map(s => ({
      userId:          req.userId,
      subject:         s.subject || 'Untitled',
      day:             s.day,
      startTime:       s.startTime,
      endTime:         s.endTime,
      code:            s.code || '',
      type:            s.type || 'class',
      faculty:         s.faculty || '',
      room:            s.room || '',
      note:            s.note || '',
      batch:           s.batch || '',
      selectedBatch:   s.selectedBatch || s.batch || '',
      parallelLabs:    Array.isArray(s.parallelLabs)
        ? s.parallelLabs.map(l => ({
            subject: l.subject || '',
            code:    l.code || '',
            batch:   l.batch || '',
            faculty: l.faculty || '',
            room:    l.room || ''
          }))
        : [],
      isUncertain:     !!s.isUncertain,
      uncertainReason: s.uncertainReason || ''
    }));

    const savedSlots = await Slot.insertMany(slotsToSave);

    res.status(201).json({
      message: `Successfully saved ${savedSlots.length} schedule slots`,
      slots: savedSlots
    });

  } catch (err) {
    console.error('Confirm save error:', err);
    res.status(500).json({ message: 'Server error saving timetable slots' });
  }
});

// ── GET MY SLOTS ──────────────────────────────────────────
// GET /api/timetable/my
router.get('/my', auth, async (req, res) => {
  try {
    const slots = await Slot.find({ userId: req.userId }).sort({ day: 1, startTime: 1 });
    res.json(slots);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── CURRENT STATUS ────────────────────────────────────────
// GET /api/timetable/status
// Am I in class right now or free?
router.get('/status', auth, async (req, res) => {
  try {
    const { timeStr, dayName } = getCurrentKolkataTime();

    const todaySlots  = await Slot.find({ userId: req.userId, day: dayName });
    // Filter active class/lab slots (ignore breaks)
    const activeSlots = todaySlots.filter(s => s.type !== 'break');
    
    // Batch-aware: resolve parallelLabs to the student's own batch so a C2
    // student's status reflects THEIR lab, not the C1 headline.
    const viewOf = (s) => ({ ...resolveBatchView(s), startTime: s.startTime, endTime: s.endTime, type: s.type, note: s.note });

    const currentSlotObj = activeSlots.find(s => s.startTime <= timeStr && timeStr < s.endTime);
    const nextObj        = activeSlots
      .filter(s => s.startTime > timeStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] || null;

    const currentSlot = currentSlotObj ? viewOf(currentSlotObj) : null;
    const nextClass   = nextObj ? viewOf(nextObj) : null;

    res.json({
      currentTime:  timeStr,
      day:          dayName,
      inClass:      !!currentSlot,
      currentClass: currentSlot,
      nextClass,
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── FRIEND'S STATUS ───────────────────────────────────────
// GET /api/timetable/status/:userId
router.get('/status/:userId', auth, async (req, res) => {
  try {
    const { timeStr, dayName } = getCurrentKolkataTime();

    const todaySlots  = await Slot.find({ userId: req.params.userId, day: dayName });
    const activeSlots = todaySlots.filter(s => s.type !== 'break');

    // Batch-aware (see /status above)
    const viewOf = (s) => ({ ...resolveBatchView(s), startTime: s.startTime, endTime: s.endTime, type: s.type, note: s.note });

    const currentSlotObj = activeSlots.find(s => s.startTime <= timeStr && timeStr < s.endTime);
    const nextObj        = activeSlots
      .filter(s => s.startTime > timeStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] || null;

    const currentSlot = currentSlotObj ? viewOf(currentSlotObj) : null;
    const nextClass   = nextObj ? viewOf(nextObj) : null;

    res.json({
      inClass:      !!currentSlot,
      currentClass: currentSlot,
      nextClass,
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── SHARED SLOT-PAYLOAD HELPERS (add + edit use the same rules) ──
const SLOT_TYPES = ['class', 'lab', 'break', 'activity', 'proctoring', 'project']; // mirrors models/Slot.js enum

// Validate required fields + normalize times; returns { error } or { value }
// NOTE: the shared normalizeTime() deliberately echoes unparseable input
// (Gemini-output tolerance), so the route layer enforces strict HH:MM itself.
function validateSlotPayload(body) {
  const { subject, day, startTime, endTime, type } = body;
  if (!subject || !String(subject).trim() || !day || !startTime || !endTime)
    return { error: 'Subject, day, start and end time are required' };
  if (type && !SLOT_TYPES.includes(type))
    return { error: 'Invalid slot type' };
  const TIME_RE = /^\d{1,2}:\d{2}$/;
  if (!TIME_RE.test(String(startTime).trim()) || !TIME_RE.test(String(endTime).trim()))
    return { error: 'Start and end time must look like HH:MM (e.g. 09:00)' };
  const normStart = normalizeTime(startTime);
  const normEnd   = normalizeTime(endTime);
  return { value: { startTime: normStart, endTime: normEnd } };
}

// ── ADD SLOT MANUALLY ─────────────────────────────────────
// POST /api/timetable/slot
router.post('/slot', auth, async (req, res) => {
  try {
    const { subject, day, code, type, faculty, room, note } = req.body;
    const check = validateSlotPayload(req.body);
    if (check.error) return res.status(400).json({ message: check.error });

    const slot = await Slot.create({
      userId: req.userId,
      subject,
      day,
      startTime: check.value.startTime,
      endTime: check.value.endTime,
      code: code || '',
      type: type || 'class',
      faculty: faculty || '',
      room: room || '',
      note: note || ''
    });

    res.status(201).json(slot);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── UPDATE A SLOT ─────────────────────────────────────────
// PUT /api/timetable/slot/:id
// Phase 2 preservation: the update object is built ONLY from fields present in
// the request body. Absent fields are omitted entirely — never written as
// undefined/null — so parallelLabs, selectedBatch and batch on a lab slot can
// never be erased by an unrelated edit (e.g. changing the room).
router.put('/slot/:id', auth, async (req, res) => {
  try {
    const check = validateSlotPayload(req.body);
    if (check.error) return res.status(400).json({ message: check.error });

    const { subject, day, code, type, faculty, room, note } = req.body;
    const update = {
      subject,
      day,
      startTime: check.value.startTime,
      endTime: check.value.endTime,
      code,
      type,
      faculty,
      room,
      note
    };
    // Strip absent fields so the DB keeps whatever the slot already had.
    for (const k of Object.keys(update)) {
      if (update[k] === undefined) delete update[k];
    }

    const slot = await Slot.findOneAndUpdate(
      { _id: req.params.id, userId: req.userId },
      update,
      { new: true, runValidators: true }
    );
    if (!slot) return res.status(404).json({ message: 'Slot not found' });
    res.json(slot);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE A SLOT ─────────────────────────────────────────
// DELETE /api/timetable/slot/:id
router.delete('/slot/:id', auth, async (req, res) => {
  try {
    await Slot.findOneAndDelete({ _id: req.params.id, userId: req.userId });
    res.json({ message: 'Slot deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

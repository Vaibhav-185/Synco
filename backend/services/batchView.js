// Batch-aware slot view resolution, shared by the status endpoints and the
// notification scheduler. A lab slot may cover C1/C2/C3 via parallelLabs;
// the student's own batch lives in selectedBatch (fallback: slot.batch).
// Nothing is hardcoded — everything derives from persisted timetable data.
function resolveBatchView(slot) {
  if (!slot) return null;
  // Mongoose docs: use .toObject so spread works the same for docs & plain objects
  const s = typeof slot.toObject === 'function' ? slot.toObject() : slot;

  const chosen = String(s.selectedBatch || s.batch || '').toUpperCase();
  if (Array.isArray(s.parallelLabs) && s.parallelLabs.length && chosen) {
    const matched = s.parallelLabs.find(
      l => String(l.batch || '').toUpperCase() === chosen
    );
    if (matched) {
      return {
        subject: matched.subject || s.subject,
        code:    matched.code    || s.code,
        faculty: matched.faculty || s.faculty,
        room:    matched.room    || s.room,
        batch:   matched.batch   || s.batch
      };
    }
  }
  return { subject: s.subject, code: s.code, faculty: s.faculty, room: s.room, batch: s.batch };
}

module.exports = { resolveBatchView };

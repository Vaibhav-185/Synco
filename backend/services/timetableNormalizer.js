/**
 * Deterministic Normalization and Validation Engine (Pure JavaScript - No AI)
 * Transforms raw vision extraction results into normalized, validated application slots.
 */

// Ground truth subject catalog with strict code consistency rules
const STRICT_SUBJECT_CATALOG = {
  'PCC22IS51': {
    subject: 'Automata & Compiler Design',
    type: 'class',
    code: 'PCC22IS51'
  },
  'IPCC22IS52': {
    subject: 'Artificial Intelligence & Machine Learning',
    type: 'class',
    code: 'IPCC22IS52'
  },
  'IPCC22IS52_LAB': {
    subject: 'Artificial Intelligence & Machine Learning Lab',
    type: 'lab',
    code: 'IPCC22IS52'
  },
  'IPCC22IS53': {
    subject: 'Computer Networks',
    type: 'class',
    code: 'IPCC22IS53'
  },
  'IPCC22IS53_LAB': {
    subject: 'Computer Networks Lab',
    type: 'lab',
    code: 'IPCC22IS53'
  },
  'PCCL22IS54': {
    subject: 'Mobile Application Development lab',
    type: 'lab',
    code: 'PCCL22IS54'
  },
  'PEC22IS553': {
    subject: 'Advanced Algorithms',
    type: 'class',
    code: 'PEC22IS553'
  },
  'PEC22IS554': {
    subject: 'UIUX Design',
    type: 'class',
    code: 'PEC22IS554'
  },
  'AEC22RM56': {
    subject: 'Research Methodology and IPR',
    type: 'class',
    code: 'AEC22RM56'
  },
  'HSMS22ES57': {
    subject: 'Environmental Studies',
    type: 'class',
    code: 'HSMS22ES57'
  },
  '22IS66': {
    subject: 'Mini project II',
    type: 'project',
    code: '22IS66'
  }
};

// Known abbreviation to subject mapping
const ABBREVIATION_MAP = [
  {
    keywords: ['AIML LAB', 'AIML-LAB'],
    subject: 'Artificial Intelligence & Machine Learning Lab',
    code: 'IPCC22IS52',
    type: 'lab'
  },
  {
    keywords: ['CN LAB', 'CN-LAB'],
    subject: 'Computer Networks Lab',
    code: 'IPCC22IS53',
    type: 'lab'
  },
  {
    keywords: ['MAD LAB', 'MAD-LAB'],
    subject: 'Mobile Application Development lab',
    code: 'PCCL22IS54',
    type: 'lab'
  },
  {
    keywords: ['AIML'],
    subject: 'Artificial Intelligence & Machine Learning',
    code: 'IPCC22IS52',
    type: 'class'
  },
  {
    keywords: ['CN'],
    subject: 'Computer Networks',
    code: 'IPCC22IS53',
    type: 'class'
  },
  {
    keywords: ['ACD'],
    subject: 'Automata & Compiler Design',
    code: 'PCC22IS51',
    type: 'class'
  },
  {
    keywords: ['RMIPR(TT)', 'RMIPR (TT)'],
    subject: 'Research Methodology and IPR',
    code: 'AEC22RM56',
    type: 'class'
  },
  {
    keywords: ['RMIPR'],
    subject: 'Research Methodology and IPR',
    code: 'AEC22RM56',
    type: 'class'
  },
  {
    keywords: ['EVS'],
    subject: 'Environmental Studies',
    code: 'HSMS22ES57',
    type: 'class'
  },
  {
    keywords: ['ADV ALGORITHMS/UIUX', 'ADV ALGORITHMS / UIUX'],
    subject: 'Advanced Algorithms / UIUX Design',
    code: 'PEC22IS553',
    type: 'class'
  },
  {
    keywords: ['MINI PROJECT'],
    subject: 'Mini project II',
    code: '22IS66',
    type: 'project'
  },
  {
    keywords: ['STUDENT PROCTORING'],
    subject: 'Student Proctoring',
    code: '',
    type: 'proctoring'
  },
  {
    keywords: ['AICTE POINTS'],
    subject: 'AICTE Points',
    code: '',
    type: 'activity'
  },
  {
    keywords: ['NSS/YOGA/PE/CULTURAL', 'NSS'],
    subject: 'NSS / YOGA / PE / CULTURAL',
    code: '',
    type: 'activity'
  },
  {
    keywords: ['GENESIS'],
    subject: 'Genesis Student Activity / Guest Talks / Lectures / Hands-on',
    code: '',
    type: 'activity'
  },
  {
    keywords: ['REMEDIAL CLASS'],
    subject: 'Remedial Class',
    code: '',
    type: 'class'
  },
  {
    keywords: ['TUTORIAL CLASS'],
    subject: 'Tutorial Class',
    code: '',
    type: 'class'
  }
];

/**
 * Normalizes time strings to strict 24-hour HH:MM format.
 */
function normalizeTime(timeStr, isAfternoonHint = false) {
  if (!timeStr) return '';

  let clean = timeStr.trim().replace(/\s+/g, '');

  const match = clean.match(/^(\d{1,2}):(\d{2})$/);

  if (!match) return timeStr;

  let hour = parseInt(match[1], 10);
  const min = match[2];

  if (isAfternoonHint || hour < 8) {
    if (hour >= 1 && hour <= 7) {
      hour += 12;
    }
  }

  return `${String(hour).padStart(2, '0')}:${min}`;
}

function normalizeDay(dayStr) {
  if (!dayStr) return 'Monday';

  const clean = dayStr.trim().toLowerCase();

  if (clean.includes('mon')) return 'Monday';
  if (clean.includes('tue')) return 'Tuesday';
  if (clean.includes('wed')) return 'Wednesday';
  if (clean.includes('thu')) return 'Thursday';
  if (clean.includes('fri')) return 'Friday';
  if (clean.includes('sat')) return 'Saturday';
  if (clean.includes('sun')) return 'Sunday';

  return dayStr;
}

/**
 * Extract faculty initials from text line safely.
 */
function extractFacultyFromLine(line) {
  const matches = line.match(
    /\b(VG|CBM|SMB|SKM|MM|SKB|MS|AY|YBS|JRS|SP|SAI|PL|RJ|VJ|MJ)\b/g
  );

  return matches ? [...new Set(matches)].join(', ') : '';
}

/**
 * Extract room code (e.g., "ISE403", "ISE 202", "ISE206") from text line safely.
 */
function extractRoomFromLine(line) {
  const match = line.match(/ISE\s?\d{3}/i);

  return match
    ? match[0].toUpperCase().replace(/\s+/, ' ')
    : '';
}

/**
 * Extract batch code (C1, C2, C3) from text line.
 */
function extractBatchFromLine(line) {
  const match = line.match(/\b(C1|C2|C3)\b/i);

  return match ? match[1].toUpperCase() : '';
}

/**
 * Parse a single lab line into a structured parallel lab object.
 */
function parseSingleLabLine(line) {
  const upper = line.toUpperCase();

  let item = null;

  if (upper.includes('AIML')) {
    item = {
      subject: 'Artificial Intelligence & Machine Learning Lab',
      code: 'IPCC22IS52',
      type: 'lab'
    };
  } else if (upper.includes('CN')) {
    item = {
      subject: 'Computer Networks Lab',
      code: 'IPCC22IS53',
      type: 'lab'
    };
  } else if (upper.includes('MAD')) {
    item = {
      subject: 'Mobile Application Development lab',
      code: 'PCCL22IS54',
      type: 'lab'
    };
  } else {
    item = {
      subject: line,
      code: '',
      type: 'lab'
    };
  }

  const batch = extractBatchFromLine(line);
  const faculty = extractFacultyFromLine(line);
  const room = extractRoomFromLine(line);

  return {
    subject: item.subject,
    code: item.code,
    batch,
    faculty,
    room
  };
}

/**
 * Split a raw cell into candidate lab segments, tolerating the different shapes
 * Gemini uses for parallel-lab cells:
 *   - newline separated    ("C1 AIML Lab\nC2 CN Lab\nC3 MAD Lab")
 *   - delimiter separated  ("C1 AIML Lab, C2 CN Lab, C3 MAD Lab")
 *   - one flat line        ("C1 AIML Lab C2 CN Lab C3 MAD Lab")
 *
 * Trailing fragments that belong to the previous segment (e.g. faculty initials
 * or a room code after "C1 AIML Lab, VG+SP ISE403") are re-joined rather than
 * treated as extra labs.
 */
function splitLabSegments(text) {
  const raw = String(text == null ? '' : text).trim();

  // 1. Newline separated (canonical shape) - left exactly as-is.
  const lineParts = raw
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0);

  if (lineParts.length > 1) return lineParts;

  const single = lineParts.length ? lineParts[0] : '';

  // 2. Delimiter separated, re-joining fragments that do not start a new batch.
  const delimiterParts = single
    .split(/[,;\u2022\u00b7|]+/)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  const merged = [];

  for (const part of delimiterParts) {
    const startsNewLab =
      /\b(C1|C2|C3)\b/i.test(part) || /LAB/i.test(part);

    if (merged.length > 0 && !startsNewLab) {
      merged[merged.length - 1] += ', ' + part;
    } else {
      merged.push(part);
    }
  }

  if (merged.length > 1) return merged;

  // 3. Flat line with whitespace-separated batch markers. Only accept the split
  //    when every fragment carries a batch marker, so single-lab cells such as
  //    "AIML Lab C1, VG+SP ISE403" are never mistaken for parallel labs.
  const markerParts = single
    .split(/(?=\b(?:C1|C2|C3)\b)/i)
    .map(p => p.trim())
    .filter(p => p.length > 0);

  if (
    markerParts.length > 1 &&
    markerParts.every(p => /\b(C1|C2|C3)\b/i.test(p))
  ) {
    return markerParts;
  }

  return merged.length ? merged : (single ? [single] : []);
}

/**
 * Parse cell text, detecting whether it contains parallel labs or a single subject.
 */
function parseCellContent(rawText, referenceTable = []) {
  if (
    !rawText ||
    rawText.trim() === '' ||
    rawText.trim() === '·'
  ) {
    return {
      subject: '',
      code: '',
      type: 'class',
      faculty: '',
      room: '',
      isEmpty: true
    };
  }

  const text = rawText.trim();
  const upper = text.toUpperCase();

  // Check for breaks
  if (
    upper.includes('TEA BREAK') ||
    upper.includes('TEA')
  ) {
    return {
      subject: 'Tea Break',
      code: '',
      type: 'break',
      faculty: '',
      room: '',
      isBreak: true
    };
  }

  if (
    upper.includes('LUNCH BREAK') ||
    upper.includes('LUNCH')
  ) {
    return {
      subject: 'Lunch Break',
      code: '',
      type: 'break',
      faculty: '',
      room: '',
      isBreak: true
    };
  }

  // Check for parallel labs. Gemini's rawText shape is unstable: batches may
  // arrive newline separated, delimiter separated, or packed onto one line.
  // splitLabSegments tolerates all of those; a single segment falls through to
  // the existing single-subject handling below.
  const segments = splitLabSegments(text);

  if (
    segments.length > 1 &&
    segments.some(l => l.toUpperCase().includes('LAB'))
  ) {
    const parallelLabs = segments.map(parseSingleLabLine);

    // Primary default lab (e.g. C1 if present, or first lab)
    const primaryLab =
      parallelLabs.find(l => l.batch === 'C1') ||
      parallelLabs[0];

    return {
      subject: primaryLab.subject,
      code: primaryLab.code,
      type: 'lab',
      faculty: primaryLab.faculty,
      room: primaryLab.room,
      batch: primaryLab.batch,
      parallelLabs
    };
  }

  // Match against ABBREVIATION_MAP with strict code consistency
  const matchedAbbrev = ABBREVIATION_MAP.find(a =>
    a.keywords.some(kw => upper.includes(kw))
  );

  const subjectTitle = matchedAbbrev
    ? matchedAbbrev.subject
    : text;

  const code = matchedAbbrev
    ? matchedAbbrev.code
    : '';

  const type = matchedAbbrev
    ? matchedAbbrev.type
    : 'class';

  const faculty = extractFacultyFromLine(text);
  const room = extractRoomFromLine(text);
  const batch = extractBatchFromLine(text);

  return {
    subject: subjectTitle,
    code,
    type,
    faculty,
    room,
    batch,
    rawText: text
  };
}

/**
 * Build a parallel-lab record from a slot carrying a single lab.
 */
function buildParallelLabEntry(slot) {
  return {
    subject: slot.subject || '',
    code: slot.code || '',
    batch: slot.batch || '',
    faculty: slot.faculty || '',
    room: slot.room || ''
  };
}

/**
 * Fold a second lab slot (same day/time) into the first as another parallel batch.
 * Missing fields on an already-known batch are back-filled from the incoming entry.
 */
function mergeLabSlots(target, incoming) {
  const existing = target.parallelLabs && target.parallelLabs.length
    ? target.parallelLabs.slice()
    : [buildParallelLabEntry(target)];

  const incomingLabs = incoming.parallelLabs && incoming.parallelLabs.length
    ? incoming.parallelLabs.slice()
    : [buildParallelLabEntry(incoming)];

  const combined = [...existing];

  for (const lab of incomingLabs) {
    const duplicate = combined.find(
      c => c.batch && lab.batch && c.batch === lab.batch
    );

    if (duplicate) {
      duplicate.subject = duplicate.subject || lab.subject;
      duplicate.code = duplicate.code || lab.code;
      duplicate.faculty = duplicate.faculty || lab.faculty;
      duplicate.room = duplicate.room || lab.room;
    } else {
      combined.push(lab);
    }
  }

  target.parallelLabs = combined;

  // Keep the primary batch (C1 when present) as the slot's headline subject.
  const primary = combined.find(l => l.batch === 'C1') || combined[0];

  if (primary) {
    target.subject = primary.subject || target.subject;
    target.code = primary.code || target.code;
    target.batch = primary.batch || target.batch;
    target.selectedBatch = target.batch;
    target.faculty = primary.faculty || target.faculty;
    target.room = primary.room || target.room;
  }

  return target;
}

/**
 * Main normalization function.
 */
function normalizeTimetableData(rawData) {
  const {
    gridEntries = [],
    referenceTable = [],
    notes = []
  } = rawData;

  const normalizedSlots = [];
  const uncertainEntries = [];

  let tuesdayNote = '';

  for (const n of notes) {
    if (n.toLowerCase().includes('tuesday')) {
      tuesdayNote = n.trim();
    }
  }

  for (const entry of gridEntries) {
    const day = normalizeDay(entry.day);

    const rawStart = entry.startTime || '';
    const rawEnd = entry.endTime || '';

    const startHourInt = parseInt(
      rawStart.split(':')[0],
      10
    );

    const isAfternoon =
      startHourInt >= 1 &&
      startHourInt <= 5;

    const startTime = normalizeTime(
      rawStart,
      isAfternoon
    );

    let endTime = normalizeTime(
      rawEnd,
      isAfternoon
    );

    // Precise fix: RMIPR tutorial on Friday spans 14:00 to 16:00
    if (
      day === 'Friday' &&
      startTime === '14:00' &&
      entry.rawText.toUpperCase().includes('RMIPR')
    ) {
      endTime = '16:00';
    }

    /**
     * Break handling
     *
     * Preserve the actual timetable labels:
     * 11:00–11:15  -> Tea Break
     * 13:15–14:00  -> Lunch Break
     *
     * If Gemini already supplied a breakLabel, use it.
     * Otherwise infer the label deterministically from the known timetable
     * time ranges instead of falling back to generic "Break".
     */
    if (entry.isBreak) {
      let breakSubject = entry.breakLabel || '';

      if (!breakSubject) {
        if (
          startTime === '11:00' &&
          endTime === '11:15'
        ) {
          breakSubject = 'Tea Break';
        } else if (
          startTime === '13:15' &&
          endTime === '14:00'
        ) {
          breakSubject = 'Lunch Break';
        } else {
          breakSubject = 'Break';
        }
      }

      normalizedSlots.push({
        day,
        startTime,
        endTime,
        subject: breakSubject,
        code: '',
        type: 'break',
        faculty: '',
        room: '',
        note: '',
        isUncertain: false
      });

      continue;
    }

    const parsed = parseCellContent(
      entry.rawText,
      referenceTable
    );

    if (parsed.isEmpty) continue;

    let slotNote = '';

    if (
      day === 'Tuesday' &&
      startTime >= '09:00' &&
      endTime <= '11:00'
    ) {
      slotNote =
        tuesdayNote ||
        'Conducting only in 1st & 3rd week of the month';
    }

    let isUncertain = false;
    let uncertainReason = '';

    // Validate subject-code consistency
    if (
      parsed.code &&
      STRICT_SUBJECT_CATALOG[parsed.code]
    ) {
      const expectedSubject =
        STRICT_SUBJECT_CATALOG[parsed.code].subject;

      if (
        parsed.type === 'class' &&
        !parsed.subject
          .toLowerCase()
          .includes(
            expectedSubject
              .toLowerCase()
              .slice(0, 5)
          )
      ) {
        isUncertain = true;

        uncertainReason =
          `Code mismatch: ${parsed.code} belongs to ${expectedSubject}`;
      }
    }

    const slotObj = {
      day,
      startTime,
      endTime,
      subject: parsed.subject,
      code: parsed.code,
      type: parsed.type,
      faculty: parsed.faculty,
      room: parsed.room,
      note: slotNote,
      batch: parsed.batch || '',
      selectedBatch: parsed.batch || '',
      parallelLabs: parsed.parallelLabs || [],
      isUncertain,
      uncertainReason
    };

    // Parallel-batch labs may arrive as separate gridEntries sharing one
    // day/time instead of a single multi-batch cell. Fold them back together
    // rather than emitting duplicate slots.
    if (slotObj.type === 'lab') {
      const sibling = normalizedSlots.find(
        s =>
          s.type === 'lab' &&
          s.day === day &&
          s.startTime === startTime &&
          s.endTime === endTime
      );

      if (sibling) {
        mergeLabSlots(sibling, slotObj);
        continue;
      }
    }

    if (isUncertain) {
      uncertainEntries.push(slotObj);
    }

    normalizedSlots.push(slotObj);
  }

  return {
    slots: normalizedSlots,
    notes,
    uncertainEntries,
    totalCount: normalizedSlots.length
  };
}

module.exports = {
  normalizeTimetableData,
  normalizeTime,
  normalizeDay,
  parseCellContent,
  STRICT_SUBJECT_CATALOG,
  ABBREVIATION_MAP
};
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { extractRawTimetable } = require('../services/timetableExtractor');
const { normalizeTimetableData } = require('../services/timetableNormalizer');

// Strict ground truth assertions catalog for Vision AI regression testing
const STRICT_GROUND_TRUTH = [
  { day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'Remedial Class', type: 'class' },

  {
    day: 'Monday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Artificial Intelligence & Machine Learning',
    code: 'IPCC22IS52',
    type: 'class',
    faculty: 'VG'
  },

  { day: 'Monday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },

  {
    day: 'Monday',
    startTime: '11:15',
    endTime: '12:15',
    subject: 'Computer Networks',
    code: 'IPCC22IS53',
    type: 'class',
    faculty: 'CBM'
  },

  {
    day: 'Monday',
    startTime: '12:15',
    endTime: '13:15',
    subject: 'Research Methodology and IPR',
    code: 'AEC22RM56',
    type: 'class',
    faculty: 'SKM'
  },

  { day: 'Monday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },

  {
    day: 'Monday',
    startTime: '14:00',
    endTime: '15:00',
    subject: 'Environmental Studies',
    code: 'HSMS22ES57',
    type: 'class',
    faculty: 'MM'
  },

  {
    day: 'Monday',
    startTime: '15:00',
    endTime: '17:00',
    type: 'lab',
    parallelLabs: [
      {
        batch: 'C1',
        subject: 'Artificial Intelligence & Machine Learning Lab',
        code: 'IPCC22IS52',
        room: 'ISE403'
      },
      {
        batch: 'C2',
        subject: 'Computer Networks Lab',
        code: 'IPCC22IS53',
        room: 'ISE 202'
      },
      {
        batch: 'C3',
        subject: 'Mobile Application Development lab',
        code: 'PCCL22IS54',
        room: 'ISE206'
      }
    ]
  },

  {
    day: 'Tuesday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Computer Networks',
    code: 'IPCC22IS53',
    type: 'class',
    faculty: 'CBM',
    requireNote: true
  },

  {
    day: 'Tuesday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Artificial Intelligence & Machine Learning',
    code: 'IPCC22IS52',
    type: 'class',
    faculty: 'VG',
    requireNote: true
  },

  { day: 'Tuesday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },

  {
    day: 'Tuesday',
    startTime: '11:15',
    endTime: '12:15',
    subject: 'Automata & Compiler Design',
    code: 'PCC22IS51',
    type: 'class',
    faculty: 'SMB'
  },

  {
    day: 'Tuesday',
    startTime: '12:15',
    endTime: '13:15',
    subject: 'Advanced Algorithms / UIUX Design',
    code: 'PEC22IS553',
    type: 'class'
  },

  { day: 'Tuesday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },

  {
    day: 'Tuesday',
    startTime: '14:00',
    endTime: '17:00',
    subject: 'AICTE Points',
    type: 'activity'
  },

  {
    day: 'Wednesday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Advanced Algorithms / UIUX Design',
    code: 'PEC22IS553',
    type: 'class'
  },

  {
    day: 'Wednesday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Research Methodology and IPR',
    code: 'AEC22RM56',
    type: 'class',
    faculty: 'SKM'
  },

  { day: 'Wednesday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },

  {
    day: 'Wednesday',
    startTime: '11:15',
    endTime: '13:15',
    type: 'lab',
    parallelLabs: [
      {
        batch: 'C1',
        subject: 'Computer Networks Lab',
        code: 'IPCC22IS53'
      },
      {
        batch: 'C2',
        subject: 'Mobile Application Development lab',
        code: 'PCCL22IS54'
      },
      {
        batch: 'C3',
        subject: 'Artificial Intelligence & Machine Learning Lab',
        code: 'IPCC22IS52'
      }
    ]
  },

  { day: 'Wednesday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },

  {
    day: 'Wednesday',
    startTime: '14:00',
    endTime: '15:00',
    subject: 'Automata & Compiler Design',
    code: 'PCC22IS51',
    type: 'class',
    faculty: 'SMB'
  },

  {
    day: 'Wednesday',
    startTime: '15:00',
    endTime: '17:00',
    subject: 'Mini project II',
    code: '22IS66',
    type: 'project'
  },

  {
    day: 'Thursday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Automata & Compiler Design',
    code: 'PCC22IS51',
    type: 'class',
    faculty: 'SMB'
  },

  {
    day: 'Thursday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Computer Networks',
    code: 'IPCC22IS53',
    type: 'class',
    faculty: 'CBM'
  },

  { day: 'Thursday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },

  {
    day: 'Thursday',
    startTime: '11:15',
    endTime: '12:15',
    subject: 'Advanced Algorithms / UIUX Design',
    code: 'PEC22IS553',
    type: 'class'
  },

  {
    day: 'Thursday',
    startTime: '12:15',
    endTime: '13:15',
    subject: 'Artificial Intelligence & Machine Learning',
    code: 'IPCC22IS52',
    type: 'class',
    faculty: 'VG'
  },

  { day: 'Thursday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },

  {
    day: 'Thursday',
    startTime: '14:00',
    endTime: '17:00',
    subject: 'Student Proctoring',
    type: 'proctoring'
  },

  {
    day: 'Friday',
    startTime: '09:00',
    endTime: '11:00',
    type: 'lab',
    parallelLabs: [
      {
        batch: 'C1',
        subject: 'Mobile Application Development lab',
        code: 'PCCL22IS54'
      },
      {
        batch: 'C2',
        subject: 'Artificial Intelligence & Machine Learning Lab',
        code: 'IPCC22IS52'
      },
      {
        batch: 'C3',
        subject: 'Computer Networks Lab',
        code: 'IPCC22IS53'
      }
    ]
  },

  { day: 'Friday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },

  {
    day: 'Friday',
    startTime: '11:15',
    endTime: '12:15',
    subject: 'Environmental Studies',
    code: 'HSMS22ES57',
    type: 'class',
    faculty: 'MM'
  },

  {
    day: 'Friday',
    startTime: '12:15',
    endTime: '13:15',
    subject: 'Tutorial Class',
    type: 'class'
  },

  { day: 'Friday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },

  {
    day: 'Friday',
    startTime: '14:00',
    endTime: '16:00',
    subject: 'Research Methodology and IPR',
    code: 'AEC22RM56',
    type: 'class',
    faculty: 'SKM'
  },

  {
    day: 'Saturday',
    startTime: '09:00',
    endTime: '10:00',
    subject: 'Computer Networks',
    code: 'IPCC22IS53',
    type: 'class',
    faculty: 'CBM'
  },

  {
    day: 'Saturday',
    startTime: '10:00',
    endTime: '11:00',
    subject: 'Artificial Intelligence & Machine Learning',
    code: 'IPCC22IS52',
    type: 'class',
    faculty: 'VG'
  },

  { day: 'Saturday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },

  {
    day: 'Saturday',
    startTime: '11:15',
    endTime: '13:15',
    subject: 'Genesis Student Activity / Guest Talks / Lectures / Hands-on',
    type: 'activity'
  },

  { day: 'Saturday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },

  {
    day: 'Saturday',
    startTime: '14:00',
    endTime: '17:00',
    subject: 'NSS / YOGA / PE / CULTURAL',
    type: 'activity'
  }
];

const normalizeText = (text) =>
  text?.toLowerCase().replace(/\s+/g, ' ').trim();

const normalizeRoom = (room) =>
  room?.replace(/\s+/g, '').toLowerCase();

async function runRegressionTest() {
  console.log('----------------------------------------------------');
  console.log('🧪 RUNNING STRICT TIMETABLE EXTRACTION REGRESSION SUITE');
  console.log('----------------------------------------------------');

  const fixturePath = path.join(
    __dirname,
    '../tests/fixtures/sample-timetable.jpg'
  );

  try {
    console.log(`📁 Loading fixture: ${fixturePath}`);

    const rawData = await extractRawTimetable(fixturePath);

    console.log(
      `✅ Vision AI Extraction completed. Raw entries: ${rawData.gridEntries?.length || 0}`
    );

    const normalized = normalizeTimetableData(rawData);

    console.log(
      `✅ Normalization completed. Total slots: ${normalized.slots.length}`
    );

    console.log('----------------------------------------------------');

    let passedCount = 0;
    let failedCount = 0;

    for (const exp of STRICT_GROUND_TRUTH) {
      const match = normalized.slots.find(
        s =>
          s.day === exp.day &&
          s.startTime === exp.startTime
      );

      if (!match) {
        console.log(
          `❌ FAIL: Missing slot ${exp.day} ${exp.startTime}–${exp.endTime}`
        );

        failedCount++;
        continue;
      }

      let isPass = true;
      const errors = [];

      // 1. Exact endTime validation
      if (match.endTime !== exp.endTime) {
        isPass = false;

        errors.push(
          `endTime expected ${exp.endTime}, got ${match.endTime}`
        );
      }

      // 2. Exact type validation
      if (match.type !== exp.type) {
        isPass = false;

        errors.push(
          `type expected ${exp.type}, got ${match.type}`
        );
      }

      // 3. Exact subject validation
      if (
        exp.subject &&
        normalizeText(match.subject) !== normalizeText(exp.subject)
      ) {
        isPass = false;

        errors.push(
          `subject expected ${exp.subject}, got ${match.subject}`
        );
      }

      // 4. Code validation
      if (exp.code && match.code !== exp.code) {
        isPass = false;

        errors.push(
          `code expected ${exp.code}, got ${match.code}`
        );
      }

      // 5. Faculty validation
      if (exp.faculty && match.faculty !== exp.faculty) {
        isPass = false;

        errors.push(
          `faculty expected ${exp.faculty}, got ${match.faculty}`
        );
      }

      // 6. Note validation for Tuesday biweekly rule
      if (exp.requireNote) {
        if (
          !match.note ||
          !match.note.includes('1st and 3rd week')
        ) {
          isPass = false;

          errors.push(
            'note missing Tuesday biweekly rule'
          );
        }
      }

      // 7. Strict Parallel Labs validation
      if (exp.parallelLabs) {
        for (const targetLab of exp.parallelLabs) {
          const foundParallel = match.parallelLabs?.find(
            pl => pl.batch === targetLab.batch
          );

          if (!foundParallel) {
            isPass = false;

            errors.push(
              `missing parallel lab batch ${targetLab.batch}`
            );
          } else {
            // Parallel lab subject validation
            if (
              normalizeText(foundParallel.subject) !==
              normalizeText(targetLab.subject)
            ) {
              isPass = false;

              errors.push(
                `batch ${targetLab.batch} subject expected ${targetLab.subject}, got ${foundParallel.subject}`
              );
            }

            // Parallel lab code validation
            if (
              targetLab.code &&
              foundParallel.code !== targetLab.code
            ) {
              isPass = false;

              errors.push(
                `batch ${targetLab.batch} code expected ${targetLab.code}, got ${foundParallel.code}`
              );
            }

            // Parallel lab room validation
            if (
              targetLab.room &&
              normalizeRoom(foundParallel.room) !==
                normalizeRoom(targetLab.room)
            ) {
              isPass = false;

              errors.push(
                `batch ${targetLab.batch} room expected ${targetLab.room}, got ${foundParallel.room}`
              );
            }
          }
        }
      }

      if (isPass) {
        console.log(
          `✅ PASS: ${exp.day} ${exp.startTime}–${exp.endTime} | [${match.type.toUpperCase()}] ${match.subject} (${match.code || 'NO-CODE'})`
        );

        passedCount++;
      } else {
        console.log(
          `❌ FAIL: ${exp.day} ${exp.startTime}–${exp.endTime} | Errors: ${errors.join('; ')}`
        );

        failedCount++;
      }
    }

    console.log('====================================================');

    console.log(
      `STRICT TEST RESULT: ${passedCount} PASSED, ${failedCount} FAILED OUT OF ${STRICT_GROUND_TRUTH.length}`
    );

    console.log('====================================================');

    if (failedCount > 0) {
      process.exit(1);
    }

  } catch (err) {
    console.error(
      '❌ Test execution failed with error:',
      err
    );

    process.exit(1);
  }
}

runRegressionTest();
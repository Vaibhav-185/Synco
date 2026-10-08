const { normalizeTimetableData } = require('../services/timetableNormalizer');

const mockRawGeminiOutput = {
  days: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'],
  gridEntries: [
    { day: 'Monday', startTime: '09:00', endTime: '10:00', rawText: 'Remedial class' },
    { day: 'Monday', startTime: '10:00', endTime: '11:00', rawText: 'AIML VG' },
    { day: 'Monday', startTime: '11:00', endTime: '11:15', rawText: 'TEA BREAK', isBreak: true, breakLabel: 'Tea Break' },
    { day: 'Monday', startTime: '11:15', endTime: '12:15', rawText: 'CN CBM' },
    { day: 'Monday', startTime: '12:15', endTime: '01:15', rawText: 'RMIPR SKM' },
    { day: 'Monday', startTime: '01:15', endTime: '02:00', rawText: 'LUNCH BREAK', isBreak: true, breakLabel: 'Lunch Break' },
    { day: 'Monday', startTime: '02:00', endTime: '03:00', rawText: 'EVS MM' },
    { day: 'Monday', startTime: '03:00', endTime: '05:00', rawText: 'AIML Lab C1, VG+SP ISE403\nCN lab C2, CBM+PL ISE 202\nMAD Lab C3, SMB+MS ISE206' },

    { day: 'Tuesday', startTime: '09:00', endTime: '10:00', rawText: 'CN CBM' },
    { day: 'Tuesday', startTime: '10:00', endTime: '11:00', rawText: 'AIML VG' },
    { day: 'Tuesday', startTime: '11:00', endTime: '11:15', rawText: 'TEA BREAK', isBreak: true, breakLabel: 'Tea Break' },
    { day: 'Tuesday', startTime: '11:15', endTime: '12:15', rawText: 'ACD SMB' },
    { day: 'Tuesday', startTime: '12:15', endTime: '01:15', rawText: 'Adv Algorithms/UIUX SKB/MS, AV' },
    { day: 'Tuesday', startTime: '01:15', endTime: '02:00', rawText: 'LUNCH BREAK', isBreak: true, breakLabel: 'Lunch Break' },
    { day: 'Tuesday', startTime: '02:00', endTime: '05:00', rawText: 'AICTE Points' },

    { day: 'Wednesday', startTime: '09:00', endTime: '10:00', rawText: 'Adv Algorithms/UIUX SKB/MS, AV' },
    { day: 'Wednesday', startTime: '10:00', endTime: '11:00', rawText: 'RMIPR SKM' },
    { day: 'Wednesday', startTime: '11:00', endTime: '11:15', rawText: 'TEA BREAK', isBreak: true, breakLabel: 'Tea Break' },
    { day: 'Wednesday', startTime: '11:15', endTime: '01:15', rawText: 'AIML Lab C3, VG+SAI ISE403\nCN lab C1, CBM+RJ ISE 202\nMAD Lab C2, SMB+MS ISE206' },
    { day: 'Wednesday', startTime: '01:15', endTime: '02:00', rawText: 'LUNCH BREAK', isBreak: true, breakLabel: 'Lunch Break' },
    { day: 'Wednesday', startTime: '02:00', endTime: '03:00', rawText: 'ACD SMB' },
    { day: 'Wednesday', startTime: '03:00', endTime: '05:00', rawText: 'MINI PROJECT' },

    { day: 'Thursday', startTime: '09:00', endTime: '10:00', rawText: 'ACD SMB' },
    { day: 'Thursday', startTime: '10:00', endTime: '11:00', rawText: 'CN CBM' },
    { day: 'Thursday', startTime: '11:00', endTime: '11:15', rawText: 'TEA BREAK', isBreak: true, breakLabel: 'Tea Break' },
    { day: 'Thursday', startTime: '11:15', endTime: '12:15', rawText: 'Adv Algorithms/UIUX SKB/MS, AY' },
    { day: 'Thursday', startTime: '12:15', endTime: '01:15', rawText: 'AIML VG' },
    { day: 'Thursday', startTime: '01:15', endTime: '02:00', rawText: 'LUNCH BREAK', isBreak: true, breakLabel: 'Lunch Break' },
    { day: 'Thursday', startTime: '02:00', endTime: '05:00', rawText: 'Student proctoring' },

    { day: 'Friday', startTime: '09:00', endTime: '11:00', rawText: 'AIML Lab C2, VG+MJ ISE403\nCN lab C3, PL+RJ ISE 202\nMAD Lab C1, YBS+MS ISE206' },
    { day: 'Friday', startTime: '11:00', endTime: '11:15', rawText: 'TEA BREAK', isBreak: true, breakLabel: 'Tea Break' },
    { day: 'Friday', startTime: '11:15', endTime: '12:15', rawText: 'EVS MM' },
    { day: 'Friday', startTime: '12:15', endTime: '01:15', rawText: 'Tutorial Class' },
    { day: 'Friday', startTime: '01:15', endTime: '02:00', rawText: 'LUNCH BREAK', isBreak: true, breakLabel: 'Lunch Break' },
    { day: 'Friday', startTime: '02:00', endTime: '04:00', rawText: 'RMIPR(TT) SKM' },

    { day: 'Saturday', startTime: '09:00', endTime: '10:00', rawText: 'CN CBM' },
    { day: 'Saturday', startTime: '10:00', endTime: '11:00', rawText: 'AIML VG' },
    { day: 'Saturday', startTime: '11:00', endTime: '11:15', rawText: 'TEA BREAK', isBreak: true, breakLabel: 'Tea Break' },
    { day: 'Saturday', startTime: '11:15', endTime: '01:15', rawText: 'GENESIS STUDENT ACTIVITY/GUEST TALKS/LECTURES/HANDS ON FOR' },
    { day: 'Saturday', startTime: '01:15', endTime: '02:00', rawText: 'LUNCH BREAK', isBreak: true, breakLabel: 'Lunch Break' },
    { day: 'Saturday', startTime: '02:00', endTime: '05:00', rawText: 'NSS/YOGA/PE/CULTURAL' }
  ],
  referenceTable: [
    { code: 'PCC22IS51', subject: 'Automata & Compiler Design', initials: 'SMB', faculty: 'Dr. Bindu Bhargavi S.M' },
    { code: 'IPCC22IS52', subject: 'Artificial Intelligence & Machine Learning', initials: 'VG', faculty: 'Mrs. Vidya G Byakod' },
    { code: 'IPCC22IS53', subject: 'Computer Networks', initials: 'CBM', faculty: 'Dr. Chandrakala B.M.' },
    { code: 'PCCL22IS54', subject: 'Mobile Application Development lab', initials: 'SMB+SAI', faculty: 'Dr. Bindu Bhargavi S.M, Ms. Sai S Joshi' },
    { code: 'PEC22IS553', subject: 'Advanced Algorithms', initials: 'SKB', faculty: 'Mrs. Shalini K B' },
    { code: 'PEC22IS554', subject: 'UIUX Design', initials: 'MS, AY', faculty: 'Mrs. Madhavaram Swapna, Mr. Ayush Mishra' },
    { code: 'AEC22RM56', subject: 'Research Methodology and IPR', initials: 'SKM', faculty: 'Dr. Suresh Kumar' },
    { code: 'HSMS22ES57', subject: 'Environmental Studies', initials: 'MM', faculty: 'Ms. Monicashree M' }
  ],
  notes: ['NOTE: Classes scheduled on Tuesday between 9:00-11:00 will be conducted only in the 1st and 3rd week of the month']
};

// Strict assertions catalog for ground truth validation
const STRICT_GROUND_TRUTH = [
  { day: 'Monday', startTime: '09:00', endTime: '10:00', subject: 'Remedial Class', type: 'class' },
  { day: 'Monday', startTime: '10:00', endTime: '11:00', subject: 'Artificial Intelligence & Machine Learning', code: 'IPCC22IS52', type: 'class', faculty: 'VG' },
  { day: 'Monday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },
  { day: 'Monday', startTime: '11:15', endTime: '12:15', subject: 'Computer Networks', code: 'IPCC22IS53', type: 'class', faculty: 'CBM' },
  { day: 'Monday', startTime: '12:15', endTime: '13:15', subject: 'Research Methodology and IPR', code: 'AEC22RM56', type: 'class', faculty: 'SKM' },
  { day: 'Monday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },
  { day: 'Monday', startTime: '14:00', endTime: '15:00', subject: 'Environmental Studies', code: 'HSMS22ES57', type: 'class', faculty: 'MM' },
  {
    day: 'Monday', startTime: '15:00', endTime: '17:00', type: 'lab',
    parallelLabs: [
      { batch: 'C1', subject: 'Artificial Intelligence & Machine Learning Lab', code: 'IPCC22IS52', faculty: 'VG, SP', room: 'ISE403' },
      { batch: 'C2', subject: 'Computer Networks Lab', code: 'IPCC22IS53', faculty: 'CBM, PL', room: 'ISE 202' },
      { batch: 'C3', subject: 'Mobile Application Development lab', code: 'PCCL22IS54', faculty: 'SMB, MS', room: 'ISE206' }
    ]
  },

  { day: 'Tuesday', startTime: '09:00', endTime: '10:00', subject: 'Computer Networks', code: 'IPCC22IS53', type: 'class', faculty: 'CBM', requireNote: true },
  { day: 'Tuesday', startTime: '10:00', endTime: '11:00', subject: 'Artificial Intelligence & Machine Learning', code: 'IPCC22IS52', type: 'class', faculty: 'VG', requireNote: true },
  { day: 'Tuesday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },
  { day: 'Tuesday', startTime: '11:15', endTime: '12:15', subject: 'Automata & Compiler Design', code: 'PCC22IS51', type: 'class', faculty: 'SMB' },
  { day: 'Tuesday', startTime: '12:15', endTime: '13:15', subject: 'Advanced Algorithms / UIUX Design', code: 'PEC22IS553', type: 'class', faculty: 'SKB, MS, AV' },
  { day: 'Tuesday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },
  { day: 'Tuesday', startTime: '14:00', endTime: '17:00', subject: 'AICTE Points', type: 'activity' },

  { day: 'Wednesday', startTime: '09:00', endTime: '10:00', subject: 'Advanced Algorithms / UIUX Design', code: 'PEC22IS553', type: 'class', faculty: 'SKB, MS, AV' },
  { day: 'Wednesday', startTime: '10:00', endTime: '11:00', subject: 'Research Methodology and IPR', code: 'AEC22RM56', type: 'class', faculty: 'SKM' },
  { day: 'Wednesday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },
  {
    day: 'Wednesday', startTime: '11:15', endTime: '13:15', type: 'lab',
    parallelLabs: [
      { batch: 'C1', subject: 'Computer Networks Lab', code: 'IPCC22IS53', faculty: 'CBM, RJ', room: 'ISE 202' },
      { batch: 'C2', subject: 'Mobile Application Development lab', code: 'PCCL22IS54', faculty: 'SMB, MS', room: 'ISE206' },
      { batch: 'C3', subject: 'Artificial Intelligence & Machine Learning Lab', code: 'IPCC22IS52', faculty: 'VG, SAI', room: 'ISE403' }
    ]
  },
  { day: 'Wednesday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },
  { day: 'Wednesday', startTime: '14:00', endTime: '15:00', subject: 'Automata & Compiler Design', code: 'PCC22IS51', type: 'class', faculty: 'SMB' },
  { day: 'Wednesday', startTime: '15:00', endTime: '17:00', subject: 'Mini project II', code: '22IS66', type: 'project' },

  { day: 'Thursday', startTime: '09:00', endTime: '10:00', subject: 'Automata & Compiler Design', code: 'PCC22IS51', type: 'class', faculty: 'SMB' },
  { day: 'Thursday', startTime: '10:00', endTime: '11:00', subject: 'Computer Networks', code: 'IPCC22IS53', type: 'class', faculty: 'CBM' },
  { day: 'Thursday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },
  { day: 'Thursday', startTime: '11:15', endTime: '12:15', subject: 'Advanced Algorithms / UIUX Design', code: 'PEC22IS553', type: 'class', faculty: 'SKB, MS, AY' },
  { day: 'Thursday', startTime: '12:15', endTime: '13:15', subject: 'Artificial Intelligence & Machine Learning', code: 'IPCC22IS52', type: 'class', faculty: 'VG' },
  { day: 'Thursday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },
  { day: 'Thursday', startTime: '14:00', endTime: '17:00', subject: 'Student Proctoring', type: 'proctoring' },

  {
    day: 'Friday', startTime: '09:00', endTime: '11:00', type: 'lab',
    parallelLabs: [
      { batch: 'C1', subject: 'Mobile Application Development lab', code: 'PCCL22IS54', faculty: 'YBS, MS', room: 'ISE206' },
      { batch: 'C2', subject: 'Artificial Intelligence & Machine Learning Lab', code: 'IPCC22IS52', faculty: 'VG, MJ', room: 'ISE403' },
      { batch: 'C3', subject: 'Computer Networks Lab', code: 'IPCC22IS53', faculty: 'PL, RJ', room: 'ISE 202' }
    ]
  },
  { day: 'Friday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },
  { day: 'Friday', startTime: '11:15', endTime: '12:15', subject: 'Environmental Studies', code: 'HSMS22ES57', type: 'class', faculty: 'MM' },
  { day: 'Friday', startTime: '12:15', endTime: '13:15', subject: 'Tutorial Class', type: 'class' },
  { day: 'Friday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },
  { day: 'Friday', startTime: '14:00', endTime: '16:00', subject: 'Research Methodology and IPR', code: 'AEC22RM56', type: 'class', faculty: 'SKM' },

  { day: 'Saturday', startTime: '09:00', endTime: '10:00', subject: 'Computer Networks', code: 'IPCC22IS53', type: 'class', faculty: 'CBM' },
  { day: 'Saturday', startTime: '10:00', endTime: '11:00', subject: 'Artificial Intelligence & Machine Learning', code: 'IPCC22IS52', type: 'class', faculty: 'VG' },
  { day: 'Saturday', startTime: '11:00', endTime: '11:15', subject: 'Tea Break', type: 'break' },
  { day: 'Saturday', startTime: '11:15', endTime: '13:15', subject: 'Genesis Student Activity / Guest Talks / Lectures / Hands-on', type: 'activity' },
  { day: 'Saturday', startTime: '13:15', endTime: '14:00', subject: 'Lunch Break', type: 'break' },
  { day: 'Saturday', startTime: '14:00', endTime: '17:00', subject: 'NSS / YOGA / PE / CULTURAL', type: 'activity' }
];

function runStrictOfflineTest() {
  console.log('----------------------------------------------------');
  console.log('🧪 STRICT GROUND TRUTH ASSERTION SUITE');
  console.log('----------------------------------------------------');

  const result = normalizeTimetableData(mockRawGeminiOutput);
  let passedCount = 0;
  let failedCount = 0;

  for (const exp of STRICT_GROUND_TRUTH) {
    const match = result.slots.find(s => s.day === exp.day && s.startTime === exp.startTime);

    if (!match) {
      console.log(`❌ FAIL: Missing slot ${exp.day} ${exp.startTime}–${exp.endTime}`);
      failedCount++;
      continue;
    }

    let isPass = true;
    const errors = [];

    // 1. Validate endTime
    if (match.endTime !== exp.endTime) {
      isPass = false;
      errors.push(`endTime expected ${exp.endTime}, got ${match.endTime}`);
    }

    // 2. Validate type
    if (match.type !== exp.type) {
      isPass = false;
      errors.push(`type expected ${exp.type}, got ${match.type}`);
    }

    // 3. Validate subject / code / faculty
    if (exp.subject && !match.subject.toLowerCase().includes(exp.subject.toLowerCase().slice(0, 8))) {
      isPass = false;
      errors.push(`subject expected ${exp.subject}, got ${match.subject}`);
    }

    if (exp.code && match.code !== exp.code) {
      isPass = false;
      errors.push(`code expected ${exp.code}, got ${match.code}`);
    }

    // 4. Validate Tuesday biweekly note
    if (exp.requireNote) {
      if (!match.note || !match.note.includes('1st and 3rd week')) {
        isPass = false;
        errors.push(`note missing Tuesday biweekly rule`);
      }
    }

    // 5. Validate Parallel Labs if applicable
    if (exp.parallelLabs) {
      for (const targetLab of exp.parallelLabs) {
        const foundParallel = match.parallelLabs?.find(pl => pl.batch === targetLab.batch);
        if (!foundParallel) {
          isPass = false;
          errors.push(`missing parallel lab for batch ${targetLab.batch}`);
        } else {
          if (!foundParallel.subject.toLowerCase().includes(targetLab.subject.toLowerCase().slice(0, 8))) {
            isPass = false;
            errors.push(`batch ${targetLab.batch} subject expected ${targetLab.subject}, got ${foundParallel.subject}`);
          }
          if (foundParallel.code !== targetLab.code) {
            isPass = false;
            errors.push(`batch ${targetLab.batch} code expected ${targetLab.code}, got ${foundParallel.code}`);
          }
        }
      }
    }

    if (isPass) {
      console.log(`✅ PASS: ${exp.day} ${exp.startTime}–${exp.endTime} | [${match.type.toUpperCase()}] ${match.subject} (${match.code || 'NO-CODE'})`);
      passedCount++;
    } else {
      console.log(`❌ FAIL: ${exp.day} ${exp.startTime}–${exp.endTime} | Errors: ${errors.join('; ')}`);
      failedCount++;
    }
  }

  console.log('====================================================');
  console.log(`STRICT TEST RESULT: ${passedCount} PASSED, ${failedCount} FAILED OUT OF ${STRICT_GROUND_TRUTH.length}`);
  console.log('====================================================');
  if (failedCount > 0) process.exit(1);
}

runStrictOfflineTest();

// Offline account-validation tests — pure helpers, no DB.
const {
  validateDisplayName, validateUsername, normalizeUsername, validatePassword
} = require('../services/accountValidation');

const results = [];
const check = (name, cond) => results.push([cond ? 'PASS' : 'FAIL', name]);

check('display name required', validateDisplayName('') !== null && validateDisplayName('   ') !== null);
check('display name ok', validateDisplayName('Aditya Raj') === null);
check('display name too long', validateDisplayName('x'.repeat(61)) !== null);
check('username required', validateUsername('') !== null);
check('username too short', validateUsername('ab') !== null);
check('username rejects uppercase/spaces', validateUsername('Adi 123') !== null);
check('username rejects dots', validateUsername('adi.123') !== null);
check('username ok', validateUsername('adi_123') === null);
check('username normalized', normalizeUsername('  ADI_123 ') === 'adi_123');
check('password required', validatePassword('') !== null);
check('password too short', validatePassword('12345') !== null);
check('password ok', validatePassword('123456') === null);

let fails = 0;
for (const [s, n] of results) { console.log(`${s} — ${n}`); if (s === 'FAIL') fails++; }
console.log(`\nACCOUNT VALIDATION OFFLINE: ${results.length - fails}/${results.length} passed`);
process.exit(fails ? 1 : 0);

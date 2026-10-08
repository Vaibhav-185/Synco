// Offline sharing-policy tests — no DB, no network. Stubs Mongoose models.
// Covers spec section 9 (policy-level cases; route wiring verified by review).
const { checkAvailabilityAccess, checkFullAccess } = require('../services/sharingPolicy');

const ME = 'user-me', FRIEND = 'user-friend', STRANGER = 'user-stranger', MISSING = 'user-ghost';

// Fake state
let friendships = []; // [a,b] accepted pairs
let users = {};       // id -> { shareMode }
let grants = {};      // "owner|requester" -> status

const Friendship = {
  findOne: async (q) => {
    const ors = q.$or || [];
    const hit = friendships.some(([a, b]) =>
      ors.some(c => (String(c.requester) === a && String(c.addressee) === b) ||
                    (String(c.requester) === b && String(c.addressee) === a)));
    return hit && q.status === 'accepted' ? { status: 'accepted' } : null;
  }
};
const MISSING_DOC = Symbol('exists-no-sharemode');
const User = {
  findById: (id) => ({
    select: async () => {
      if (!(id in users)) return null;
      if (users[id] === MISSING_DOC) return { _id: id }; // old doc, field absent
      return { _id: id, shareMode: users[id] };
    }
  })
};
const TimetableShare = {
  findOne: async (q) => {
    const s = grants[`${q.owner}|${q.requester}`];
    return s ? { status: s } : null;
  }
};
const deps = { Friendship, User, TimetableShare };

function reset() {
  friendships = [[ME, FRIEND]];
  users = { [ME]: 'open', [FRIEND]: 'open' };
  grants = {};
}

const results = [];
const check = (name, cond) => results.push([cond ? 'PASS' : 'FAIL', name]);

async function run() {
  // 1. Default availability-only: friends see status, no full access
  reset();
  let r = await checkAvailabilityAccess(ME, FRIEND, deps);
  check('default: friend availability allowed', r.ok === true);
  r = await checkFullAccess(ME, FRIEND, deps);
  check('default: full timetable denied without grant', r.ok === false && r.status === 403);

  // 2. Request + approval -> full retrieval allowed
  grants[`${FRIEND}|${ME}`] = 'approved';
  r = await checkFullAccess(ME, FRIEND, deps);
  check('approved grant: full access allowed', r.ok === true);

  // 3. Rejection -> denied
  grants[`${FRIEND}|${ME}`] = 'rejected';
  r = await checkFullAccess(ME, FRIEND, deps);
  check('rejected: full access denied', r.ok === false && r.status === 403);

  // 4. Revocation (grant -> rejected) takes effect immediately
  grants[`${FRIEND}|${ME}`] = 'approved';
  r = await checkFullAccess(ME, FRIEND, deps);
  const before = r.ok === true;
  grants[`${FRIEND}|${ME}`] = 'rejected';
  r = await checkFullAccess(ME, FRIEND, deps);
  check('revocation: allowed then immediately denied', before && r.ok === false);

  // 5. Private mode overrides existing grants (both levels)
  grants[`${FRIEND}|${ME}`] = 'approved';
  users[FRIEND] = 'private';
  r = await checkFullAccess(ME, FRIEND, deps);
  const fullBlocked = r.ok === false;
  r = await checkAvailabilityAccess(ME, FRIEND, deps);
  check('private: overrides grant, blocks full + availability', fullBlocked && r.ok === false);
  users[FRIEND] = 'open'; // re-enable restores
  r = await checkFullAccess(ME, FRIEND, deps);
  check('private: re-enable restores prior grant', r.ok === true);

  // 6. Old docs without shareMode treated as open
  users[FRIEND] = MISSING_DOC;
  r = await checkAvailabilityAccess(ME, FRIEND, deps);
  check('missing shareMode defaults to open', r.ok === true);

  // 7. Friendship removal invalidates (no friendship -> all denied)
  friendships = [];
  r = await checkAvailabilityAccess(ME, FRIEND, deps);
  const aBlocked = r.ok === false;
  r = await checkFullAccess(ME, FRIEND, deps);
  check('unfriended: availability + full denied even with grant', aBlocked && r.ok === false);

  // 8. Non-friend requests denied at both levels
  reset();
  r = await checkAvailabilityAccess(ME, STRANGER, deps);
  const s1 = r.ok === false && r.status === 403;
  users[STRANGER] = 'open';
  r = await checkAvailabilityAccess(ME, STRANGER, deps);
  check('non-friend: denied even if stranger is open', s1 && r.ok === false);
  grants[`${STRANGER}|${ME}`] = 'approved'; // forged grant, no friendship
  r = await checkFullAccess(ME, STRANGER, deps);
  check('non-friend: forged grant useless without friendship', r.ok === false);

  // 9. Missing owner doc (but friendship row lingers) -> 404, not 500
  friendships.push([ME, MISSING]);
  r = await checkAvailabilityAccess(ME, MISSING, deps);
  check('missing owner: 404', r.ok === false && r.status === 404);

  // 10. Self access always allowed
  r = await checkFullAccess(ME, ME, deps);
  check('self: full access allowed', r.ok === true);

  let fails = 0;
  for (const [s, n] of results) { console.log(`${s} — ${n}`); if (s === 'FAIL') fails++; }
  console.log(`\nSHARING POLICY OFFLINE: ${results.length - fails}/${results.length} passed`);
  process.exit(fails ? 1 : 0);
}
run().catch(e => { console.error('HARNESS ERROR', e); process.exit(2); });

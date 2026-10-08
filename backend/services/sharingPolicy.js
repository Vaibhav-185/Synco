// ── Timetable-sharing authorization policy ──────────────────
// Single home for every "can X see Y's schedule?" decision. Routes call
// these with the real Mongoose models; offline tests stub the deps.
//
// Precedence: friendship (accepted) -> owner shareMode (private wins over
// everything) -> explicit per-friend grant (for full timetable only).
// Identity always comes from req.userId (server-side JWT), never from the
// request body. Missing shareMode on old user docs is treated as 'open'.

async function findFriendship(Friendship, a, b) {
  return Friendship.findOne({
    $or: [
      { requester: a, addressee: b },
      { requester: b, addressee: a }
    ],
    status: 'accepted'
  });
}

function isPrivate(ownerDoc) {
  return ownerDoc && ownerDoc.shareMode === 'private';
}

// Availability = status + next class (friends/status, timetable/status/:id).
// Returns { ok } or { ok:false, status, message }.
async function checkAvailabilityAccess(viewerId, ownerId, { Friendship, User }) {
  if (String(viewerId) === String(ownerId)) return { ok: true };
  const friendship = await findFriendship(Friendship, viewerId, ownerId);
  if (!friendship) return { ok: false, status: 403, message: 'Not friends' };
  const owner = await User.findById(ownerId).select('shareMode');
  if (!owner) return { ok: false, status: 404, message: 'User not found' };
  if (isPrivate(owner)) return { ok: false, status: 403, message: 'This user is not sharing right now' };
  return { ok: true };
}

// Full timetable = weekly slots. Same gates plus an explicit approved grant.
async function checkFullAccess(viewerId, ownerId, { Friendship, User, TimetableShare }) {
  if (String(viewerId) === String(ownerId)) return { ok: true };
  const friendship = await findFriendship(Friendship, viewerId, ownerId);
  if (!friendship) return { ok: false, status: 403, message: 'Not friends' };
  const owner = await User.findById(ownerId).select('shareMode');
  if (!owner) return { ok: false, status: 404, message: 'User not found' };
  if (isPrivate(owner)) return { ok: false, status: 403, message: 'This user is not sharing right now' };
  const grant = await TimetableShare.findOne({ owner: ownerId, requester: viewerId });
  if (!grant || grant.status !== 'approved')
    return { ok: false, status: 403, message: 'No timetable access. Ask your friend for permission.' };
  return { ok: true };
}

module.exports = { checkAvailabilityAccess, checkFullAccess };

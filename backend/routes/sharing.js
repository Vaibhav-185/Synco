const router = require('express').Router();
const mongoose = require('mongoose');
const auth = require('../middleware/auth');
const User = require('../models/User');
const Friendship = require('../models/Friendship');
const TimetableShare = require('../models/TimetableShare');

const isId = (v) => mongoose.isValidObjectId(v);

async function acceptedFriendship(a, b) {
  return Friendship.findOne({
    $or: [{ requester: a, addressee: b }, { requester: b, addressee: a }],
    status: 'accepted'
  });
}

// ── MY SHARING PREFERENCE ───────────────────────────────────
// GET /api/sharing/preference -> { shareMode }
router.get('/preference', auth, async (req, res) => {
  try {
    const me = await User.findById(req.userId).select('shareMode');
    if (!me) return res.status(404).json({ message: 'User not found' });
    res.json({ shareMode: me.shareMode || 'open' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// PUT /api/sharing/preference { shareMode: 'open' | 'private' }
router.put('/preference', auth, async (req, res) => {
  try {
    const { shareMode } = req.body;
    if (!['open', 'private'].includes(shareMode))
      return res.status(400).json({ message: "shareMode must be 'open' or 'private'" });
    await User.findByIdAndUpdate(req.userId, { shareMode });
    res.json({ message: shareMode === 'private' ? 'Sharing paused' : 'Sharing enabled', shareMode });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── REQUEST ACCESS ──────────────────────────────────────────
// POST /api/sharing/request { ownerId }
router.post('/request', auth, async (req, res) => {
  try {
    const { ownerId } = req.body;
    if (!ownerId || !isId(ownerId)) return res.status(400).json({ message: 'Valid ownerId required' });
    if (String(ownerId) === String(req.userId)) return res.status(400).json({ message: 'That is your own timetable' });

    const owner = await User.findById(ownerId).select('_id');
    if (!owner) return res.status(404).json({ message: 'User not found' });
    if (!await acceptedFriendship(req.userId, ownerId))
      return res.status(403).json({ message: 'Only accepted friends can request access' });

    const existing = await TimetableShare.findOne({ owner: ownerId, requester: req.userId });
    if (existing && existing.status === 'pending')
      return res.status(409).json({ message: 'Request already pending', share: existing });
    if (existing && existing.status === 'approved')
      return res.status(409).json({ message: 'You already have access', share: existing });
    if (existing) {
      existing.status = 'pending'; // re-request after a rejection/revocation
      await existing.save();
      return res.status(200).json({ message: 'Request sent again', share: existing });
    }

    const share = await TimetableShare.create({ owner: ownerId, requester: req.userId });
    res.status(201).json({ message: 'Timetable access requested', share });
  } catch (err) {
    if (err && err.code === 11000)
      return res.status(409).json({ message: 'Request already exists' });
    res.status(500).json({ message: 'Server error' });
  }
});

// ── INCOMING (I am the owner) ───────────────────────────────
// GET /api/sharing/incoming -> pending requests for my timetable
router.get('/incoming', auth, async (req, res) => {
  try {
    const reqs = await TimetableShare.find({ owner: req.userId, status: 'pending' })
      .populate('requester', 'displayName username')
      .sort({ createdAt: -1 });
    res.json(reqs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── OUTGOING (my requests to others) ────────────────────────
// GET /api/sharing/outgoing
router.get('/outgoing', auth, async (req, res) => {
  try {
    const reqs = await TimetableShare.find({ requester: req.userId })
      .populate('owner', 'displayName username')
      .sort({ createdAt: -1 });
    res.json(reqs);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── WHO CAN SEE MY TIMETABLE ────────────────────────────────
// GET /api/sharing/grants -> approved viewers
router.get('/grants', auth, async (req, res) => {
  try {
    const grants = await TimetableShare.find({ owner: req.userId, status: 'approved' })
      .populate('requester', 'displayName username')
      .sort({ updatedAt: -1 });
    res.json(grants);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── APPROVE / REJECT (owner only) ───────────────────────────
// PUT /api/sharing/requests/:id { action: 'approved' | 'rejected' }
router.put('/requests/:id', auth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['approved', 'rejected'].includes(action))
      return res.status(400).json({ message: "Action must be 'approved' or 'rejected'" });
    if (!isId(req.params.id)) return res.status(400).json({ message: 'Invalid request id' });

    // owner: req.userId baked into the query — nobody can approve for others
    const share = await TimetableShare.findOneAndUpdate(
      { _id: req.params.id, owner: req.userId },
      { status: action },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'Request not found' });
    res.json({ message: action === 'approved' ? 'Timetable access granted' : 'Request declined', share });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── REVOKE (owner only, immediate) ──────────────────────────
// DELETE /api/sharing/access/:userId
router.delete('/access/:userId', auth, async (req, res) => {
  try {
    if (!isId(req.params.userId)) return res.status(400).json({ message: 'Invalid user id' });
    const share = await TimetableShare.findOneAndUpdate(
      { owner: req.userId, requester: req.params.userId, status: 'approved' },
      { status: 'rejected' },
      { new: true }
    );
    if (!share) return res.status(404).json({ message: 'No active grant for this friend' });
    res.json({ message: 'Timetable access revoked', share });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;

const router     = require('express').Router();
const auth       = require('../middleware/auth');
const User       = require('../models/User');
const Friendship = require('../models/Friendship');
const Slot       = require('../models/Slot');
const TimetableShare = require('../models/TimetableShare');
const { checkAvailabilityAccess } = require('../services/sharingPolicy');
const { resolveBatchView } = require('../services/batchView');

// ── SEARCH USER BY USERNAME ───────────────────────────────
// GET /api/friends/search?username=vaibhav
router.get('/search', auth, async (req, res) => {
  try {
    const { username } = req.query;
    if (!username) return res.status(400).json({ message: 'Username required' });

    const user = await User.findOne({
      username: username.toLowerCase()
    }).select('-password');

    if (!user) return res.status(404).json({ message: 'User not found' });
    if (user._id.toString() === req.userId)
      return res.status(400).json({ message: "That's you!" });

    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── SEND FRIEND REQUEST ───────────────────────────────────
// POST /api/friends/request
// Body: { addresseeId }
router.post('/request', auth, async (req, res) => {
  try {
    const { addresseeId } = req.body;

    // Check if request already exists
    const existing = await Friendship.findOne({
      $or: [
        { requester: req.userId, addressee: addresseeId },
        { requester: addresseeId, addressee: req.userId }
      ]
    });
    if (existing) return res.status(400).json({ message: 'Friend request already exists' });

    const friendship = await Friendship.create({
      requester: req.userId,
      addressee: addresseeId,
    });

    res.status(201).json({ message: 'Friend request sent!', friendship });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── ACCEPT / DECLINE REQUEST ──────────────────────────────
// PUT /api/friends/request/:id
// Body: { action: 'accepted' or 'declined' }
router.put('/request/:id', auth, async (req, res) => {
  try {
    const { action } = req.body;
    if (!['accepted','declined'].includes(action))
      return res.status(400).json({ message: 'Action must be accepted or declined' });

    const friendship = await Friendship.findOneAndUpdate(
      { _id: req.params.id, addressee: req.userId, status: 'pending' },
      { status: action },
      { new: true }
    );

    if (!friendship) return res.status(404).json({ message: 'Request not found' });
    res.json({ message: `Friend request ${action}`, friendship });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET MY FRIENDS LIST ───────────────────────────────────
// GET /api/friends
router.get('/', auth, async (req, res) => {
  try {
    const friendships = await Friendship.find({
      $or: [{ requester: req.userId }, { addressee: req.userId }],
      status: 'accepted'
    }).populate('requester', '-password').populate('addressee', '-password');

    // Return the "other person" in each friendship
    const friends = friendships.map(f => {
      const friend = f.requester._id.toString() === req.userId
        ? f.addressee : f.requester;
      return { friendshipId: f._id, friend };
    });

    res.json(friends);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET PENDING REQUESTS ──────────────────────────────────
// GET /api/friends/requests/pending
router.get('/requests/pending', auth, async (req, res) => {
  try {
    const requests = await Friendship.find({
      addressee: req.userId,
      status: 'pending'
    }).populate('requester', '-password');

    res.json(requests);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET FRIEND'S LIVE STATUS ──────────────────────────────
// GET /api/friends/status/:friendId
// Is this friend in class right now or free?
router.get('/status/:friendId', auth, async (req, res) => {
  try {
    // Verify they are actually friends
    const friendship = await Friendship.findOne({
      $or: [
        { requester: req.userId, addressee: req.params.friendId },
        { requester: req.params.friendId, addressee: req.userId }
      ],
      status: 'accepted'
    });
    if (!friendship) return res.status(403).json({ message: 'Not friends' });

    // Private mode hides availability from friends (owner identity from JWT)
    const gate = await checkAvailabilityAccess(req.userId, req.params.friendId, { Friendship, User });
    if (!gate.ok) return res.status(gate.status).json({ message: gate.message });

    const friend = await User.findById(req.params.friendId).select('-password');

    const now     = new Date();
    const dayName = now.toLocaleDateString('en-IN', { weekday: 'long', timeZone: 'Asia/Kolkata' });
    const timeStr = now.toLocaleTimeString('en-IN', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kolkata'
    });

    const todaySlots  = await Slot.find({ userId: req.params.friendId, day: dayName });
    const activeSlots = todaySlots.filter(s => s.type !== 'break');

    // Batch-aware: resolve parallelLabs to the friend's own batch
    const viewOf = (s) => ({ ...resolveBatchView(s), startTime: s.startTime, endTime: s.endTime, type: s.type, note: s.note });

    const currentSlotObj = activeSlots.find(s => s.startTime <= timeStr && timeStr < s.endTime);
    const nextObj        = todaySlots
      .filter(s => s.type !== 'break' && s.startTime > timeStr)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))[0] || null;

    const currentSlot = currentSlotObj ? viewOf(currentSlotObj) : null;
    const nextClass   = nextObj ? viewOf(nextObj) : null;

    res.json({
      friend,
      inClass:      !!currentSlot,
      currentClass: currentSlot,
      nextClass,
      status:       currentSlot ? `In ${currentSlot.subject}` : 'Free right now 🟢',
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── REMOVE FRIEND ─────────────────────────────────────────
// DELETE /api/friends/:friendshipId
// Also invalidates any timetable-sharing grants/requests between the pair,
// effective immediately on subsequent requests.
router.delete('/:friendshipId', auth, async (req, res) => {
  try {
    const gone = await Friendship.findOneAndDelete({
      _id: req.params.friendshipId,
      $or: [{ requester: req.userId }, { addressee: req.userId }]
    });
    if (gone) {
      const other = String(gone.requester) === String(req.userId) ? gone.addressee : gone.requester;
      await TimetableShare.deleteMany({
        $or: [
          { owner: req.userId, requester: other },
          { owner: other, requester: req.userId }
        ]
      });
    }
    res.json({ message: 'Friend removed' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
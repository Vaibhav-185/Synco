const router = require('express').Router();
const auth   = require('../middleware/auth');
const Group  = require('../models/Group');
const Slot   = require('../models/Slot');
const User   = require('../models/User');

// ── CREATE GROUP ──────────────────────────────────────────
// POST /api/groups
// Body: { name }
router.post('/', auth, async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: 'Group name required' });

    const group = await Group.create({
      name,
      owner:   req.userId,
      members: [req.userId], // creator is automatically a member
    });

    res.status(201).json(group);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── GET MY GROUPS ─────────────────────────────────────────
// GET /api/groups
router.get('/', auth, async (req, res) => {
  try {
    const groups = await Group.find({ members: req.userId })
      .populate('owner',   '-password')
      .populate('members', '-password');
    res.json(groups);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── ADD MEMBER ────────────────────────────────────────────
// POST /api/groups/:id/members
// Body: { userId }
router.post('/:id/members', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    // Only owner can add members
    if (group.owner.toString() !== req.userId)
      return res.status(403).json({ message: 'Only the group owner can add members' });

    if (group.members.includes(req.body.userId))
      return res.status(400).json({ message: 'Already a member' });

    group.members.push(req.body.userId);
    await group.save();

    res.json({ message: 'Member added', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── REMOVE MEMBER ─────────────────────────────────────────
// DELETE /api/groups/:id/members/:userId
router.delete('/:id/members/:userId', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (group.owner.toString() !== req.userId)
      return res.status(403).json({ message: 'Only the group owner can remove members' });

    group.members = group.members.filter(m => m.toString() !== req.params.userId);
    await group.save();

    res.json({ message: 'Member removed', group });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── FIND COMMON FREE SLOTS ────────────────────────────────
// GET /api/groups/:id/freeslots
// THE MAIN USP — finds when everyone in the group is free
router.get('/:id/freeslots', auth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) return res.status(404).json({ message: 'Group not found' });

    if (!group.members.includes(req.userId))
      return res.status(403).json({ message: 'Not a member of this group' });

    const DAYS  = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
    const HOURS = [];
    for (let h = 8; h <= 20; h++) {
      HOURS.push(`${String(h).padStart(2,'0')}:00`);
    }

    // Get all slots for all members
    const allSlots = await Slot.find({ userId: { $in: group.members } });

    // Private-mode members contribute no schedule data: they are excluded
    // from busy counts (never inferred free or busy) and reported via
    // privateCount. Only aggregates ever leave this endpoint.
    const User = require('../models/User');
    const privateIds = new Set(
      (await User.find({ _id: { $in: group.members } }).select('_id shareMode'))
        .filter(u => u.shareMode === 'private')
        .map(u => String(u._id))
    );
    const visibleMembers = group.members.filter(m => !privateIds.has(String(m)));
    const visibleSlots = allSlots.filter(s => !privateIds.has(String(s.userId)));

    const totalMembers = group.members.length;
    const privateCount = privateIds.size;
    const result = {};

    // For each day and each hour, check how many members are free
    for (const day of DAYS) {
      result[day] = [];
      for (const hour of HOURS) {
        const busyCount = visibleMembers.filter(memberId => {
          return visibleSlots.some(slot =>
            slot.userId.toString() === memberId.toString() &&
            slot.day === day &&
            slot.startTime <= hour &&
            hour < slot.endTime
          );
        }).length;

        const freeCount = visibleMembers.length - busyCount;
        const allFree   = busyCount === 0 && privateCount === 0;
        const majority  = freeCount >= Math.ceil(totalMembers / 2);

        result[day].push({
          hour,
          freeCount,
          busyCount,
          totalMembers,
          privateCount,
          allFree,
          majority,
        });
      }
    }

    res.json({
      groupName:    group.name,
      totalMembers,
      privateCount,
      freeSlots:    result,
    });

  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE GROUP ──────────────────────────────────────────
// DELETE /api/groups/:id
router.delete('/:id', auth, async (req, res) => {
  try {
    const group = await Group.findOneAndDelete({
      _id:   req.params.id,
      owner: req.userId
    });
    if (!group) return res.status(404).json({ message: 'Group not found or not owner' });
    res.json({ message: 'Group deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
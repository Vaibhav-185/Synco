const router   = require('express').Router();
const bcrypt   = require('bcryptjs');
const jwt      = require('jsonwebtoken');
const User     = require('../models/User');

// ── SIGNUP ──────────────────────────────────────────────
// POST /api/auth/signup
// Body: { displayName, username, email, password }
router.post('/signup', async (req, res) => {
  try {
    const { displayName, username, email, password } = req.body;

    // 1. Check all fields exist
    if (!displayName || !username || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    // 2. Username must be at least 3 characters
    if (username.length < 3)
      return res.status(400).json({ message: 'Username must be at least 3 characters' });

    // 3. Check if username or email already taken
    const exists = await User.findOne({ $or: [{ username }, { email }] });
    if (exists)
      return res.status(400).json({ message: 'Username or email already taken' });

    // 4. Hash the password — never store plain text passwords
    //    bcrypt scrambles it so even if DB is hacked, passwords are safe
    const hashed = await bcrypt.hash(password, 12);

    // 5. Create the user in MongoDB
    const user = await User.create({
      displayName,
      username: username.toLowerCase(),
      email:    email.toLowerCase(),
      password: hashed,
    });

    // 6. Create a JWT token — like a digital ID card for this session
    const token = jwt.sign(
      { userId: user._id },        // payload — what's inside the token
      process.env.JWT_SECRET,      // secret key to sign it
      { expiresIn: '30d' }         // token lasts 30 days
    );

    res.status(201).json({
      token,
      user: {
        id:          user._id,
        displayName: user.displayName,
        username:    user.username,
        email:       user.email,
        avatarColor: user.avatarColor,
      }
    });

  } catch (err) {
    console.error('Signup error:', err);
    res.status(500).json({ message: 'Server error during signup' });
  }
});

// ── LOGIN ────────────────────────────────────────────────
// POST /api/auth/login
// Body: { email, password }
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: 'Email and password required' });

    // 1. Find user by email
    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user)
      return res.status(400).json({ message: 'No account found with that email' });

    // 2. Compare entered password with stored hash
    const match = await bcrypt.compare(password, user.password);
    if (!match)
      return res.status(400).json({ message: 'Incorrect password' });

    // 3. Issue a fresh token
    const token = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: {
        id:          user._id,
        displayName: user.displayName,
        username:    user.username,
        email:       user.email,
        avatarColor: user.avatarColor,
      }
    });

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ message: 'Server error during login' });
  }
});

// ── GET MY PROFILE ───────────────────────────────────────
// GET /api/auth/me
// Header: Authorization: Bearer <token>
const auth = require('../middleware/auth');

router.get('/me', auth, async (req, res) => {
  try {
    // req.userId comes from middleware/auth.js
    const user = await User.findById(req.userId).select('-password'); // never send password
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── UPDATE PROFILE ────────────────────────────────────────
// PUT /api/auth/profile { displayName?, username? }
// Username stays unique (case-insensitive); references are by user _id so
// nothing else needs rewriting.
const { validateDisplayName, validateUsername, normalizeUsername, validatePassword } = require('../services/accountValidation');

router.put('/profile', auth, async (req, res) => {
  try {
    const { displayName, username } = req.body;
    const update = {};

    if (displayName !== undefined) {
      const err = validateDisplayName(displayName);
      if (err) return res.status(400).json({ message: err });
      update.displayName = String(displayName).trim();
    }
    if (username !== undefined) {
      const clean = normalizeUsername(username);
      const err = validateUsername(clean);
      if (err) return res.status(400).json({ message: err });
      const taken = await User.findOne({ username: clean, _id: { $ne: req.userId } });
      if (taken) return res.status(409).json({ message: 'Username already taken' });
      update.username = clean;
    }
    if (Object.keys(update).length === 0)
      return res.status(400).json({ message: 'Nothing to update' });

    const user = await User.findByIdAndUpdate(req.userId, update, { new: true }).select('-password');
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'Profile updated', user });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── CHANGE PASSWORD ───────────────────────────────────────
// PUT /api/auth/password { currentPassword, newPassword }
router.put('/password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ message: 'Current and new password are required' });
    const err = validatePassword(newPassword);
    if (err) return res.status(400).json({ message: err });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    user.password = await bcrypt.hash(newPassword, 12);
    await user.save();
    res.json({ message: 'Password changed. Use the new password next time you sign in.' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// ── DELETE ACCOUNT ────────────────────────────────────────
// DELETE /api/auth/account { password }
// Verifies the password, then cascades: slots, friendships (both sides),
// timetable shares (both sides), notification logs, group memberships.
// Owned groups pass to the longest-standing remaining member; groups left
// empty are removed. Nothing reversible — the client signs out after.
router.delete('/account', auth, async (req, res) => {
  try {
    const { password } = req.body;
    if (!password) return res.status(400).json({ message: 'Password confirmation required' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!await bcrypt.compare(password, user.password))
      return res.status(400).json({ message: 'Incorrect password' });

    const Slot = require('../models/Slot');
    const Friendship = require('../models/Friendship');
    const TimetableShare = require('../models/TimetableShare');
    const NotificationLog = require('../models/NotificationLog');
    const Group = require('../models/Group');

    await Slot.deleteMany({ userId: req.userId });
    await Friendship.deleteMany({ $or: [{ requester: req.userId }, { addressee: req.userId }] });
    await TimetableShare.deleteMany({ $or: [{ owner: req.userId }, { requester: req.userId }] });
    await NotificationLog.deleteMany({ userId: req.userId });

    const groups = await Group.find({ members: req.userId });
    for (const g of groups) {
      g.members = g.members.filter(m => String(m) !== String(req.userId));
      if (g.members.length === 0) {
        await g.deleteOne();
      } else {
        if (String(g.owner) === String(req.userId)) g.owner = g.members[0];
        await g.save();
      }
    }

    await User.findByIdAndDelete(req.userId);
    res.json({ message: 'Account deleted' });
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
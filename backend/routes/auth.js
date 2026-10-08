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

module.exports = router;
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();

// Render / proxies: needed so rate-limit sees the real client IP
app.set('trust proxy', 1);

// ── Config (PORT fallback so a missing env can't bind port 0) ──
const PORT = parseInt(process.env.PORT || '8000', 10) || 8000;
const FRONTEND_URLS = (process.env.FRONTEND_URL || 'http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);

// Middleware — runs on every single request
// Production CORS: closed to the frontend origin(s); localhost stays for dev.
app.use(cors({ origin: FRONTEND_URLS }));
app.use(express.json({ limit: '1mb' }));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ── Rate limiting (protects Gemini quota + brute-force) ──
// General API: generous, just anti-abuse.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many requests — please slow down.' }
});
// Auth: stricter, anti brute-force.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Too many login attempts — try again later.' }
});
// Uploads: strictest — each hit burns Gemini quota (20/day/model free tier).
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: 'Upload limit reached — try again later.' }
});
app.use('/api/', apiLimiter);

// Routes
app.use('/api/auth', authLimiter, require('./routes/auth'));
app.use('/api/sharing', require('./routes/sharing'));
app.use('/api/timetable/upload', uploadLimiter);
app.use('/api/timetable', require('./routes/timetable'));
app.use('/api/friends',       require('./routes/friends'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/', (req, res) => res.json({ message: '🚀 Synco API is running!' }));

// 404 for unknown API routes (JSON, not HTML)
app.use('/api', (req, res) => res.status(404).json({ message: 'Not found' }));

// Central error handler — always JSON, never leaks raw provider internals
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = typeof err.httpStatus === 'number' ? err.httpStatus
    : err.code === 'LIMIT_FILE_SIZE' ? 413
    : err.message === 'Images only' ? 400
    : 500;
  const message = status < 500
    ? (err.message || 'Request failed')
    : 'Something went wrong — please try again.';
  if (status >= 500) console.error('Unhandled error:', err && err.message);
  res.status(status).json({ message });
});

// Connect to MongoDB then start server
if (!process.env.MONGO_URI) {
  console.error('❌ MONGO_URI is missing — set it in backend/.env (see .env.example). Server not started.');
  process.exit(1);
}
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    // Push-notification scheduler: checks every 5 min (IST-explicit logic in service)
    const { startNotificationScheduler } = require('./services/notificationScheduler');
    startNotificationScheduler({ windowMinutes: parseInt(process.env.NOTIFY_WINDOW_MINUTES || '10', 10) });

    console.log('✅ Connected to MongoDB');
    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));
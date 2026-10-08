const router  = require('express').Router();
const auth    = require('../middleware/auth');
const User    = require('../models/User');

// ── SUBSCRIBE TO PUSH NOTIFICATIONS ───────────────────────
// POST /api/notifications/subscribe
// Body: { subscription } — a standard browser PushSubscription JSON
// (endpoint, keys.p256dh, keys.auth). Overwrites any previous subscription
// for this user; browsers renew endpoints periodically, so last-write-wins
// is the intended behavior.
router.post('/subscribe', auth, async (req, res) => {
  try {
    const { subscription } = req.body;

    if (!subscription || !subscription.endpoint ||
        !subscription.keys || !subscription.keys.p256dh || !subscription.keys.auth) {
      return res.status(400).json({ message: 'Valid push subscription (endpoint + keys) required' });
    }

    const user = await User.findByIdAndUpdate(
      req.userId,
      { pushSubscription: subscription },
      { new: true, runValidators: true }
    );

    if (!user) return res.status(404).json({ message: 'User not found' });

    res.status(201).json({ message: 'Push subscription saved', subscription: user.pushSubscription });
  } catch (err) {
    console.error('Subscribe error:', err);
    res.status(500).json({ message: 'Server error saving subscription' });
  }
});

// ── UNSUBSCRIBE FROM PUSH NOTIFICATIONS ───────────────────
// DELETE /api/notifications/subscribe
router.delete('/subscribe', auth, async (req, res) => {
  try {
    await User.findByIdAndUpdate(req.userId, { pushSubscription: null });
    res.json({ message: 'Push subscription removed' });
  } catch (err) {
    console.error('Unsubscribe error:', err);
    res.status(500).json({ message: 'Server error removing subscription' });
  }
});

// ── PUBLIC VAPID KEY ──────────────────────────────────────
// GET /api/notifications/vapid-public-key
// Frontend needs this to subscribe; the private key never leaves the server.
router.get('/vapid-public-key', (req, res) => {
  const key = process.env.VAPID_PUBLIC_KEY;
  if (!key) return res.status(500).json({ message: 'Push notifications are not configured on this server' });
  res.json({ publicKey: key });
});

// ── TEST PUSH ─────────────────────────────────────────────
// POST /api/notifications/test
// Sends a real push to the caller's own subscription only — used by the
// "Enable Notifications" flow to prove end-to-end delivery.
router.post('/test', auth, async (req, res) => {
  try {
    const { sendPushToUser } = require('../services/notificationService');
    const result = await sendPushToUser(req.userId, {
      title: 'Synco notifications enabled ✅',
      body:  'You will get a nudge when your next class is about to start.'
    });
    // 404/410 => subscription is dead; tell the client to re-subscribe
    if (!result.ok && result.permanent) return res.status(410).json({ message: 'Subscription expired — please enable notifications again' });
    if (!result.ok) return res.status(500).json({ message: 'Push send failed: ' + (result.error || 'unknown error') });
    res.json({ message: 'Test notification sent' });
  } catch (err) {
    console.error('Test push error:', err);
    res.status(500).json({ message: 'Server error sending test notification' });
  }
});

module.exports = router;

const webpush = require('web-push');
const User    = require('../models/User');

// ── VAPID SETUP ───────────────────────────────────────────
// Keys come from environment variables only — never hardcoded.
// Generate once with: npx web-push generate-vapid-keys
let vapidConfigured = false;

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || 'mailto:admin@synco.app',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
  vapidConfigured = true;
} else {
  console.warn('⚠️  VAPID keys not configured — push notifications are disabled. ' +
    'Generate keys with `npx web-push generate-vapid-keys` and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY in backend/.env');
}

/**
 * Send a push notification to one user's stored subscription.
 * Detects dead subscriptions (endpoint gone / gone-permanent) so the caller
 * can clean them up.
 *
 * @param {string} userId
 * @param {{title: string, body: string, url?: string, tag?: string}} payload
 * @returns {Promise<{ok: boolean, permanent?: boolean, error?: string}>}
 *          `permanent: true` means the subscription is dead and should be removed.
 */
async function sendPushToUser(userId, { title, body, url = '/', tag }) {
  if (!vapidConfigured) return { ok: false, error: 'VAPID not configured' };

  const user = await User.findById(userId).select('pushSubscription');
  const sub  = user && user.pushSubscription;
  if (!sub || !sub.endpoint) return { ok: false, error: 'No subscription' };

  try {
    await webpush.sendNotification(
      sub,
      JSON.stringify({ title, body, url, tag })
    );
    return { ok: true };
  } catch (err) {
    const statusCode = err && err.statusCode;
    // 404 = subscription not found, 410 = subscription gone → dead, remove it
    if (statusCode === 404 || statusCode === 410) {
      return { ok: false, permanent: true, error: 'Subscription expired (HTTP ' + statusCode + ')' };
    }
    console.error('Push send error for user ' + userId + ':', err && err.message);
    return { ok: false, error: err && err.message };
  }
}

/**
 * Remove a dead subscription after a permanent push failure.
 */
async function clearSubscription(userId) {
  try {
    await User.findByIdAndUpdate(userId, { pushSubscription: null });
  } catch (err) {
    console.error('Failed to clear subscription for user ' + userId + ':', err && err.message);
  }
}

/**
 * Convenience wrapper: send, and auto-clean if the subscription turned out dead.
 */
async function sendAndClean(userId, payload) {
  const result = await sendPushToUser(userId, payload);
  if (result.permanent) await clearSubscription(userId);
  return result;
}

module.exports = { sendPushToUser, clearSubscription, sendAndClean, isVapidConfigured: () => vapidConfigured };

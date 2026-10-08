const cron    = require('node-cron');
const Slot    = require('../models/Slot');
const User    = require('../models/User');
const NotificationLog = require('../models/NotificationLog');
const { sendAndClean, isVapidConfigured } = require('./notificationService');
const { resolveBatchView } = require('./batchView');

// ── TIME HELPERS (IST-EXPLICIT, same approach as routes' /status) ──
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];

function istParts(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: false
  }).formatToParts(date);
  let hour = '00', minute = '00';
  for (const p of parts) {
    if (p.type === 'hour') hour = p.value.padStart(2, '0');
    if (p.type === 'minute') minute = p.value.padStart(2, '0');
  }
  const dayName = date.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'Asia/Kolkata' });
  // Stable calendar key for dedupe (YYYY-MM-DD in IST)
  const dateKey = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(date); // en-CA => YYYY-MM-DD
  return { hour, minute, timeStr: `${hour}:${minute}`, dayName, dateKey };
}

function toMinutes(t) {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})/);
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : -1;
}

// ── BATCH-AWARE SLOT RESOLUTION ──
// Implemented in services/batchView.js and re-exported here for convenience.

// ── CORE CHECK: who is due a "class starting soon" push right now? ──
// Exported for testability; the cron wrapper simply calls it on a schedule.
// windowMinutes: notify when the class starts within this many minutes.
async function runNotificationTick({ windowMinutes = 10, now = new Date(), send = sendAndClean } = {}) {
  if (!isVapidConfigured()) return { skipped: 'VAPID not configured', notified: 0 };

  const { timeStr, dayName, dateKey } = istParts(now);
  const nowMin = toMinutes(timeStr);

  // Candidates: slots today that start within the window (and are not breaks).
  // pushSubscription lives on User (Slot.userId is an ObjectId ref, not an
  // embedded subdoc), so resolve subscribed users first, then their slots.
  const subscribedIds = await User.distinct('_id', {
    'pushSubscription.endpoint': { $exists: true, $ne: null }
  });
  if (!subscribedIds.length) {
    return { dateKey, dayName, timeStr, checked: 0, notified: 0 };
  }
  const todaySlots = await Slot.find({
    day: dayName,
    type: { $ne: 'break' },
    userId: { $in: subscribedIds }
  });
  const candidates = todaySlots.filter(s => {
    const start = toMinutes(s.startTime);
    if (start < 0) return false;
    const delta = start - nowMin;
    return delta >= 0 && delta <= windowMinutes;
  });

  let notified = 0;
  for (const slot of candidates) {
    const userId = slot.userId;
    if (!userId) continue;

    // ── PERSISTENT DEDUPE ──
    // userId + slotId + dateKey + scheduledStart is unique-indexed, so a
    // duplicate create (another tick, another server instance, post-restart)
    // throws E11000 and we simply skip. No in-memory state involved.
    try {
      await NotificationLog.create({
        userId,
        slotId: slot._id,
        dateKey,
        scheduledStart: slot.startTime,
        subject: slot.subject
      });
    } catch (err) {
      if (err && err.code === 11000) continue; // already notified — dedupe hit
      console.error('NotificationLog create error:', err && err.message);
      continue;
    }

    // Log row reserved — now actually send. If the send fails permanently we
    // drop the log row so a later tick can retry once the user re-subscribes.
    const view = resolveBatchView(slot);
    const bits = [];
    if (view.room) bits.push('in ' + view.room);
    if (view.faculty) bits.push('(' + view.faculty + ')');
    const body =
      view.subject + ' starts at ' + slot.startTime + (bits.length ? ' ' + bits.join(' ') : '');

    const result = await send(userId, {
      title: '⏰ Class starting soon',
      body,
      url: '/',
      tag: 'class-start-' + slot._id
    });

    if (!result.ok) {
      // Permanent failure (dead subscription): release the dedupe row so the
      // notification can fire again after re-subscription. Transient failures
      // keep the row — better to miss one than spam.
      if (result.permanent) {
        await NotificationLog.deleteOne({
          userId, slotId: slot._id, dateKey, scheduledStart: slot.startTime
        }).catch(() => {});
      }
      continue;
    }
    notified++;
  }

  return { dateKey, dayName, timeStr, checked: todaySlots.length, notified };
}

// ── CRON REGISTRATION ─────────────────────────────────────
// Every 5 minutes, IST-explicit via the helpers above (cron itself fires in
// server-local time, but every decision inside the tick uses Asia/Kolkata).
function startNotificationScheduler({ windowMinutes = 10 } = {}) {
  cron.schedule('*/5 * * * *', async () => {
    try {
      const r = await runNotificationTick({ windowMinutes });
      if (r.checked > 0 || r.notified > 0) {
        console.log('[notif-tick] ' + JSON.stringify(r));
      }
    } catch (err) {
      console.error('[notif-tick] error:', err && err.message);
    }
  });
  console.log('✅ Notification scheduler started (every 5 min, ' + windowMinutes + ' min window)');
}

module.exports = { runNotificationTick, resolveBatchView, startNotificationScheduler, istParts, toMinutes };

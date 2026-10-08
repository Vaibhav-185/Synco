const mongoose = require('mongoose');

// One document per notification actually dispatched. The unique index is the
// dedupe guarantee — MongoDB rejects duplicates even across server restarts
// or nodemon reloads, so in-memory state is never needed.
const notificationLogSchema = new mongoose.Schema({
  userId:  { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  slotId:  { type: mongoose.Schema.Types.ObjectId, ref: 'Slot', required: true },
  // The date (IST) this slot's start belonged to — same slot notifies once per day it runs.
  dateKey: { type: String, required: true },          // e.g. "2026-09-28"
  scheduledStart: { type: String, required: true },   // e.g. "11:15"
  subject: { type: String, default: '' },
  sentAt:  { type: Date, default: Date.now }
});

// Dedupe key: user + slot + calendar date + scheduled start time
notificationLogSchema.index(
  { userId: 1, slotId: 1, dateKey: 1, scheduledStart: 1 },
  { unique: true }
);

module.exports = mongoose.model('NotificationLog', notificationLogSchema);

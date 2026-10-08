const mongoose = require('mongoose');

// Timetable-sharing grant/request between two accepted friends.
// owner = timetable owner, requester = friend asking to view it.
// status: pending (awaiting owner) / approved (full access) / rejected
// (declined or revoked; kept as history so re-requests stay explicit).
// One row per (owner, requester) pair — duplicates are rejected by index.
const timetableShareSchema = new mongoose.Schema({
  owner:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  requester: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status:    { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
}, { timestamps: true });

timetableShareSchema.index({ owner: 1, requester: 1 }, { unique: true });

module.exports = mongoose.model('TimetableShare', timetableShareSchema);

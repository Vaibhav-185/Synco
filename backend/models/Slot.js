const mongoose = require('mongoose');

const parallelLabSchema = new mongoose.Schema({
  subject: { type: String },
  code:    { type: String },
  batch:   { type: String },
  faculty: { type: String },
  room:    { type: String }
}, { _id: false });

const slotSchema = new mongoose.Schema({
  userId:          { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  subject:         { type: String, required: true },
  day:             { type: String, required: true, enum: ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'] },
  startTime:       { type: String, required: true }, // "09:00"
  endTime:         { type: String, required: true }, // "10:00"
  code:            { type: String, default: '' },
  type:            { type: String, enum: ['class', 'lab', 'break', 'activity', 'proctoring', 'project'], default: 'class' },
  faculty:         { type: String, default: '' },
  room:            { type: String, default: '' },
  note:            { type: String, default: '' },
  batch:           { type: String, default: '' },
  selectedBatch:   { type: String, default: '' },
  parallelLabs:    [parallelLabSchema],
  isUncertain:     { type: Boolean, default: false },
  uncertainReason: { type: String, default: '' },
}, { timestamps: true });

module.exports = mongoose.model('Slot', slotSchema);
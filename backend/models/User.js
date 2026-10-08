const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  displayName:      { type: String, required: true },
  username:         { type: String, required: true, unique: true, lowercase: true },
  email:            { type: String, required: true, unique: true, lowercase: true },
  password:         { type: String, required: true }, // bcrypt hashed, never plain text
  avatarColor:      { type: String, default: '#c8f04a' },
  pushSubscription: { type: Object, default: null },  // for push notifications
}, { timestamps: true });

module.exports = mongoose.model('User', userSchema);
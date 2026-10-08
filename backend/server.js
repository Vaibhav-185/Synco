const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();

// Middleware — runs on every single request
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Routes
app.use('/api/auth',          require('./routes/auth'));
app.use('/api/timetable',     require('./routes/timetable'));
app.use('/api/friends',       require('./routes/friends'));
app.use('/api/groups',        require('./routes/groups'));
app.use('/api/notifications', require('./routes/notifications'));

// Health check
app.get('/', (req, res) => res.json({ message: '🚀 Synco API is running!' }));

// Connect to MongoDB then start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    // Push-notification scheduler: checks every 5 min (IST-explicit logic in service)
    const { startNotificationScheduler } = require('./services/notificationScheduler');
    startNotificationScheduler({ windowMinutes: parseInt(process.env.NOTIFY_WINDOW_MINUTES || '10', 10) });

    console.log('✅ Connected to MongoDB');
    app.listen(process.env.PORT, () => {
      console.log(`🚀 Server running on port ${process.env.PORT}`);
    });
  })
  .catch(err => console.error('❌ MongoDB connection error:', err));
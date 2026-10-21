require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { seedAdmin } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;

// Seed default admin credentials on startup
seedAdmin();

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session setup
app.use(
  session({
    secret: process.env.SESSION_SECRET || 'mananets_default_secret_key',
    resave: false,
    saveUninitialized: false,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24, // 24 hours
      httpOnly: true,
      sameSite: 'lax'
    }
  })
);

// Serve static frontend assets
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));

// Route fallbacks / clean URLs
app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
  }
  res.sendFile(path.join(__dirname, 'public', 'admin-login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'admin-dashboard.html'));
});

// Start Server
app.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`🏏 ManaNets Booking System is running!`);
  console.log(`🌐 Public Booking Page : http://localhost:${PORT}`);
  console.log(`🔐 Admin Login         : http://localhost:${PORT}/admin`);
  console.log(`===============================================`);
});

require('dotenv').config();
const express = require('express');
const session = require('express-session');
const path = require('path');
const { seedAdmin } = require('./database');

const app = express();
const PORT = process.env.PORT || 3000;
const publicDir = path.join(process.cwd(), 'public');

// Seed default admin credentials on startup
seedAdmin().catch(err => console.error('Admin seeding failed:', err));

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
app.use(express.static(publicDir));

// API Routes
app.use('/api', require('./routes/bookings'));
app.use('/api/admin', require('./routes/admin'));

// Route fallbacks / clean URLs
app.get('/', (req, res) => {
  res.sendFile(path.join(publicDir, 'index.html'));
});

app.get('/admin', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
  }
  res.sendFile(path.join(publicDir, 'admin-login.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(publicDir, 'admin-dashboard.html'));
});

// Start Server locally if not running as a Vercel serverless function
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`===============================================`);
    console.log(`🏏 ManaNets Booking System is running!`);
    console.log(`🌐 Public Booking Page : http://localhost:${PORT}`);
    console.log(`🔐 Admin Login         : http://localhost:${PORT}/admin`);
    console.log(`===============================================`);
  });
}

// Export app for Vercel serverless functions
module.exports = app;

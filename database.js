const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');

const db = new Database(path.join(__dirname, 'maranets.db'));

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// ─── Create Tables ────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS bookings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    court_type TEXT NOT NULL,       -- 'cricket-small', 'cricket-big', 'volleyball'
    booking_date TEXT NOT NULL,     -- YYYY-MM-DD
    start_time TEXT NOT NULL,       -- HH:MM (24h)
    hours INTEGER NOT NULL,
    billed_hours INTEGER NOT NULL,  -- may differ due to 2+1 offer
    price REAL NOT NULL,
    status TEXT DEFAULT 'confirmed', -- 'confirmed', 'cancelled', 'paid'
    notes TEXT DEFAULT '',
    created_at TEXT DEFAULT (datetime('now','localtime'))
  );

  CREATE TABLE IF NOT EXISTS blocked_slots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    court_type TEXT NOT NULL,
    block_date TEXT NOT NULL,
    start_time TEXT NOT NULL,
    hours INTEGER NOT NULL DEFAULT 1,
    reason TEXT DEFAULT 'Admin block'
  );

  CREATE TABLE IF NOT EXISTS admin_users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );
`);

// ─── Seed Admin ───────────────────────────────────────────────────────────────

function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'ManaNets';
  const password = process.env.ADMIN_PASSWORD || 'Nets@1434';
  const existing = db.prepare('SELECT id FROM admin_users WHERE username = ?').get(username);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 10);
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(username, hash);
    console.log('✅ Admin user seeded');
  }
}

// ─── Queries ──────────────────────────────────────────────────────────────────

const queries = {
  getBookingsByDate: db.prepare(`
    SELECT * FROM bookings
    WHERE booking_date = ? AND court_type = ? AND status != 'cancelled'
    ORDER BY start_time
  `),

  getAllBookings: db.prepare(`
    SELECT * FROM bookings ORDER BY booking_date DESC, start_time ASC
  `),

  getBookingsByDateRange: db.prepare(`
    SELECT * FROM bookings
    WHERE booking_date BETWEEN ? AND ?
    ORDER BY booking_date ASC, start_time ASC
  `),

  getBookingById: db.prepare(`SELECT * FROM bookings WHERE id = ?`),

  createBooking: db.prepare(`
    INSERT INTO bookings (customer_name, customer_phone, court_type, booking_date, start_time, hours, billed_hours, price, notes)
    VALUES (@customer_name, @customer_phone, @court_type, @booking_date, @start_time, @hours, @billed_hours, @price, @notes)
  `),

  updateBookingStatus: db.prepare(`UPDATE bookings SET status = ? WHERE id = ?`),

  deleteBooking: db.prepare(`DELETE FROM bookings WHERE id = ?`),

  getBlockedSlots: db.prepare(`
    SELECT * FROM blocked_slots WHERE block_date = ? AND court_type = ?
  `),

  blockSlot: db.prepare(`
    INSERT INTO blocked_slots (court_type, block_date, start_time, hours, reason)
    VALUES (@court_type, @block_date, @start_time, @hours, @reason)
  `),

  deleteBlockedSlot: db.prepare(`DELETE FROM blocked_slots WHERE id = ?`),

  getAdmin: db.prepare(`SELECT * FROM admin_users WHERE username = ?`),

  getDailyRevenue: db.prepare(`
    SELECT booking_date, SUM(price) as revenue, COUNT(*) as count
    FROM bookings
    WHERE status != 'cancelled'
    GROUP BY booking_date
    ORDER BY booking_date DESC
    LIMIT 30
  `),
};

module.exports = { db, queries, seedAdmin };

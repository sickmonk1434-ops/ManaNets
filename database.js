const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createClient } = require('@libsql/client');

// Check for Turso credentials (support common env variable names)
const tursoUrl = process.env.TURSO_DATABASE_URL || process.env.TURSO_URL;
const tursoToken = process.env.TURSO_AUTH_TOKEN || process.env.TURSO_TOKEN;

let tursoClient = null;
if (tursoUrl && tursoToken) {
  try {
    tursoClient = createClient({
      url: tursoUrl,
      authToken: tursoToken
    });
    console.log('⚡ Connected to Turso cloud database:', tursoUrl);
  } catch (err) {
    console.error('Failed to initialize Turso client, falling back to local store:', err.message);
  }
} else {
  console.log('ℹ️ Turso credentials not provided. Using local file store.');
}

// ─── Local Fallback Store ─────────────────────────────────────────────────────
const LOCAL_DB_FILE = process.env.VERCEL
  ? path.join('/tmp', 'maranets_data.json')
  : path.join(__dirname, 'maranets_data.json');

function getInitialLocalData() {
  return {
    bookings: [],
    blocked_slots: [],
    admin_users: [],
    lastBookingId: 0,
    lastBlockedId: 0
  };
}

function loadLocalData() {
  try {
    if (fs.existsSync(LOCAL_DB_FILE)) {
      const raw = fs.readFileSync(LOCAL_DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Warning: could not read local db, resetting:', err.message);
  }
  const init = getInitialLocalData();
  saveLocalData(init);
  return init;
}

function saveLocalData(data) {
  try {
    fs.writeFileSync(LOCAL_DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving local data:', err.message);
  }
}

// ─── Schema Setup & Seeding ───────────────────────────────────────────────────
let schemaInitialized = false;

async function initTursoSchema() {
  if (!tursoClient || schemaInitialized) return;
  try {
    await tursoClient.batch([
      `CREATE TABLE IF NOT EXISTS bookings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        customer_name TEXT NOT NULL,
        customer_phone TEXT NOT NULL,
        court_type TEXT NOT NULL,
        booking_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        hours REAL NOT NULL,
        billed_hours REAL NOT NULL,
        price REAL NOT NULL,
        status TEXT DEFAULT 'confirmed',
        notes TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now','localtime'))
      );`,
      `CREATE TABLE IF NOT EXISTS blocked_slots (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        court_type TEXT NOT NULL,
        block_date TEXT NOT NULL,
        start_time TEXT NOT NULL,
        hours REAL NOT NULL DEFAULT 1,
        reason TEXT DEFAULT 'Admin block'
      );`,
      `CREATE TABLE IF NOT EXISTS admin_users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL
      );`
    ], 'write');
    schemaInitialized = true;
    console.log('✅ Turso schema verified');
  } catch (err) {
    console.error('Error initializing Turso schema:', err.message);
  }
}

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'ManaNets';
  const password = process.env.ADMIN_PASSWORD || 'Nets@1434';

  if (tursoClient) {
    await initTursoSchema();
    try {
      const existing = await tursoClient.execute({
        sql: 'SELECT id FROM admin_users WHERE username = ?',
        args: [username]
      });
      if (existing.rows.length === 0) {
        const hash = bcrypt.hashSync(password, 10);
        await tursoClient.execute({
          sql: 'INSERT INTO admin_users (username, password_hash) VALUES (?, ?)',
          args: [username, hash]
        });
        console.log('✅ Turso Admin user seeded: ' + username);
      }
    } catch (err) {
      console.error('Error seeding Turso admin:', err.message);
    }
  } else {
    // Local fallback seeding
    const data = loadLocalData();
    const existing = data.admin_users.find(u => u.username === username);
    if (!existing) {
      const hash = bcrypt.hashSync(password, 10);
      data.admin_users.push({ id: 1, username, password_hash: hash });
      saveLocalData(data);
      console.log('✅ Local Admin user seeded: ' + username);
    }
  }
}

// ─── Unified Async Queries ────────────────────────────────────────────────────
const queries = {
  getBookingsByDate: {
    all: async (date, court) => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute({
          sql: "SELECT * FROM bookings WHERE booking_date = ? AND court_type = ? AND status != 'cancelled' ORDER BY start_time ASC",
          args: [date, court]
        });
        return res.rows;
      }
      const data = loadLocalData();
      return data.bookings
        .filter(b => b.booking_date === date && b.court_type === court && b.status !== 'cancelled')
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
  },

  getAllBookings: {
    all: async () => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute("SELECT * FROM bookings ORDER BY booking_date DESC, start_time ASC");
        return res.rows;
      }
      const data = loadLocalData();
      return [...data.bookings].sort((a, b) => {
        const dateComp = b.booking_date.localeCompare(a.booking_date);
        if (dateComp !== 0) return dateComp;
        return a.start_time.localeCompare(b.start_time);
      });
    }
  },

  getBookingById: {
    get: async (id) => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute({
          sql: "SELECT * FROM bookings WHERE id = ?",
          args: [id]
        });
        return res.rows[0];
      }
      const data = loadLocalData();
      return data.bookings.find(b => String(b.id) === String(id));
    }
  },

  createBooking: {
    run: async (p) => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute({
          sql: `INSERT INTO bookings (customer_name, customer_phone, court_type, booking_date, start_time, hours, billed_hours, price, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          args: [
            p.customer_name,
            p.customer_phone,
            p.court_type,
            p.booking_date,
            p.start_time,
            p.hours,
            p.billed_hours,
            p.price,
            p.notes || ''
          ]
        });
        return { lastInsertRowid: Number(res.lastInsertRowid) };
      }

      const data = loadLocalData();
      data.lastBookingId = (data.lastBookingId || 0) + 1;
      const newId = data.lastBookingId;
      const record = {
        id: newId,
        customer_name: p.customer_name,
        customer_phone: p.customer_phone,
        court_type: p.court_type,
        booking_date: p.booking_date,
        start_time: p.start_time,
        hours: p.hours,
        billed_hours: p.billed_hours,
        price: p.price,
        status: 'confirmed',
        notes: p.notes || '',
        created_at: new Date().toISOString()
      };
      data.bookings.push(record);
      saveLocalData(data);
      return { lastInsertRowid: newId };
    }
  },

  updateBookingStatus: {
    run: async (status, id) => {
      if (tursoClient) {
        await initTursoSchema();
        await tursoClient.execute({
          sql: "UPDATE bookings SET status = ? WHERE id = ?",
          args: [status, id]
        });
        return;
      }
      const data = loadLocalData();
      const b = data.bookings.find(x => String(x.id) === String(id));
      if (b) {
        b.status = status;
        saveLocalData(data);
      }
    }
  },

  deleteBooking: {
    run: async (id) => {
      if (tursoClient) {
        await initTursoSchema();
        await tursoClient.execute({
          sql: "DELETE FROM bookings WHERE id = ?",
          args: [id]
        });
        return;
      }
      const data = loadLocalData();
      data.bookings = data.bookings.filter(x => String(x.id) !== String(id));
      saveLocalData(data);
    }
  },

  getBlockedSlots: {
    all: async (date, court) => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute({
          sql: "SELECT * FROM blocked_slots WHERE block_date = ? AND court_type = ?",
          args: [date, court]
        });
        return res.rows;
      }
      const data = loadLocalData();
      return data.blocked_slots.filter(s => s.block_date === date && s.court_type === court);
    }
  },

  blockSlot: {
    run: async (p) => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute({
          sql: "INSERT INTO blocked_slots (court_type, block_date, start_time, hours, reason) VALUES (?, ?, ?, ?, ?)",
          args: [p.court_type, p.block_date, p.start_time, p.hours || 1, p.reason || 'Admin block']
        });
        return { lastInsertRowid: Number(res.lastInsertRowid) };
      }
      const data = loadLocalData();
      data.lastBlockedId = (data.lastBlockedId || 0) + 1;
      const newId = data.lastBlockedId;
      data.blocked_slots.push({
        id: newId,
        court_type: p.court_type,
        block_date: p.block_date,
        start_time: p.start_time,
        hours: p.hours || 1,
        reason: p.reason || 'Admin block'
      });
      saveLocalData(data);
      return { lastInsertRowid: newId };
    }
  },

  deleteBlockedSlot: {
    run: async (id) => {
      if (tursoClient) {
        await initTursoSchema();
        await tursoClient.execute({
          sql: "DELETE FROM blocked_slots WHERE id = ?",
          args: [id]
        });
        return;
      }
      const data = loadLocalData();
      data.blocked_slots = data.blocked_slots.filter(s => String(s.id) !== String(id));
      saveLocalData(data);
    }
  },

  getAdmin: {
    get: async (username) => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute({
          sql: "SELECT * FROM admin_users WHERE username = ?",
          args: [username]
        });
        return res.rows[0];
      }
      const data = loadLocalData();
      return data.admin_users.find(u => u.username === username);
    }
  },

  getDailyRevenue: {
    all: async () => {
      if (tursoClient) {
        await initTursoSchema();
        const res = await tursoClient.execute(`
          SELECT booking_date, SUM(price) as revenue, COUNT(*) as count
          FROM bookings
          WHERE status != 'cancelled'
          GROUP BY booking_date
          ORDER BY booking_date DESC
          LIMIT 30
        `);
        return res.rows;
      }
      const data = loadLocalData();
      const map = {};
      data.bookings
        .filter(b => b.status !== 'cancelled')
        .forEach(b => {
          const d = b.booking_date;
          if (!map[d]) map[d] = { booking_date: d, revenue: 0, count: 0 };
          map[d].revenue += Number(b.price) || 0;
          map[d].count += 1;
        });
      return Object.values(map).sort((a, b) => b.booking_date.localeCompare(a.booking_date));
    }
  }
};

module.exports = { queries, seedAdmin, initTursoSchema };

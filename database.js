const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');

// Determine database file path (use /tmp on Vercel serverless to avoid EROFS read-only error)
const DB_FILE = process.env.VERCEL
  ? path.join('/tmp', 'maranets_data.json')
  : path.join(__dirname, 'maranets_data.json');

// Initial schema state
function getInitialData() {
  return {
    bookings: [],
    blocked_slots: [],
    admin_users: [],
    lastBookingId: 0,
    lastBlockedId: 0
  };
}

// Load data from disk
function loadData() {
  try {
    if (fs.existsSync(DB_FILE)) {
      const raw = fs.readFileSync(DB_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (err) {
    console.error('Warning: could not read db file, initializing fresh:', err.message);
  }
  const init = getInitialData();
  saveData(init);
  return init;
}

// Save data to disk synchronously
function saveData(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error saving data to db file:', err.message);
  }
}

// Global in-memory cache synchronized with disk
let dbData = loadData();

// ─── Seed Admin ───────────────────────────────────────────────────────────────
function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || 'ManaNets';
  const password = process.env.ADMIN_PASSWORD || 'Nets@1434';

  dbData = loadData();
  const existing = dbData.admin_users.find(u => u.username === username);
  if (!existing) {
    const hash = bcrypt.hashSync(password, 10);
    dbData.admin_users.push({
      id: 1,
      username,
      password_hash: hash
    });
    saveData(dbData);
    console.log('✅ Admin user seeded successfully');
  }
}

// ─── Queries (Mirrors SQLite prepared statements interface) ───────────────────
const queries = {
  getBookingsByDate: {
    all: (date, court) => {
      dbData = loadData();
      return dbData.bookings
        .filter(b => b.booking_date === date && b.court_type === court && b.status !== 'cancelled')
        .sort((a, b) => a.start_time.localeCompare(b.start_time));
    }
  },

  getAllBookings: {
    all: () => {
      dbData = loadData();
      return [...dbData.bookings].sort((a, b) => {
        const dateComp = b.booking_date.localeCompare(a.booking_date);
        if (dateComp !== 0) return dateComp;
        return a.start_time.localeCompare(b.start_time);
      });
    }
  },

  getBookingsByDateRange: {
    all: (startDate, endDate) => {
      dbData = loadData();
      return dbData.bookings
        .filter(b => b.booking_date >= startDate && b.booking_date <= endDate)
        .sort((a, b) => a.booking_date.localeCompare(b.booking_date));
    }
  },

  getBookingById: {
    get: (id) => {
      dbData = loadData();
      return dbData.bookings.find(b => String(b.id) === String(id));
    }
  },

  createBooking: {
    run: (params) => {
      dbData = loadData();
      dbData.lastBookingId = (dbData.lastBookingId || 0) + 1;
      const newId = dbData.lastBookingId;

      const record = {
        id: newId,
        customer_name: params.customer_name,
        customer_phone: params.customer_phone,
        court_type: params.court_type,
        booking_date: params.booking_date,
        start_time: params.start_time,
        hours: params.hours,
        billed_hours: params.billed_hours,
        price: params.price,
        status: 'confirmed',
        notes: params.notes || '',
        created_at: new Date().toISOString()
      };

      dbData.bookings.push(record);
      saveData(dbData);
      return { lastInsertRowid: newId };
    }
  },

  updateBookingStatus: {
    run: (status, id) => {
      dbData = loadData();
      const booking = dbData.bookings.find(b => String(b.id) === String(id));
      if (booking) {
        booking.status = status;
        saveData(dbData);
      }
    }
  },

  deleteBooking: {
    run: (id) => {
      dbData = loadData();
      dbData.bookings = dbData.bookings.filter(b => String(b.id) !== String(id));
      saveData(dbData);
    }
  },

  getBlockedSlots: {
    all: (date, court) => {
      dbData = loadData();
      return dbData.blocked_slots.filter(s => s.block_date === date && s.court_type === court);
    }
  },

  blockSlot: {
    run: (params) => {
      dbData = loadData();
      dbData.lastBlockedId = (dbData.lastBlockedId || 0) + 1;
      const newId = dbData.lastBlockedId;

      const record = {
        id: newId,
        court_type: params.court_type,
        block_date: params.block_date,
        start_time: params.start_time,
        hours: params.hours || 1,
        reason: params.reason || 'Admin block'
      };

      dbData.blocked_slots.push(record);
      saveData(dbData);
      return { lastInsertRowid: newId };
    }
  },

  deleteBlockedSlot: {
    run: (id) => {
      dbData = loadData();
      dbData.blocked_slots = dbData.blocked_slots.filter(s => String(s.id) !== String(id));
      saveData(dbData);
    }
  },

  getAdmin: {
    get: (username) => {
      dbData = loadData();
      return dbData.admin_users.find(u => u.username === username);
    }
  },

  getDailyRevenue: {
    all: () => {
      dbData = loadData();
      const map = {};
      dbData.bookings
        .filter(b => b.status !== 'cancelled')
        .forEach(b => {
          const d = b.booking_date;
          if (!map[d]) {
            map[d] = { booking_date: d, revenue: 0, count: 0 };
          }
          map[d].revenue += Number(b.price) || 0;
          map[d].count += 1;
        });

      return Object.values(map).sort((a, b) => b.booking_date.localeCompare(a.booking_date));
    }
  }
};

module.exports = { queries, seedAdmin };

const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const { queries } = require('../database');
const { COURTS, calculatePrice, isSlotAvailable } = require('../pricing');

// Authentication Middleware
function requireAdmin(req, res, next) {
  if (req.session && req.session.isAdmin) {
    return next();
  }
  return res.status(401).json({ error: 'Unauthorized: Admin login required' });
}

// Admin Login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = queries.getAdmin.get(username);
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  req.session.isAdmin = true;
  req.session.adminUser = user.username;
  res.json({ success: true, message: 'Logged in successfully', user: user.username });
});

// Admin Logout
router.post('/logout', (req, res) => {
  req.session.destroy(err => {
    if (err) {
      return res.status(500).json({ error: 'Could not log out' });
    }
    res.json({ success: true, message: 'Logged out successfully' });
  });
});

// Auth Status Check
router.get('/me', (req, res) => {
  if (req.session && req.session.isAdmin) {
    return res.json({ authenticated: true, user: req.session.adminUser });
  }
  res.json({ authenticated: false });
});

// Admin Dashboard stats & bookings
router.get('/bookings', requireAdmin, (req, res) => {
  try {
    const bookings = queries.getAllBookings.all();
    const stats = queries.getDailyRevenue.all();
    res.json({ bookings, stats });
  } catch (err) {
    console.error('Error fetching admin bookings:', err);
    res.status(500).json({ error: 'Failed to retrieve bookings' });
  }
});

// Admin manual booking (allows booking on behalf of walk-ins/phone calls)
router.post('/book', requireAdmin, (req, res) => {
  try {
    const { customer_name, customer_phone, court_type, booking_date, start_time, hours, notes, override_price } = req.body;

    if (!customer_name || !court_type || !booking_date || !start_time || !hours) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const duration = parseFloat(hours);
    const bookings = queries.getBookingsByDate.all(booking_date, court_type);
    const blocked = queries.getBlockedSlots.all(booking_date, court_type);

    if (!isSlotAvailable(start_time, duration, bookings, blocked)) {
      return res.status(409).json({ error: 'Slot conflict: This time slot is already booked or blocked' });
    }

    const pricing = calculatePrice(court_type, booking_date, duration);
    const finalPrice = override_price !== undefined && override_price !== '' ? parseFloat(override_price) : pricing.price;

    const result = queries.createBooking.run({
      customer_name: customer_name.trim(),
      customer_phone: (customer_phone || 'Admin Walk-in').trim(),
      court_type,
      booking_date,
      start_time,
      hours: duration,
      billed_hours: pricing.billedHours,
      price: finalPrice,
      notes: notes ? `[Admin booking] ${notes.trim()}` : '[Admin booking]'
    });

    res.status(201).json({ success: true, bookingId: result.lastInsertRowid });
  } catch (err) {
    console.error('Admin booking error:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

// Update booking status (e.g. paid, confirmed, cancelled)
router.patch('/bookings/:id/status', requireAdmin, (req, res) => {
  try {
    const { status } = req.body;
    const { id } = req.params;

    if (!['confirmed', 'paid', 'cancelled'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }

    queries.updateBookingStatus.run(status, id);
    res.json({ success: true, message: `Booking status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Delete booking
router.delete('/bookings/:id', requireAdmin, (req, res) => {
  try {
    const { id } = req.params;
    queries.deleteBooking.run(id);
    res.json({ success: true, message: 'Booking deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete booking' });
  }
});

// Slot blocking / maintenance
router.post('/block-slot', requireAdmin, (req, res) => {
  try {
    const { court_type, block_date, start_time, hours, reason } = req.body;
    if (!court_type || !block_date || !start_time) {
      return res.status(400).json({ error: 'Court, date, and start time required' });
    }

    queries.blockSlot.run({
      court_type,
      block_date,
      start_time,
      hours: parseFloat(hours) || 1,
      reason: reason || 'Admin block/maintenance'
    });

    res.json({ success: true, message: 'Slot blocked successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to block slot' });
  }
});

// Get blocked slots for date
router.get('/blocked-slots', requireAdmin, (req, res) => {
  try {
    const { date, court } = req.query;
    const blocked = queries.getBlockedSlots.all(date, court);
    res.json(blocked);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get blocked slots' });
  }
});

// Delete blocked slot
router.delete('/blocked-slots/:id', requireAdmin, (req, res) => {
  try {
    queries.deleteBlockedSlot.run(req.params.id);
    res.json({ success: true, message: 'Unblocked slot' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to unblock slot' });
  }
});

module.exports = router;

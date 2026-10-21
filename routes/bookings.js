const express = require('express');
const router = express.Router();
const { queries } = require('../database');
const {
  COURTS,
  getRelatedCourtTypes,
  calculatePrice,
  getSlotsWithStatus,
  isSlotAvailable,
  isWeekend,
  formatTime12,
  minutesToTime,
  timeToMinutes
} = require('../pricing');

// Get available, booked, and blocked 30-min slots for a given date and court type
router.get('/slots', async (req, res) => {
  try {
    const { date, court } = req.query;
    if (!date || !court) {
      return res.status(400).json({ error: 'Date and court type are required' });
    }

    if (!COURTS[court]) {
      return res.status(400).json({ error: 'Invalid court type' });
    }

    const relatedCourts = getRelatedCourtTypes(court);
    const bookings = await queries.getBookingsByDate.all(date, relatedCourts);
    const blocked = await queries.getBlockedSlots.all(date, relatedCourts);
    const slots = getSlotsWithStatus(date, court, bookings, blocked);
    const isWknd = isWeekend(date);

    res.json({
      date,
      court,
      courtLabel: COURTS[court].label,
      sport: COURTS[court].sport,
      isWeekend: isWknd,
      slots
    });
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Price check endpoint
router.post('/calculate-price', (req, res) => {
  try {
    const { court, date, hours } = req.body;
    if (!court || !date || hours === undefined) {
      return res.status(400).json({ error: 'Court, date, and hours are required' });
    }
    const calculation = calculatePrice(court, date, parseFloat(hours));
    res.json(calculation);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Validate slot range endpoint (checks if a chosen start time + duration has any collisions)
router.post('/check-availability', async (req, res) => {
  try {
    const { court, date, start_time, hours } = req.body;
    if (!court || !date || !start_time || !hours) {
      return res.status(400).json({ error: 'Missing parameters' });
    }

    const duration = parseFloat(hours);
    const relatedCourts = getRelatedCourtTypes(court);
    const bookings = await queries.getBookingsByDate.all(date, relatedCourts);
    const blocked = await queries.getBlockedSlots.all(date, relatedCourts);

    const available = isSlotAvailable(start_time, duration, bookings, blocked);
    res.json({ available });
  } catch (err) {
    res.status(500).json({ error: 'Error checking availability' });
  }
});

// Create a booking
router.post('/book', async (req, res) => {
  try {
    const { customer_name, customer_phone, court_type, booking_date, start_time, hours, notes } = req.body;

    if (!customer_name || !customer_phone || !court_type || !booking_date || !start_time || !hours) {
      return res.status(400).json({ error: 'All booking fields are required' });
    }

    const duration = parseFloat(hours);
    if (isNaN(duration) || duration < 0.5 || duration > 6) {
      return res.status(400).json({ error: 'Duration must be between 30 minutes and 6 hours' });
    }

    if (!COURTS[court_type]) {
      return res.status(400).json({ error: 'Invalid court type' });
    }

    // Standardize 24h start time string
    const standardStartTime = minutesToTime(timeToMinutes(start_time));

    // Verify slot availability across any shared physical courts
    const relatedCourts = getRelatedCourtTypes(court_type);
    const bookings = await queries.getBookingsByDate.all(booking_date, relatedCourts);
    const blocked = await queries.getBlockedSlots.all(booking_date, relatedCourts);

    if (!isSlotAvailable(standardStartTime, duration, bookings, blocked)) {
      return res.status(409).json({ error: 'Selected time slot or duration overlaps with an existing booking or blocked slot (including shared court activities)' });
    }

    const { price, billedHours, offerApplied } = calculatePrice(court_type, booking_date, duration);

    const result = await queries.createBooking.run({
      customer_name: customer_name.trim(),
      customer_phone: customer_phone.trim(),
      court_type,
      booking_date,
      start_time: standardStartTime,
      hours: duration,
      billed_hours: billedHours,
      price,
      notes: notes ? notes.trim() : ''
    });

    res.status(201).json({
      success: true,
      bookingId: result.lastInsertRowid,
      customer_name,
      customer_phone,
      court_type,
      court_label: COURTS[court_type].label,
      booking_date,
      start_time: standardStartTime,
      start_time_12: formatTime12(standardStartTime),
      hours: duration,
      billed_hours: billedHours,
      price,
      offerApplied
    });
  } catch (err) {
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to create booking' });
  }
});

module.exports = router;

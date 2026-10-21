/**
 * Pricing & slot utilities for ManaNets booking system (30-min intervals)
 */

// Operating hours: 6:00 AM (06:00) to 11:00 PM (23:00)
const OPEN_HOUR = 6;
const CLOSE_HOUR = 23;

// Court definitions
const COURTS = {
  'cricket-small': { label: 'Cricket Net 1 (Small)', sport: 'cricket', maxHours: 4 },
  'cricket-big':   { label: 'Cricket Net 2 (Big)',   sport: 'cricket', maxHours: 4 },
  'volleyball':    { label: 'Volleyball Court',      sport: 'volleyball', maxHours: 4 },
};

/**
 * Returns true if date (YYYY-MM-DD) is Saturday or Sunday
 */
function isWeekend(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  const day = d.getDay(); // 0 = Sun, 6 = Sat
  return day === 0 || day === 6;
}

/**
 * Convert HH:MM (24h) to minutes from midnight
 */
function timeToMinutes(timeStr) {
  if (!timeStr) return 0;
  // Handle 12-hour format e.g. "05:00 PM"
  if (timeStr.includes('AM') || timeStr.includes('PM')) {
    const [time, period] = timeStr.split(' ');
    let [h, m] = time.split(':').map(Number);
    if (period === 'PM' && h < 12) h += 12;
    if (period === 'AM' && h === 12) h = 0;
    return h * 60 + m;
  }
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

/**
 * Convert minutes from midnight to HH:MM (24h)
 */
function minutesToTime(mins) {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Convert HH:MM (24h) or minutes to 12h format e.g. "05:00 PM"
 */
function formatTime12(timeInput) {
  const mins = typeof timeInput === 'number' ? timeInput : timeToMinutes(timeInput);
  let h = Math.floor(mins / 60);
  const m = mins % 60;
  const period = h >= 12 ? 'PM' : 'AM';
  h = h % 12;
  if (h === 0) h = 12;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Calculate price for a booking (supports 30-min fractions e.g. 1, 1.5, 2, 2.5, 3)
 * Applies 2+1 free offer for cricket nets on weekdays when hours >= 3
 */
function calculatePrice(courtType, dateStr, hours) {
  const weekend = isWeekend(dateStr);
  const duration = parseFloat(hours);

  let ratePerHour;
  if (courtType === 'cricket-small') {
    ratePerHour = weekend ? 400 : 300;
  } else if (courtType === 'cricket-big') {
    ratePerHour = weekend ? 500 : 400;
  } else if (courtType === 'volleyball') {
    ratePerHour = weekend ? 600 : 500;
  } else {
    throw new Error('Unknown court type: ' + courtType);
  }

  // 2+1 free offer: Cricket nets on weekdays, if booking >= 3 hours, 1 hour is free!
  let billedHours = duration;
  let offerApplied = false;
  if (!weekend && (courtType === 'cricket-small' || courtType === 'cricket-big') && duration >= 3) {
    billedHours = Math.max(0, duration - 1); // 1 hour completely free
    offerApplied = true;
  }

  const price = Math.round(ratePerHour * billedHours);
  const savings = Math.round(ratePerHour * (duration - billedHours));

  return {
    price,
    duration,
    billedHours,
    offerApplied,
    savings,
    ratePerHour,
    isWeekend: weekend
  };
}

/**
 * Generate all 30-minute intervals from OPEN_HOUR to CLOSE_HOUR
 */
function generateTimeSlots(intervalMins = 30) {
  const slots = [];
  const startMin = OPEN_HOUR * 60;
  const endMin = CLOSE_HOUR * 60;

  for (let m = startMin; m < endMin; m += intervalMins) {
    slots.push({
      time: minutesToTime(m),      // e.g. "17:00"
      time12: formatTime12(m),     // e.g. "05:00 PM"
      minute: m
    });
  }
  return slots;
}

/**
 * Inspect bookings and blocked slots, return detailed status for every 30-minute interval
 */
function getSlotsWithStatus(dateStr, courtType, bookings, blockedSlots) {
  const allSlots = generateTimeSlots(30);

  return allSlots.map(slot => {
    const slotStart = slot.minute;
    const slotEnd = slot.minute + 30;

    // Check if any active booking overlaps [slotStart, slotEnd)
    const bookingMatch = bookings.find(b => {
      if (b.status === 'cancelled') return false;
      const bStart = timeToMinutes(b.start_time);
      const bEnd = bStart + Math.round(parseFloat(b.hours) * 60);
      return slotStart < bEnd && slotEnd > bStart;
    });

    if (bookingMatch) {
      return {
        ...slot,
        status: 'booked',
        available: false,
        label: 'Booked',
        bookingId: bookingMatch.id
      };
    }

    // Check if any blocked slot overlaps [slotStart, slotEnd)
    const blockedMatch = blockedSlots.find(s => {
      const sStart = timeToMinutes(s.start_time);
      const sEnd = sStart + Math.round(parseFloat(s.hours) * 60);
      return slotStart < sEnd && slotEnd > sStart;
    });

    if (blockedMatch) {
      return {
        ...slot,
        status: 'blocked',
        available: false,
        label: blockedMatch.reason || 'Blocked',
        reason: blockedMatch.reason
      };
    }

    return {
      ...slot,
      status: 'available',
      available: true,
      label: 'Available'
    };
  });
}

/**
 * Check if a selected start_time + durationHours is completely available
 */
function isSlotAvailable(startTime, durationHours, bookings, blockedSlots) {
  const startMin = timeToMinutes(startTime);
  const endMin = startMin + Math.round(parseFloat(durationHours) * 60);

  if (endMin > CLOSE_HOUR * 60) return false;

  for (const b of bookings) {
    if (b.status === 'cancelled') continue;
    const bStart = timeToMinutes(b.start_time);
    const bEnd = bStart + Math.round(parseFloat(b.hours) * 60);
    if (startMin < bEnd && endMin > bStart) {
      return false; // Collides with booking
    }
  }

  for (const s of blockedSlots) {
    const sStart = timeToMinutes(s.start_time);
    const sEnd = sStart + Math.round(parseFloat(s.hours) * 60);
    if (startMin < sEnd && endMin > sStart) {
      return false; // Collides with blocked slot
    }
  }

  return true;
}

module.exports = {
  COURTS,
  OPEN_HOUR,
  CLOSE_HOUR,
  isWeekend,
  timeToMinutes,
  minutesToTime,
  formatTime12,
  calculatePrice,
  generateTimeSlots,
  getSlotsWithStatus,
  isSlotAvailable,
};

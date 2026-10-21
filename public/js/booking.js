// ManaNets Booking Engine (30-Minute Interval System)

let currentSport = 'cricket';
let currentCourt = 'cricket-small';
let currentDate = '';
let currentStartTime = '17:00'; // 05:00 PM
let currentStartTime12 = '05:00 PM';
let currentDuration = 1.0; // in hours (1.0 = 1 Hr)
let availableSlots = [];
let hasConflict = false;

const COURTS_BY_SPORT = {
  cricket: [
    { id: 'cricket-small', label: 'Cricket Net 1 (Small Net)' },
    { id: 'cricket-big',   label: 'Cricket Net 2 (Big Net)' }
  ],
  football: [
    { id: 'football-small', label: 'Small Court (Football Turf)' }
  ],
  volleyball: [
    { id: 'volleyball',    label: 'Volleyball Court' }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  // Set default date to today
  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  currentDate = `${yyyy}-${mm}-${dd}`;

  const dateInput = document.getElementById('bookingDate');
  dateInput.value = currentDate;
  dateInput.min = currentDate;

  // Initialize event listeners
  initEvents();

  // Populate courts & initial data
  updateCourtOptions();
  loadCourtSlots();
});

function initEvents() {
  // Sport change
  document.getElementById('sportSelect').addEventListener('change', (e) => {
    currentSport = e.target.value;
    updateCourtOptions();
    loadCourtSlots();
  });

  // Court change
  document.getElementById('courtSelect').addEventListener('change', (e) => {
    currentCourt = e.target.value;
    loadCourtSlots();
  });

  // Date change
  document.getElementById('bookingDate').addEventListener('change', (e) => {
    currentDate = e.target.value;
    loadCourtSlots();
  });

  // Start Time dropdown toggle
  const timeDisplay = document.getElementById('startTimeDisplay');
  const popup = document.getElementById('timeDropdownPopup');

  timeDisplay.addEventListener('click', (e) => {
    e.stopPropagation();
    popup.classList.toggle('open');
    timeDisplay.classList.toggle('active');
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!popup.contains(e.target) && !timeDisplay.contains(e.target)) {
      popup.classList.remove('open');
      timeDisplay.classList.remove('active');
    }
  });

  // Duration stepper
  document.getElementById('btnMinusDuration').addEventListener('click', () => {
    if (currentDuration > 0.5) {
      currentDuration -= 0.5;
      updateDurationUI();
      validateAndCalculate();
    }
  });

  document.getElementById('btnPlusDuration').addEventListener('click', () => {
    if (currentDuration < 4.0) {
      currentDuration += 0.5;
      updateDurationUI();
      validateAndCalculate();
    }
  });

  // "Add To Cart / Book Slot" scrolls to / focuses checkout form
  document.getElementById('btnAddToCart').addEventListener('click', () => {
    if (hasConflict) {
      alert('The selected time slot or duration conflicts with a booked/blocked slot. Please pick an available time.');
      return;
    }
    document.getElementById('customerName').focus();
    document.getElementById('customerCheckoutForm').scrollIntoView({ behavior: 'smooth' });
  });

  // Final checkout submission
  document.getElementById('customerCheckoutForm').addEventListener('submit', handleFinalBooking);
}

function updateCourtOptions() {
  const courtSelect = document.getElementById('courtSelect');
  courtSelect.innerHTML = '';

  const options = COURTS_BY_SPORT[currentSport] || [];
  options.forEach((opt, idx) => {
    const el = document.createElement('option');
    el.value = opt.id;
    el.textContent = opt.label;
    if (idx === 0) el.selected = true;
    courtSelect.appendChild(el);
  });

  currentCourt = courtSelect.value;
}

function formatDurationText(hours) {
  if (hours === 0.5) return '30 Mins';
  if (hours === 1.0) return '1 Hr';
  if (hours % 1 === 0) return `${hours} Hrs`;
  return `${hours} Hrs`;
}

function updateDurationUI() {
  document.getElementById('durationText').textContent = formatDurationText(currentDuration);
  document.getElementById('summaryDuration').textContent = formatDurationText(currentDuration);

  // Stepper disabled state
  document.getElementById('btnMinusDuration').disabled = currentDuration <= 0.5;
  document.getElementById('btnPlusDuration').disabled = currentDuration >= 4.0;
}

async function loadCourtSlots() {
  const grid = document.getElementById('timeSlotsGrid');
  grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #94a3b8; padding: 1rem;">Loading slots...</div>';

  if (!currentCourt || !currentDate) return;

  try {
    const res = await fetch(`/api/slots?date=${currentDate}&court=${currentCourt}`);
    const data = await res.json();

    if (!data.slots || data.slots.length === 0) {
      grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 1rem;">No slots found</div>';
      return;
    }

    availableSlots = data.slots;

    // Update Day Type badge (Weekday vs Weekend)
    const dayBadge = document.getElementById('dayTypeBadge');
    if (data.isWeekend) {
      dayBadge.textContent = 'Weekend Rates';
      dayBadge.style.background = '#fef3c7';
      dayBadge.style.color = '#b45309';
    } else {
      dayBadge.textContent = 'Weekday Rates (2+1 Offer)';
      dayBadge.style.background = '#e6f7f0';
      dayBadge.style.color = '#047857';
    }

    renderSlotsGrid();
    validateAndCalculate();
  } catch (err) {
    grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: #ef4444; padding: 1rem;">Failed to load slots</div>';
  }
}

function renderSlotsGrid() {
  const grid = document.getElementById('timeSlotsGrid');
  grid.innerHTML = '';

  let foundCurrentSlot = false;

  availableSlots.forEach(slot => {
    const pill = document.createElement('button');
    pill.type = 'button';
    pill.className = `slot-pill ${slot.status}`;

    // Subtitle label for booked/blocked status
    let subHtml = '';
    if (slot.status === 'booked') {
      subHtml = `<span class="slot-sub">${slot.label || 'Booked'}</span>`;
      pill.disabled = true;
      pill.title = `Slot is booked: ${slot.label}`;
    } else if (slot.status === 'blocked') {
      subHtml = `<span class="slot-sub">${slot.label || 'Blocked'}</span>`;
      pill.disabled = true;
      pill.title = `Blocked: ${slot.label}`;
    }

    pill.innerHTML = `<span>${slot.time12}</span>${subHtml}`;

    if (slot.time === currentStartTime && slot.status === 'available') {
      pill.classList.add('selected');
      foundCurrentSlot = true;
    }

    pill.addEventListener('click', () => {
      if (slot.status !== 'available') return;

      currentStartTime = slot.time;
      currentStartTime12 = slot.time12;
      document.getElementById('selectedTimeText').textContent = slot.time12;

      // Close popup
      document.getElementById('timeDropdownPopup').classList.remove('open');
      document.getElementById('startTimeDisplay').classList.remove('active');

      renderSlotsGrid();
      validateAndCalculate();
    });

    grid.appendChild(pill);
  });

  // If currently selected slot is now booked/blocked, switch to first available
  if (!foundCurrentSlot) {
    const firstAvail = availableSlots.find(s => s.status === 'available');
    if (firstAvail) {
      currentStartTime = firstAvail.time;
      currentStartTime12 = firstAvail.time12;
      document.getElementById('selectedTimeText').textContent = firstAvail.time12;
    }
  }
}

async function validateAndCalculate() {
  // Update display summary
  const courtSelect = document.getElementById('courtSelect');
  const selectedCourtText = courtSelect.options[courtSelect.selectedIndex] ? courtSelect.options[courtSelect.selectedIndex].text : '';

  document.getElementById('summaryFacility').textContent = selectedCourtText;
  document.getElementById('summaryDate').textContent = currentDate;
  document.getElementById('summaryStartTime').textContent = currentStartTime12;
  document.getElementById('summaryDuration').textContent = formatDurationText(currentDuration);

  // Check collision for the selected duration
  const startMin = timeStringToMinutes(currentStartTime);
  const endMin = startMin + Math.round(currentDuration * 60);

  hasConflict = false;
  for (const s of availableSlots) {
    const sStart = s.minute;
    const sEnd = s.minute + 30;
    if (startMin < sEnd && endMin > sStart) {
      if (s.status === 'booked' || s.status === 'blocked') {
        hasConflict = true;
        break;
      }
    }
  }

  const warningEl = document.getElementById('slotWarningMessage');
  const cartBtn = document.getElementById('btnAddToCart');
  const confirmBtn = document.getElementById('btnFinalConfirm');

  if (hasConflict) {
    warningEl.style.display = 'block';
    cartBtn.classList.remove('active');
    confirmBtn.classList.remove('active');
  } else {
    warningEl.style.display = 'none';
    cartBtn.classList.add('active');
    confirmBtn.classList.add('active');
  }

  // Fetch live price calculation
  try {
    const res = await fetch('/api/calculate-price', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        court: currentCourt,
        date: currentDate,
        hours: currentDuration
      })
    });

    const data = await res.json();
    document.getElementById('summaryHourlyRate').textContent = `₹${data.ratePerHour}/hr`;
    document.getElementById('summaryTotalAmount').textContent = `₹${data.price}`;

    const offerTag = document.getElementById('promoOfferTag');
    const summaryOfferRow = document.getElementById('summaryOfferRow');

    if (data.offerApplied) {
      offerTag.style.display = 'inline-block';
      summaryOfferRow.style.display = 'flex';
      document.getElementById('summarySavings').textContent = `- ₹${data.savings} (1 Hr Free)`;
    } else {
      offerTag.style.display = 'none';
      summaryOfferRow.style.display = 'none';
    }
  } catch (err) {
    console.error('Price calculation failed', err);
  }
}

async function handleFinalBooking(e) {
  e.preventDefault();

  if (hasConflict) {
    alert('Please select an available slot duration before proceeding.');
    return;
  }

  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const notes = document.getElementById('customerNotes').value.trim();

  const confirmBtn = document.getElementById('btnFinalConfirm');
  confirmBtn.disabled = true;
  confirmBtn.textContent = 'Reserving Slot...';

  try {
    const res = await fetch('/api/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        customer_phone: phone,
        court_type: currentCourt,
        booking_date: currentDate,
        start_time: currentStartTime,
        hours: currentDuration,
        notes: notes
      })
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.error || 'Failed to reserve slot');
      loadCourtSlots();
      return;
    }

    // Show confirmation modal
    document.getElementById('modalBookingId').textContent = `#MN-${data.bookingId}`;
    document.getElementById('modalCustomerName').textContent = data.customer_name;
    document.getElementById('modalCourtName').textContent = data.court_label;
    document.getElementById('modalDateTime').textContent = `${data.booking_date} @ ${data.start_time_12} (${formatDurationText(data.hours)})`;
    document.getElementById('modalTotalAmount').textContent = `₹${data.price}${data.offerApplied ? ' (2+1 Offer Applied)' : ''}`;

    document.getElementById('confirmModal').classList.add('active');
  } catch (err) {
    alert('Network error while booking. Please try again.');
  } finally {
    confirmBtn.disabled = false;
    confirmBtn.textContent = 'Confirm & Reserve Slot Now';
  }
}

function closeModalAndReset() {
  document.getElementById('confirmModal').classList.remove('active');
  document.getElementById('customerCheckoutForm').reset();
  loadCourtSlots();
}

function timeStringToMinutes(timeStr) {
  if (!timeStr) return 0;
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + (m || 0);
}

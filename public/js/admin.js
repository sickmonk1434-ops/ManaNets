let allBookings = [];

document.addEventListener('DOMContentLoaded', async () => {
  // Check auth
  try {
    const res = await fetch('/api/admin/me');
    const auth = await res.json();
    if (!auth.authenticated) {
      window.location.href = '/admin';
      return;
    }
    document.getElementById('adminGreeting').textContent = `Admin: ${auth.user}`;
  } catch (err) {
    window.location.href = '/admin';
    return;
  }

  // Populate time slot selects
  populateTimeSelects();

  // Tab switching
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      tab.classList.add('active');
      document.getElementById(tab.getAttribute('data-target')).classList.add('active');
    });
  });

  // Default dates
  const today = new Date().toISOString().split('T')[0];
  document.getElementById('manualDate').value = today;
  document.getElementById('blockDate').value = today;

  // Filter listeners
  document.getElementById('filterDate').addEventListener('change', renderBookingsTable);
  document.getElementById('filterCourt').addEventListener('change', renderBookingsTable);
  document.getElementById('btnRefresh').addEventListener('click', loadBookings);

  // Forms
  document.getElementById('adminManualForm').addEventListener('submit', handleManualBooking);
  document.getElementById('blockSlotForm').addEventListener('submit', handleBlockSlot);
  document.getElementById('logoutBtn').addEventListener('click', handleLogout);

  loadBookings();
});

function populateTimeSelects() {
  const manualSelect = document.getElementById('manualStartTime');
  const blockSelect = document.getElementById('blockStartTime');
  manualSelect.innerHTML = '';
  blockSelect.innerHTML = '';

  for (let m = 6 * 60; m < 23 * 60; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const time24 = `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
    
    // 12-hour label
    const period = h >= 12 ? 'PM' : 'AM';
    let h12 = h % 12;
    if (h12 === 0) h12 = 12;
    const time12 = `${String(h12).padStart(2, '0')}:${String(min).padStart(2, '0')} ${period}`;

    const opt1 = document.createElement('option');
    opt1.value = time24;
    opt1.textContent = `${time12} (${time24})`;
    manualSelect.appendChild(opt1);

    const opt2 = document.createElement('option');
    opt2.value = time24;
    opt2.textContent = `${time12} (${time24})`;
    blockSelect.appendChild(opt2);
  }
}

async function loadBookings() {
  try {
    const res = await fetch('/api/admin/bookings');
    if (!res.ok) {
      if (res.status === 401) window.location.href = '/admin';
      return;
    }

    const data = await res.json();
    allBookings = data.bookings || [];
    renderBookingsTable();
    updateStats(allBookings);
  } catch (err) {
    console.error('Failed to load bookings:', err);
  }
}

function updateStats(bookings) {
  const total = bookings.length;
  const activeOrPaid = bookings.filter(b => b.status === 'confirmed' || b.status === 'paid').length;
  const totalRev = bookings
    .filter(b => b.status !== 'cancelled')
    .reduce((sum, b) => sum + (Number(b.price) || 0), 0);

  document.getElementById('statTotalBookings').textContent = total;
  document.getElementById('statActiveBookings').textContent = activeOrPaid;
  document.getElementById('statTotalRevenue').textContent = `₹${totalRev.toLocaleString('en-IN')}`;
}

function renderBookingsTable() {
  const tbody = document.getElementById('bookingsTableBody');
  const dateFilter = document.getElementById('filterDate').value;
  const courtFilter = document.getElementById('filterCourt').value;

  const filtered = allBookings.filter(b => {
    if (dateFilter && b.booking_date !== dateFilter) return false;
    if (courtFilter && b.court_type !== courtFilter) return false;
    return true;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 2rem;">No bookings found matching filter</td></tr>`;
    return;
  }

  const courtLabels = {
    'cricket-small': '🏏 Net 1 (Small)',
    'cricket-big': '🏏 Net 2 (Big)',
    'football-small': '⚽ Small Court (Football)',
    'volleyball': '🏐 Volleyball'
  };

  tbody.innerHTML = filtered.map(b => {
    const hasOffer = b.hours === 3 && b.billed_hours === 2;
    return `
      <tr>
        <td><strong>#${b.id}</strong></td>
        <td>${b.booking_date}</td>
        <td>${courtLabels[b.court_type] || b.court_type}</td>
        <td>
          ${b.start_time} (${b.hours}h)
          ${hasOffer ? '<span style="color:#fde68a; font-size:0.75rem; display:block;">[2+1 Free]</span>' : ''}
        </td>
        <td>${escapeHtml(b.customer_name)}</td>
        <td><a href="tel:${b.customer_phone}" style="color:var(--primary); text-decoration:none;">${escapeHtml(b.customer_phone)}</a></td>
        <td><strong>₹${b.price}</strong></td>
        <td><span class="badge badge-${b.status}">${b.status}</span></td>
        <td>
          <div style="display: flex; gap: 4px;">
            ${b.status !== 'paid' ? `<button class="action-btn btn-paid" onclick="updateStatus(${b.id}, 'paid')">Paid</button>` : ''}
            ${b.status !== 'cancelled' ? `<button class="action-btn btn-cancel" onclick="updateStatus(${b.id}, 'cancelled')">Cancel</button>` : ''}
            <button class="action-btn" style="background:#475569; color:#fff;" onclick="deleteBooking(${b.id})">🗑️</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function updateStatus(id, status) {
  if (!confirm(`Mark booking #${id} as ${status}?`)) return;
  try {
    const res = await fetch(`/api/admin/bookings/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (res.ok) {
      loadBookings();
    } else {
      alert('Failed to update status');
    }
  } catch (err) {
    alert('Error updating status');
  }
}

async function deleteBooking(id) {
  if (!confirm(`Permanently delete booking #${id}?`)) return;
  try {
    const res = await fetch(`/api/admin/bookings/${id}`, { method: 'DELETE' });
    if (res.ok) {
      loadBookings();
    } else {
      alert('Failed to delete booking');
    }
  } catch (err) {
    alert('Error deleting booking');
  }
}

async function handleManualBooking(e) {
  e.preventDefault();
  const body = {
    court_type: document.getElementById('manualCourt').value,
    booking_date: document.getElementById('manualDate').value,
    start_time: document.getElementById('manualStartTime').value,
    hours: parseInt(document.getElementById('manualHours').value),
    customer_name: document.getElementById('manualName').value,
    customer_phone: document.getElementById('manualPhone').value,
    override_price: document.getElementById('manualPrice').value,
    notes: document.getElementById('manualNotes').value
  };

  try {
    const res = await fetch('/api/admin/book', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (res.ok) {
      alert('Slot booked successfully!');
      document.getElementById('adminManualForm').reset();
      // Switch back to bookings tab and reload
      document.querySelector('[data-target="tabBookings"]').click();
      loadBookings();
    } else {
      alert(result.error || 'Failed to book slot');
    }
  } catch (err) {
    alert('Network error');
  }
}

async function handleBlockSlot(e) {
  e.preventDefault();
  const body = {
    court_type: document.getElementById('blockCourt').value,
    block_date: document.getElementById('blockDate').value,
    start_time: document.getElementById('blockStartTime').value,
    hours: parseInt(document.getElementById('blockHours').value),
    reason: document.getElementById('blockReason').value
  };

  try {
    const res = await fetch('/api/admin/block-slot', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    });
    const result = await res.json();
    if (res.ok) {
      alert('Slot blocked successfully for maintenance!');
      document.getElementById('blockSlotForm').reset();
    } else {
      alert(result.error || 'Failed to block slot');
    }
  } catch (err) {
    alert('Network error');
  }
}

async function handleLogout() {
  await fetch('/api/admin/logout', { method: 'POST' });
  window.location.href = '/admin';
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  })[m]);
}

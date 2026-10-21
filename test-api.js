const http = require('http');

function post(path, data) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify(data);
    const req = http.request({
      hostname: 'localhost',
      port: 3000,
      path: path,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

function get(path) {
  return new Promise((resolve, reject) => {
    const req = http.get({
      hostname: 'localhost',
      port: 3000,
      path: path
    }, res => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(body) }));
    });
    req.on('error', reject);
  });
}

async function runTests() {
  console.log('=== Test 1: 30-minute slot price calculation ===');
  // 0.5 hr on weekday small net (₹300/hr -> ₹150)
  let res = await post('/api/calculate-price', { court: 'cricket-small', date: '2026-10-21', hours: 0.5 });
  console.log('0.5 Hr Weekday Small Net:', res.data);

  // 1.5 hrs on weekday small net (₹300/hr -> ₹450)
  res = await post('/api/calculate-price', { court: 'cricket-small', date: '2026-10-21', hours: 1.5 });
  console.log('1.5 Hrs Weekday Small Net:', res.data);

  // 3.0 hrs on weekday small net (₹300/hr, 2+1 free applied -> 2 hrs billed = ₹600)
  res = await post('/api/calculate-price', { court: 'cricket-small', date: '2026-10-21', hours: 3.0 });
  console.log('3.0 Hrs Weekday 2+1 Free:', res.data);

  console.log('\n=== Test 2: Fetch 30-min slots for a court ===');
  res = await get('/api/slots?date=2026-10-21&court=cricket-small');
  console.log(`Fetched ${res.data.slots.length} 30-minute slots.`);
  console.log('Sample slot:', res.data.slots.find(s => s.time === '17:00'));

  console.log('\n=== Test 3: Create Booking at 05:00 PM (17:00) for 1 hour ===');
  res = await post('/api/book', {
    customer_name: 'Test Batsman',
    customer_phone: '9988776655',
    court_type: 'cricket-small',
    booking_date: '2026-10-21',
    start_time: '17:00',
    hours: 1.0,
    notes: 'Testing 30-min interval booking'
  });
  console.log('Booking Result:', res.data);

  console.log('\n=== Test 4: Verify 05:00 PM and 05:30 PM are now marked "booked" ===');
  res = await get('/api/slots?date=2026-10-21&court=cricket-small');
  const slot1700 = res.data.slots.find(s => s.time === '17:00');
  const slot1730 = res.data.slots.find(s => s.time === '17:30');
  const slot1800 = res.data.slots.find(s => s.time === '18:00');
  console.log('17:00 slot status:', slot1700.status, `(available: ${slot1700.available})`);
  console.log('17:30 slot status:', slot1730.status, `(available: ${slot1730.available})`);
  console.log('18:00 slot status:', slot1800.status, `(available: ${slot1800.available})`);

  console.log('\n=== Test 5: Overlap prevention (trying to book overlapping slot) ===');
  res = await post('/api/book', {
    customer_name: 'Conflicting Booking',
    customer_phone: '9123456789',
    court_type: 'cricket-small',
    booking_date: '2026-10-21',
    start_time: '17:30',
    hours: 1.0
  });
  console.log('Overlap booking response (expected 409 conflict):', res.status, res.data);
}

runTests().catch(console.error);

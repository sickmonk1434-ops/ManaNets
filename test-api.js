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
  console.log('=== Test 1: Cross-Sport Court Sharing (Cricket Small Net vs Football) ===');
  const testDate = '2026-10-25';

  // Step 1: Book Cricket Net 1 (Small) at 19:00 for 1 hour
  console.log('1. Booking Cricket Net 1 at 19:00...');
  let res = await post('/api/book', {
    customer_name: 'Cricket Player',
    customer_phone: '9876500001',
    court_type: 'cricket-small',
    booking_date: testDate,
    start_time: '19:00',
    hours: 1.0,
    notes: 'Cricket session on small net'
  });
  console.log('Cricket Booking Result:', res.status, res.data);

  // Step 2: Query slots for Football on the Small Court
  console.log('2. Querying slots for Football on Small Court...');
  res = await get(`/api/slots?date=${testDate}&court=football-small`);
  const footballSlot1900 = res.data.slots.find(s => s.time === '19:00');
  const footballSlot1930 = res.data.slots.find(s => s.time === '19:30');
  const footballSlot2000 = res.data.slots.find(s => s.time === '20:00');
  console.log('Football 19:00 slot:', {
    status: footballSlot1900.status,
    label: footballSlot1900.label,
    available: footballSlot1900.available
  });
  console.log('Football 19:30 slot:', {
    status: footballSlot1930.status,
    label: footballSlot1930.label,
    available: footballSlot1930.available
  });
  console.log('Football 20:00 slot:', {
    status: footballSlot2000.status,
    available: footballSlot2000.available
  });

  // Step 3: Attempt to book Football at the same time (19:00)
  console.log('3. Attempting conflicting Football booking at 19:00...');
  res = await post('/api/book', {
    customer_name: 'Football Team',
    customer_phone: '9876500002',
    court_type: 'football-small',
    booking_date: testDate,
    start_time: '19:00',
    hours: 1.0
  });
  console.log('Conflicting Football Booking (Expected 409):', res.status, res.data.error);

  // Step 4: Book Football on Small Court at 20:00 for 1 hour
  console.log('4. Booking Football at 20:00...');
  res = await post('/api/book', {
    customer_name: 'Football Strikers',
    customer_phone: '9876500003',
    court_type: 'football-small',
    booking_date: testDate,
    start_time: '20:00',
    hours: 1.0
  });
  console.log('Football Booking Result:', res.status, res.data);

  // Step 5: Query slots for Cricket on Net 1 (Small)
  console.log('5. Querying Cricket Net 1 slots at 20:00...');
  res = await get(`/api/slots?date=${testDate}&court=cricket-small`);
  const cricketSlot2000 = res.data.slots.find(s => s.time === '20:00');
  console.log('Cricket 20:00 slot:', {
    status: cricketSlot2000.status,
    label: cricketSlot2000.label,
    available: cricketSlot2000.available
  });

  // Step 6: Attempt to book Cricket at 20:00
  console.log('6. Attempting conflicting Cricket booking at 20:00...');
  res = await post('/api/book', {
    customer_name: 'Cricket Batsman',
    customer_phone: '9876500004',
    court_type: 'cricket-small',
    booking_date: testDate,
    start_time: '20:00',
    hours: 1.0
  });
  console.log('Conflicting Cricket Booking (Expected 409):', res.status, res.data.error);
}

runTests().catch(console.error);

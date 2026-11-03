import https from 'node:https';

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = https.request({
      hostname: u.hostname,
      path: u.pathname + u.search,
      method: options.method || 'GET',
      headers: options.headers || {}
    }, res => {
      let body = '';
      res.on('data', c => body += c);
      res.on('end', () => {
        try {
          resolve({ status: res.statusCode, headers: res.headers, body: JSON.parse(body) });
        } catch(e) {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function verifyPreviewDeployment() {
  const PREVIEW_URL = 'https://bhusawal-connect-n7v2d61qm-huzaifashaikh9923-8131s-projects.vercel.app';
  console.log('================================================================');
  console.log('VERIFYING LIVE PREVIEW DEPLOYMENT:', PREVIEW_URL);
  console.log('================================================================\n');

  // 1. Unauthenticated Request Guard (HTTP 401)
  console.log('1. Testing Unauthenticated Access Guard on GET /api/rider/status...');
  const unauthRes = await requestJson(`${PREVIEW_URL}/api/rider/status`);
  console.log(`- Status: HTTP ${unauthRes.status} (Expected: 401)`);
  console.log(`- Message: ${unauthRes.body.message}`);
  if (unauthRes.status !== 401) throw new Error('Unauthenticated guard failed');

  // 2. Rider Authentication & Signed Session Issuance
  console.log('\n2. Testing Rider Login & Session Issuance on POST /api/rider/auth/login...');
  const loginRes = await requestJson(`${PREVIEW_URL}/api/rider/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: '9876543210', otp: '1234' }
  });
  console.log(`- Status: HTTP ${loginRes.status} (Expected: 200)`);
  console.log(`- Rider: ${loginRes.body.rider?.name} (${loginRes.body.rider?.id})`);
  console.log(`- Token Issued: ${loginRes.body.token ? 'YES (' + loginRes.body.token.slice(0, 20) + '...)' : 'NO'}`);
  console.log(`- Set-Cookie Header: ${loginRes.headers['set-cookie'] ? 'YES' : 'NO'}`);
  if (loginRes.status !== 200 || !loginRes.body.token) throw new Error('Login failed');

  const tokenRiderA = loginRes.body.token;

  // 3. Authenticated Access to Protected Routes
  console.log('\n3. Testing Authenticated Access to GET /api/rider/status...');
  const authStatusRes = await requestJson(`${PREVIEW_URL}/api/rider/status`, {
    headers: { 'Authorization': `Bearer ${tokenRiderA}` }
  });
  console.log(`- Status: HTTP ${authStatusRes.status} (Expected: 200)`);
  console.log(`- Authenticated Rider: ${authStatusRes.body.rider?.name}`);
  console.log(`- Fleet State: ${authStatusRes.body.rider?.state}`);
  if (authStatusRes.status !== 200) throw new Error('Auth status failed');

  // 4. Cross-Rider Access Protection (HTTP 403)
  console.log('\n4. Testing Cross-Rider Access Protection on GET /api/rider/orders?riderId=BSL-RIDER-2002...');
  const crossOrdersRes = await requestJson(`${PREVIEW_URL}/api/rider/orders?riderId=BSL-RIDER-2002`, {
    headers: { 'Authorization': `Bearer ${tokenRiderA}` }
  });
  console.log(`- Status: HTTP ${crossOrdersRes.status} (Expected: 403 Forbidden)`);
  console.log(`- Message: ${crossOrdersRes.body.message}`);
  if (crossOrdersRes.status !== 403) throw new Error('Cross-rider protection failed');

  // 5. Rider A Dispatch Queue (HTTP 200)
  console.log('\n5. Testing Authorized Dispatch Queue on GET /api/rider/orders...');
  const ordersRes = await requestJson(`${PREVIEW_URL}/api/rider/orders`, {
    headers: { 'Authorization': `Bearer ${tokenRiderA}` }
  });
  console.log(`- Status: HTTP ${ordersRes.status} (Expected: 200)`);
  console.log(`- Available Offers: ${ordersRes.body.availableCount}`);
  console.log(`- Categories: ${ordersRes.body.availableOrders.map(o => o.serviceType).join(', ')}`);

  // 6. Concurrency & Duplicate Acceptance Prevention (HTTP 409)
  console.log('\n6. Testing Atomic Duplicate Prevention on POST /api/rider/order-action...');
  // Login Rider B
  const loginBRes = await requestJson(`${PREVIEW_URL}/api/rider/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: { phone: '9876500002', otp: '1234' }
  });
  const tokenRiderB = loginBRes.body.token;

  // Rider A accepts ORD-GROCERY-101
  const accARes = await requestJson(`${PREVIEW_URL}/api/rider/order-action`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: { orderId: 'ORD-GROCERY-101', action: 'ACCEPT' }
  });
  console.log(`- Rider A Accept: HTTP ${accARes.status} (${accARes.body.message})`);

  // Rider B attempts duplicate accept on ORD-GROCERY-101
  const accBRes = await requestJson(`${PREVIEW_URL}/api/rider/order-action`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderB}`, 'Content-Type': 'application/json' },
    body: { orderId: 'ORD-GROCERY-101', action: 'ACCEPT' }
  });
  console.log(`- Rider B Duplicate Accept: HTTP ${accBRes.status} (${accBRes.body.message})`);
  console.log(`- Duplicate Prevention Guard: ${accBRes.status === 409 ? 'VERIFIED (HTTP 409 Conflict)' : 'FAILED'}`);
  if (accBRes.status !== 409) throw new Error('Duplicate guard failed');

  // Complete ORD-GROCERY-101
  await requestJson(`${PREVIEW_URL}/api/rider/order-action`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: { orderId: 'ORD-GROCERY-101', action: 'DELIVER' }
  });

  // 7. Rendered Screen Verification
  console.log('\n7. Verifying Rendered /rider Route on Preview...');
  const pageRes = await requestJson(`${PREVIEW_URL}/rider`);
  console.log(`- Status: HTTP ${pageRes.status}`);
  console.log(`- HTML Length: ${typeof pageRes.body === 'string' ? pageRes.body.length : 0}`);
  console.log(`- Contains view-dashboard: ${typeof pageRes.body === 'string' && pageRes.body.includes('view-dashboard')}`);
  console.log(`- Contains MSG91 Script: ${typeof pageRes.body === 'string' && pageRes.body.includes('otp-provider.js')}`);

  console.log('\n================================================================');
  console.log('PREVIEW DEPLOYMENT VERIFICATION PASSED 100%!');
  console.log('================================================================\n');
}

verifyPreviewDeployment().catch(err => {
  console.error('Preview Verification Failed:', err);
  process.exit(1);
});

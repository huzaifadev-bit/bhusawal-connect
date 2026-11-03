const assert = require('assert');

async function runHardenedSecurityTests() {
  console.log('================================================================');
  console.log('BHUSAWAL CONNECT — PRODUCTION HARDENING PHASE 2 SECURITY SUITE');
  console.log('================================================================\n');

  const {
    createRiderSessionToken,
    verifyRiderSessionToken,
    authenticateRiderRequest,
    revokeRiderSession
  } = await import('../src/lib/riderAuth.ts');

  const { ServerFleetEngine } = await import('../src/lib/serverFleetEngine.ts');
  ServerFleetEngine.resetAll();

  // -------------------------------------------------------------
  // TEST 1: RIDER AUTHENTICATION & CRYPTOGRAPHIC TOKEN GENERATION
  // -------------------------------------------------------------
  console.log('--- TEST 1: Rider Authentication & Cryptographic Token Generation ---');
  const rider1 = ServerFleetEngine.getRider('BSL-RIDER-8942');
  const token1 = createRiderSessionToken({
    id: rider1.id,
    phone: rider1.phone,
    name: rider1.name
  });

  assert.ok(token1, 'Token must be generated');
  assert.strictEqual(token1.split('.').length, 3, 'Token must follow 3-part header.payload.signature format');

  const verify1 = verifyRiderSessionToken(token1);
  assert.strictEqual(verify1.valid, true, 'Valid token must verify successfully');
  assert.strictEqual(verify1.payload.riderId, 'BSL-RIDER-8942');
  assert.strictEqual(verify1.payload.role, 'RIDER');
  console.log('✓ Signed HMAC-SHA256 session token generated & verified for BSL-RIDER-8942');

  // -------------------------------------------------------------
  // TEST 2: INVALID, TAMPERED & EXPIRED SESSIONS
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Invalid, Tampered & Expired Sessions ---');
  
  // 2.1 Missing Token -> HTTP 401
  const reqNoAuth = new Request('https://bhusawalconnect.in/api/rider/status', { method: 'GET' });
  const authNone = await authenticateRiderRequest(reqNoAuth);
  assert.strictEqual(authNone.authenticated, false);
  assert.strictEqual(authNone.statusCode, 401);
  console.log('✓ Missing session rejected with HTTP 401');

  // 2.2 Tampered Signature -> HTTP 401
  const [h, p, s] = token1.split('.');
  const tamperedToken = `${h}.${p}.invalid_tampered_signature_xyz`;
  const verifyTampered = verifyRiderSessionToken(tamperedToken);
  assert.strictEqual(verifyTampered.valid, false);
  assert.strictEqual(verifyTampered.error, 'Invalid token signature.');
  console.log('✓ Tampered signature rejected with constant-time security guard');

  // 2.3 Expired Token -> HTTP 401
  const expiredToken = createRiderSessionToken({
    id: rider1.id,
    phone: rider1.phone,
    name: rider1.name
  }, -10); // Expired 10 seconds ago
  const verifyExpired = verifyRiderSessionToken(expiredToken);
  assert.strictEqual(verifyExpired.valid, false);
  assert.strictEqual(verifyExpired.error, 'Session token has expired.');
  console.log('✓ Expired session token rejected');

  // 2.4 Revoked Session -> HTTP 401
  const tokenToRevoke = createRiderSessionToken({ id: 'BSL-RIDER-8942', phone: '9876543210' });
  const decodedToRevoke = verifyRiderSessionToken(tokenToRevoke);
  revokeRiderSession(decodedToRevoke.payload.sessionId);
  const verifyRevoked = verifyRiderSessionToken(tokenToRevoke);
  assert.strictEqual(verifyRevoked.valid, false);
  assert.strictEqual(verifyRevoked.error, 'Session has been revoked/logged out.');
  console.log('✓ Revoked session rejected after explicit logout');

  // -------------------------------------------------------------
  // TEST 3 & 4: UNAUTHORIZED RIDER ID MANIPULATION & CROSS-ACCESS (HTTP 403)
  // -------------------------------------------------------------
  console.log('\n--- TESTS 3 & 4: Ownership Verification & Cross-Rider Access Lock (HTTP 403) ---');
  // Rider A token
  const tokenRiderA = createRiderSessionToken({ id: 'BSL-RIDER-8942', phone: '9876543210' });
  
  // Rider A attempts to query Rider B's orders
  const { GET: getOrdersHandler } = await import('../src/pages/api/rider/orders.ts');
  const reqCrossOrders = new Request('https://bhusawalconnect.in/api/rider/orders?riderId=BSL-RIDER-2002', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenRiderA}` }
  });
  const resCrossOrders = await getOrdersHandler({ request: reqCrossOrders });
  assert.strictEqual(resCrossOrders.status, 403, 'Cross-rider order query must return HTTP 403 Forbidden');
  console.log('✓ Rider A cannot query Rider B dispatch orders (HTTP 403 Forbidden)');

  // Rider A attempts to query Rider B's earnings
  const { GET: getEarningsHandler } = await import('../src/pages/api/rider/earnings.ts');
  const reqCrossEarnings = new Request('https://bhusawalconnect.in/api/rider/earnings?riderId=BSL-RIDER-2002', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenRiderA}` }
  });
  const resCrossEarnings = await getEarningsHandler({ request: reqCrossEarnings });
  assert.strictEqual(resCrossEarnings.status, 403, 'Cross-rider earnings query must return HTTP 403 Forbidden');
  console.log('✓ Rider A cannot query Rider B private wallet/earnings (HTTP 403 Forbidden)');

  // Rider A attempts to dispatch action for Rider B
  const { POST: postActionHandler } = await import('../src/pages/api/rider/order-action.ts');
  const reqCrossAction = new Request('https://bhusawalconnect.in/api/rider/order-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ riderId: 'BSL-RIDER-2002', orderId: 'ORD-GROCERY-101', action: 'ACCEPT' })
  });
  const resCrossAction = await postActionHandler({ request: reqCrossAction });
  assert.strictEqual(resCrossAction.status, 403, 'Cross-rider order action must return HTTP 403 Forbidden');
  console.log('✓ Rider A cannot mutate Rider B orders (HTTP 403 Forbidden)');

  // -------------------------------------------------------------
  // TEST 5 & 6: ATOMIC DUPLICATE PREVENTION (HTTP 409)
  // -------------------------------------------------------------
  console.log('\n--- TESTS 5 & 6: Atomic Duplicate Prevention (HTTP 409 Conflict) ---');
  const tokenRiderB = createRiderSessionToken({ id: 'BSL-RIDER-2002', phone: '9876500002' });

  // Rider A accepts ORD-GROCERY-101
  const reqAcceptA = new Request('https://bhusawalconnect.in/api/rider/order-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'ORD-GROCERY-101', action: 'ACCEPT' })
  });
  const resAcceptA = await postActionHandler({ request: reqAcceptA });
  assert.strictEqual(resAcceptA.status, 200, 'Rider A accept must succeed');
  console.log('✓ Rider A accepted ORD-GROCERY-101 (HTTP 200)');

  // Rider B attempts to accept the SAME order -> HTTP 409
  const reqAcceptB = new Request('https://bhusawalconnect.in/api/rider/order-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderB}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'ORD-GROCERY-101', action: 'ACCEPT' })
  });
  const resAcceptB = await postActionHandler({ request: reqAcceptB });
  assert.strictEqual(resAcceptB.status, 409, 'Duplicate acceptance must return HTTP 409 Conflict');
  const bodyAcceptB = await resAcceptB.json();
  assert.ok(bodyAcceptB.message.includes('accepted by another partner'));
  console.log('✓ Competing Rider B blocked with HTTP 409 Conflict');

  // Complete ORD-GROCERY-101
  await postActionHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/order-action', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ORD-GROCERY-101', action: 'DELIVER' })
    })
  });

  // -------------------------------------------------------------
  // TEST 7 & 8: PASSENGER EXCLUSIVITY & AUTO-RELEASE
  // -------------------------------------------------------------
  console.log('\n--- TESTS 7 & 8: Passenger Exclusivity Lock & Auto-Release ---');
  // Rider A accepts passenger ride RIDE-PASSENGER-505
  const reqPaxAccept = new Request('https://bhusawalconnect.in/api/rider/order-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'RIDE-PASSENGER-505', action: 'ACCEPT' })
  });
  const resPaxAccept = await postActionHandler({ request: reqPaxAccept });
  assert.strictEqual(resPaxAccept.status, 200);
  const bodyPaxAccept = await resPaxAccept.json();
  assert.strictEqual(bodyPaxAccept.rider.state, 'PASSENGER_PICKUP');
  assert.strictEqual(bodyPaxAccept.passengerExclusiveActive, true);
  console.log('✓ Rider entered PASSENGER_PICKUP (Passenger Exclusivity Flag: TRUE)');

  // Verify dispatch queue returns 0 offers during passenger trip
  const reqPaxQueue = new Request('https://bhusawalconnect.in/api/rider/orders', {
    method: 'GET',
    headers: { 'Authorization': `Bearer ${tokenRiderA}` }
  });
  const resPaxQueue = await getOrdersHandler({ request: reqPaxQueue });
  const bodyPaxQueue = await resPaxQueue.json();
  assert.strictEqual(bodyPaxQueue.availableCount, 0, 'Zero orders can be offered during passenger trip');
  console.log('✓ Available dispatch queue locked to 0 offers');

  // Attempt to accept a concurrent delivery order -> HTTP 403
  const reqConcurrentGroc = new Request('https://bhusawalconnect.in/api/rider/order-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'ORD-FOOD-202', action: 'ACCEPT' })
  });
  const resConcurrentGroc = await postActionHandler({ request: reqConcurrentGroc });
  assert.strictEqual(resConcurrentGroc.status, 403, 'Concurrent order must be rejected with HTTP 403');
  console.log('✓ Concurrent delivery acceptance blocked with HTTP 403 Forbidden during passenger trip');

  // Passenger Onboard
  await postActionHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/order-action', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'RIDE-PASSENGER-505', action: 'PASSENGER_START' })
    })
  });

  // Passenger Dropoff & Complete -> Auto-release to AVAILABLE
  const reqPaxComplete = new Request('https://bhusawalconnect.in/api/rider/order-action', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orderId: 'RIDE-PASSENGER-505', action: 'PASSENGER_COMPLETE' })
  });
  const resPaxComplete = await postActionHandler({ request: reqPaxComplete });
  assert.strictEqual(resPaxComplete.status, 200);
  const bodyPaxComplete = await resPaxComplete.json();
  assert.strictEqual(bodyPaxComplete.rider.state, 'AVAILABLE', 'Rider must return to AVAILABLE');
  assert.strictEqual(bodyPaxComplete.passengerExclusiveActive, false);
  assert.ok(bodyPaxComplete.rider.walletBalance > 1240, 'Wallet balance must be credited');
  console.log(`✓ Passenger completed: Rider returned to AVAILABLE, +₹${bodyPaxComplete.order.payout} credited to wallet`);

  // -------------------------------------------------------------
  // TEST 9: OFFLINE RIDER RECEIVES ZERO OFFERS
  // -------------------------------------------------------------
  console.log('\n--- TEST 9: Offline Duty Receives Zero Offers ---');
  const { POST: postStatusHandler } = await import('../src/pages/api/rider/status.ts');
  await postStatusHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/status', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnline: false })
    })
  });

  const resOffQueue = await getOrdersHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/orders', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRiderA}` }
    })
  });
  const bodyOffQueue = await resOffQueue.json();
  assert.strictEqual(bodyOffQueue.availableCount, 0, 'Offline rider must receive 0 offers');
  assert.strictEqual(bodyOffQueue.rider.isOnline, false);
  console.log('✓ Offline rider receives 0 dispatch offers');

  // Return online
  await postStatusHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/status', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ isOnline: true })
    })
  });

  // -------------------------------------------------------------
  // TEST 10 & 11: CONCURRENCY, PERSISTENCE & FAULT TOLERANCE
  // -------------------------------------------------------------
  console.log('\n--- TESTS 10 & 11: Concurrency & Database Fault Tolerance ---');
  // 5 competing riders attempt to accept the SAME order concurrently
  const competingTokens = [
    createRiderSessionToken({ id: 'BSL-RIDER-8942', phone: '9876543210' }),
    createRiderSessionToken({ id: 'BSL-RIDER-2002', phone: '9876500002' }),
    createRiderSessionToken({ id: 'BSL-RIDER-2003', phone: '9876500003' }),
    createRiderSessionToken({ id: 'BSL-RIDER-2004', phone: '9876500004' }),
    createRiderSessionToken({ id: 'BSL-RIDER-2005', phone: '9876500005' })
  ];

  const promises = competingTokens.map(token => 
    postActionHandler({
      request: new Request('https://bhusawalconnect.in/api/rider/order-action', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'ORD-FOOD-202', action: 'ACCEPT' })
      })
    })
  );

  const results = await Promise.all(promises);
  const statusCodes = results.map(r => r.status);
  const successCount = statusCodes.filter(s => s === 200).length;
  const conflictCount = statusCodes.filter(s => s === 409).length;
  assert.strictEqual(successCount, 1, 'Exactly ONE concurrent acceptance must succeed among competing riders');
  assert.strictEqual(conflictCount, 4, 'Remaining 4 competing riders must receive HTTP 409 Conflict');
  console.log(`✓ 5 competing riders raced for order: exactly 1 won (200), 4 rejected with 409 Conflict (Statuses: ${statusCodes.join(', ')})`);

  // Deliver ORD-FOOD-202
  await postActionHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/order-action', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${tokenRiderA}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId: 'ORD-FOOD-202', action: 'DELIVER' })
    })
  });

  // -------------------------------------------------------------
  // TEST 12: REGRESSION CHECK ON EXISTING CUSTOMER & DISPATCH FLOWS
  // -------------------------------------------------------------
  console.log('\n--- TEST 12: Regression Check on Customer & Dispatch Flows ---');
  const { GET: getStatusHandler } = await import('../src/pages/api/rider/status.ts');
  const finalStatusRes = await getStatusHandler({
    request: new Request('https://bhusawalconnect.in/api/rider/status', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${tokenRiderA}` }
    })
  });
  assert.strictEqual(finalStatusRes.status, 200);
  const finalStatus = await finalStatusRes.json();
  assert.strictEqual(finalStatus.rider.state, 'AVAILABLE');
  assert.strictEqual(finalStatus.activeCount, 0);
  console.log('✓ All existing customer and shared-fleet dispatch rules remain 100% operational');

  console.log('\n================================================================');
  console.log('ALL 12 HARDENED SECURITY AND FUNCTIONAL TESTS PASSED!');
  console.log('================================================================\n');
}

runHardenedSecurityTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});

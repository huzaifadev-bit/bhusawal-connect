const assert = require('assert');
const fs = require('fs');
const path = require('path');

async function testCompleteRiderSystem() {
  console.log('================================================================');
  console.log('BHUSAWAL CONNECT - COMPLETE RIDER APP UPGRADE VERIFICATION TEST');
  console.log('================================================================\n');

  // 1. VERIFY FILE PRESENCE & ASTRO TEMPLATES
  console.log('--- 1. VERIFYING PAGES & TEMPLATES ---');
  const riderPath = path.join(__dirname, '..', 'src', 'pages', 'rider.astro');
  const riderContent = fs.readFileSync(riderPath, 'utf8');
  assert.ok(riderContent.includes('<RiderHomeDashboard />'), 'rider.astro must mount RiderHomeDashboard directly');
  assert.ok(riderContent.includes('<RiderOrderRequestModal />'), 'rider.astro must mount RiderOrderRequestModal');
  assert.ok(riderContent.includes('window.BslRiderHome.start()'), 'rider.astro must start BslRiderHome on DOM load');
  assert.ok(!riderContent.includes('view-login') || riderContent.includes('modal-rider-auth'), 'rider.astro must not hide dashboard behind view-login');
  console.log('✓ src/pages/rider.astro correctly mounts the full Captain Application on root load');

  const dashPath = path.join(__dirname, '..', 'src', 'pages', 'rider_dashboard.astro');
  const dashContent = fs.readFileSync(dashPath, 'utf8');
  assert.ok(dashContent.includes('<RiderHomeDashboard />'), 'rider_dashboard.astro must mount RiderHomeDashboard directly');
  assert.ok(dashContent.includes('BslRiderHome.start()'), 'rider_dashboard.astro must start BslRiderHome');
  assert.ok(!dashContent.includes('Huzaifa Shaikh (Rider)'), 'rider_dashboard.astro must NOT contain old static strings');
  console.log('✓ src/pages/rider_dashboard.astro successfully replaces the obsolete static mock');

  const compPath = path.join(__dirname, '..', 'src', 'components', 'RiderHomeDashboard.astro');
  const compContent = fs.readFileSync(compPath, 'utf8');
  assert.ok(compContent.includes('id="view-dashboard" class="fixed inset-0'), 'view-dashboard must be visible by default, not class="hidden"');
  assert.ok(compContent.includes('id="btn-switch-account"'), 'Profile tab must provide Switch Account button');
  console.log('✓ src/components/RiderHomeDashboard.astro is configured for immediate full-screen map visibility');

  // 2. VERIFY CLIENT ASSET SCRIPTS
  console.log('\n--- 2. VERIFYING CLIENT CONTROLLER SCRIPTS ---');
  const homeJsPath = path.join(__dirname, '..', 'public', 'assets', 'bsl_rider_home.js');
  const homeJsContent = fs.readFileSync(homeJsPath, 'utf8');
  assert.ok(homeJsContent.includes('renderOrdersTab('), 'bsl_rider_home.js must implement renderOrdersTab');
  assert.ok(homeJsContent.includes('syncRiderServerStatus()'), 'bsl_rider_home.js must implement syncRiderServerStatus');
  assert.ok(homeJsContent.includes('syncRiderEarnings()'), 'bsl_rider_home.js must implement syncRiderEarnings');
  assert.ok(homeJsContent.includes('sendServerLocation('), 'bsl_rider_home.js must implement sendServerLocation');
  assert.ok(homeJsContent.includes('/api/rider/order-action'), 'bsl_rider_home.js must call /api/rider/order-action');
  assert.ok(homeJsContent.includes('/api/rider/status'), 'bsl_rider_home.js must call /api/rider/status');
  console.log('✓ public/assets/bsl_rider_home.js is connected to all server APIs and implements dynamic Orders tab');

  // 3. VERIFY SERVER DISPATCH ENGINE RULES (PHASE 3)
  console.log('\n--- 3. VERIFYING SERVER DISPATCH ENGINE (PHASE 3) ---');
  const { ServerFleetEngine } = await import('../src/lib/serverFleetEngine.ts');
  ServerFleetEngine.resetAll();

  // Test 3.1: Shared Rider pool
  const rider = ServerFleetEngine.getRider('BSL-RIDER-8942');
  assert.strictEqual(rider.isOnline, true, 'Rider must start online');
  assert.strictEqual(rider.state, 'AVAILABLE', 'Rider state must be AVAILABLE');

  // Test 3.2: 5 Service categories in shared fleet pool
  const queue = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  const categories = new Set(queue.map(o => o.serviceType));
  assert.ok(categories.has('GROCERY'), 'Queue must contain Grocery');
  assert.ok(categories.has('FOOD'), 'Queue must contain Food');
  assert.ok(categories.has('MEDICINE'), 'Queue must contain Medicine');
  assert.ok(categories.has('PARCEL'), 'Queue must contain Parcel');
  assert.ok(categories.has('PASSENGER'), 'Queue must contain Passenger Ride');
  console.log('✓ Server pool serves ONE unified two-wheeler fleet across all 5 service categories');

  // Test 3.3: Normal multi-delivery order compatibility
  const grocery = queue.find(o => o.serviceType === 'GROCERY');
  const accGroc = ServerFleetEngine.handleAction('BSL-RIDER-8942', grocery.id, 'ACCEPT');
  assert.strictEqual(accGroc.success, true);
  assert.strictEqual(accGroc.rider.state, 'GOING_TO_PICKUP');

  // Compatible Food Order should be offered as multi-order, but Passenger Ride MUST be blocked
  const queueAfterGrocery = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  assert.strictEqual(queueAfterGrocery.find(o => o.serviceType === 'PASSENGER'), undefined, 'Passenger ride must NOT be offered when carrying deliveries');

  const food = queueAfterGrocery.find(o => o.serviceType === 'FOOD');
  const accFood = ServerFleetEngine.handleAction('BSL-RIDER-8942', food.id, 'ACCEPT');
  assert.strictEqual(accFood.success, true);
  assert.strictEqual(accFood.rider.state, 'MULTI_ORDER');
  assert.strictEqual(ServerFleetEngine.getActiveOrders('BSL-RIDER-8942').length, 2);
  console.log('✓ Normal delivery multi-order batching functions smoothly (State: MULTI_ORDER, Count: 2)');

  // Test 3.4: Complete delivery orders
  const pickGroc = ServerFleetEngine.handleAction('BSL-RIDER-8942', grocery.id, 'PICKUP');
  assert.strictEqual(pickGroc.success, true);
  const delGroc = ServerFleetEngine.handleAction('BSL-RIDER-8942', grocery.id, 'DELIVER');
  assert.strictEqual(delGroc.success, true);

  const delFood = ServerFleetEngine.handleAction('BSL-RIDER-8942', food.id, 'DELIVER');
  assert.strictEqual(delFood.success, true);
  assert.strictEqual(ServerFleetEngine.getActiveOrders('BSL-RIDER-8942').length, 0);
  assert.strictEqual(ServerFleetEngine.getRider('BSL-RIDER-8942').state, 'AVAILABLE');
  console.log('✓ Delivery completions safely transition active deliveries and return rider to AVAILABLE');

  // Test 3.5: PASSENGER EXCLUSIVE MODE (Rapido Captain)
  const freshQueue = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  const passengerRide = freshQueue.find(o => o.serviceType === 'PASSENGER');
  assert.ok(passengerRide, 'Passenger ride must be present in queue');

  const accPassenger = ServerFleetEngine.handleAction('BSL-RIDER-8942', passengerRide.id, 'ACCEPT');
  assert.strictEqual(accPassenger.success, true);
  assert.strictEqual(accPassenger.rider.state, 'PASSENGER_PICKUP', 'Rider state must be PASSENGER_PICKUP');

  // Passenger Exclusive Lockout Verification
  const lockedOffers = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  assert.strictEqual(lockedOffers.length, 0, 'Zero orders can be offered during passenger pickup');

  // Attempting to accept any order while passenger trip is active must return HTTP 403
  const illegalGroc = ServerFleetEngine.addNewOrder({ serviceType: 'GROCERY' });
  const illegalAccept = ServerFleetEngine.handleAction('BSL-RIDER-8942', illegalGroc.id, 'ACCEPT');
  assert.strictEqual(illegalAccept.success, false);
  assert.strictEqual(illegalAccept.code, 403, 'Server must return 403 Forbidden for new orders during passenger trip');
  console.log('✓ Passenger Exclusive Lockout successfully enforced (Zero offers & HTTP 403 on accept)');

  // Passenger Onboarding -> PASSENGER_ACTIVE
  const startPassenger = ServerFleetEngine.handleAction('BSL-RIDER-8942', passengerRide.id, 'PASSENGER_START');
  assert.strictEqual(startPassenger.success, true);
  assert.strictEqual(startPassenger.rider.state, 'PASSENGER_ACTIVE');

  // Passenger Dropoff & Completion -> Automatic return to AVAILABLE
  const completePassenger = ServerFleetEngine.handleAction('BSL-RIDER-8942', passengerRide.id, 'PASSENGER_COMPLETE');
  assert.strictEqual(completePassenger.success, true);
  assert.strictEqual(completePassenger.rider.state, 'AVAILABLE', 'Rider must return to AVAILABLE');
  const unlockedQueue = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  assert.ok(unlockedQueue.length > 0, 'Rider must receive fleet orders again after passenger completion');
  console.log('✓ After passenger dropoff, rider is automatically returned to AVAILABLE in the shared pool');

  // Test 3.6: Duplicate Assignment Prevention
  const targetOrder = unlockedQueue[0];
  const r1Accept = ServerFleetEngine.handleAction('BSL-RIDER-8942', targetOrder.id, 'ACCEPT');
  assert.strictEqual(r1Accept.success, true);

  const r2Accept = ServerFleetEngine.handleAction('BSL-RIDER-2002', targetOrder.id, 'ACCEPT');
  assert.strictEqual(r2Accept.success, false);
  assert.strictEqual(r2Accept.code, 409, 'Server must return 409 Conflict for duplicate accept');
  console.log('✓ Duplicate order acceptance prevented with HTTP 409 Conflict');

  console.log('\n================================================================');
  console.log('ALL VERIFICATION CHECKS PASSED WITH ZERO ERRORS!');
  console.log('================================================================\n');
}

testCompleteRiderSystem().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});

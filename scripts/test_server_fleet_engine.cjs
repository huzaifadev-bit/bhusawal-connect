const assert = require('assert');

// In modern Node, we can dynamically import the compiled TS or run tests on the engine logic
async function runTests() {
  console.log('--- TESTING SERVER FLEET ENGINE & DISPATCH RULES ---');

  // Let's test the fleet engine contract and rules
  const { ServerFleetEngine } = await import('../src/lib/serverFleetEngine.ts');

  ServerFleetEngine.resetAll();

  // Test 1: Shared Rider starts AVAILABLE & Online
  const r1 = ServerFleetEngine.getRider('BSL-RIDER-8942');
  assert.strictEqual(r1.isOnline, true, 'Rider should start online');
  assert.strictEqual(r1.state, 'AVAILABLE', 'Rider state should be AVAILABLE');
  console.log('✓ Test 1 Passed: Shared Rider starts ONLINE & AVAILABLE');

  // Test 2: Available orders across ALL 5 service categories
  const availableOrders = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  assert.ok(availableOrders.length >= 4, `Expected at least 4 available orders, got ${availableOrders.length}`);
  const types = new Set(availableOrders.map(o => o.serviceType));
  assert.ok(types.has('GROCERY'), 'Should include Grocery');
  assert.ok(types.has('FOOD'), 'Should include Food');
  assert.ok(types.has('MEDICINE'), 'Should include Medicine');
  assert.ok(types.has('PARCEL'), 'Should include Parcel');
  assert.ok(types.has('PASSENGER'), 'Should include Passenger ride');
  console.log('✓ Test 2 Passed: Shared fleet offers orders across ALL 5 categories (Grocery, Food, Medicine, Parcel, Passenger)');

  // Test 3: Normal Delivery Multi-Order stacking (Grocery + Food)
  const groceryOrder = availableOrders.find(o => o.serviceType === 'GROCERY');
  const resGrocery = ServerFleetEngine.handleAction('BSL-RIDER-8942', groceryOrder.id, 'ACCEPT');
  assert.strictEqual(resGrocery.success, true);
  assert.strictEqual(resGrocery.rider.state, 'GOING_TO_PICKUP');

  // Compatible Food Order should be offered as multi-order
  const afterGroceryAvail = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  // Passenger ride MUST NOT be offered when rider is carrying grocery
  const passengerOffer = afterGroceryAvail.find(o => o.serviceType === 'PASSENGER');
  assert.strictEqual(passengerOffer, undefined, 'Passenger ride must NOT be offered when rider has active deliveries');

  // Accept compatible food order
  const foodOrder = afterGroceryAvail.find(o => o.serviceType === 'FOOD');
  const resFood = ServerFleetEngine.handleAction('BSL-RIDER-8942', foodOrder.id, 'ACCEPT');
  assert.strictEqual(resFood.success, true);
  assert.strictEqual(resFood.rider.state, 'MULTI_ORDER');
  assert.strictEqual(ServerFleetEngine.getActiveOrders('BSL-RIDER-8942').length, 2);
  console.log('✓ Test 3 Passed: Multi-delivery stacking succeeded and passenger ride was blocked from offers');

  // Test 4: Passenger Exclusive Lock Rule
  // Attempting to accept a passenger ride while carrying deliveries must fail
  const passengerOrder = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-2002').find(o => o.serviceType === 'PASSENGER');
  const illegalPassenger = ServerFleetEngine.handleAction('BSL-RIDER-8942', passengerOrder.id, 'ACCEPT');
  assert.strictEqual(illegalPassenger.success, false, 'Should reject passenger ride while carrying deliveries');
  assert.strictEqual(illegalPassenger.code, 403);
  console.log('✓ Test 4 Passed: Server rejected passenger ride while carrying active deliveries (HTTP 403)');

  // Reset engine to test clean Passenger Ride flow
  ServerFleetEngine.resetAll();

  // Test 5: Clean Passenger Ride Acceptance -> PASSENGER_PICKUP -> PASSENGER_ACTIVE
  const pRide = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942').find(o => o.serviceType === 'PASSENGER');
  const pAccept = ServerFleetEngine.handleAction('BSL-RIDER-8942', pRide.id, 'ACCEPT');
  assert.strictEqual(pAccept.success, true);
  assert.strictEqual(pAccept.rider.state, 'PASSENGER_PICKUP', 'Rider must enter PASSENGER_PICKUP');

  // While in PASSENGER_PICKUP, NO orders can be dispatched
  const lockedOrders = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  assert.strictEqual(lockedOrders.length, 0, 'Zero orders can be offered during passenger pickup');

  // Even direct ACCEPT of any order must fail with 403
  const anyOrder = Array.from(ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-2002')).find(o => o.serviceType === 'FOOD');
  const illegalAccept = ServerFleetEngine.handleAction('BSL-RIDER-8942', anyOrder.id, 'ACCEPT');
  assert.strictEqual(illegalAccept.success, false);
  assert.strictEqual(illegalAccept.code, 403);
  console.log('✓ Test 5 Passed: PASSENGER_PICKUP strictly locks out 100% of other orders (Zero dispatch & HTTP 403 rejection)');

  // Test 6: Passenger Trip Active -> PASSENGER_ACTIVE
  const pStart = ServerFleetEngine.handleAction('BSL-RIDER-8942', pRide.id, 'PASSENGER_START');
  assert.strictEqual(pStart.success, true);
  assert.strictEqual(pStart.rider.state, 'PASSENGER_ACTIVE');
  assert.strictEqual(ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942').length, 0);
  console.log('✓ Test 6 Passed: PASSENGER_ACTIVE trip in progress remains completely locked');

  // Test 7: Passenger Drop-off -> Automatic return to AVAILABLE in shared fleet
  const pComplete = ServerFleetEngine.handleAction('BSL-RIDER-8942', pRide.id, 'PASSENGER_COMPLETE');
  assert.strictEqual(pComplete.success, true);
  assert.strictEqual(pComplete.rider.state, 'AVAILABLE', 'Rider must automatically return to AVAILABLE');
  const unlockedOrders = ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942');
  assert.ok(unlockedOrders.length > 0, 'Rider must again receive shared fleet orders after passenger drop-off');
  console.log('✓ Test 7 Passed: After passenger dropoff, rider is automatically returned to AVAILABLE and unblocked');

  // Test 8: Duplicate Assignment Prevention
  const freshOrder = unlockedOrders[0];
  const acceptRider1 = ServerFleetEngine.handleAction('BSL-RIDER-8942', freshOrder.id, 'ACCEPT');
  assert.strictEqual(acceptRider1.success, true);

  // Rider 2 attempts to accept the same order
  const acceptRider2 = ServerFleetEngine.handleAction('BSL-RIDER-2002', freshOrder.id, 'ACCEPT');
  assert.strictEqual(acceptRider2.success, false);
  assert.strictEqual(acceptRider2.code, 409, 'Must return 409 Conflict for duplicate acceptance');
  console.log('✓ Test 8 Passed: Duplicate acceptance strictly prevented (HTTP 409 Conflict)');

  // Deliver the active order first
  ServerFleetEngine.handleAction('BSL-RIDER-8942', freshOrder.id, 'DELIVER');

  // Test 9: Offline Duty Toggle
  const dutyOff = ServerFleetEngine.setDuty('BSL-RIDER-8942', false);
  assert.strictEqual(dutyOff.rider.isOnline, false);
  assert.strictEqual(dutyOff.rider.state, 'OFFLINE');
  assert.strictEqual(ServerFleetEngine.getAvailableDispatchOrders('BSL-RIDER-8942').length, 0, 'Offline rider receives 0 orders');
  console.log('✓ Test 9 Passed: Rider offline duty blocks all incoming orders');

  console.log('\nALL 9 SERVER FLEET ENGINE TESTS PASSED PERFECTLY!\n');
}

runTests().catch(err => {
  console.error('Test Failed:', err);
  process.exit(1);
});

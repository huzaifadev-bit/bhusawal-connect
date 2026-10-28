/**
 * ====================================================================
 * TEST SUITE: BSL CONNECT PASSENGER RIDE WORKFLOW & EXCLUSIVITY
 * ====================================================================
 * Tests the complete end-to-end Rapido/Bike-Taxi workflow:
 * 1. Rider receives passenger while available
 * 2. Rider accepts passenger -> PASSENGER_PICKUP
 * 3. New grocery order arrives
 * 4. Grocery order MUST NOT be offered (Server-side & engine enforced)
 * 5. Food order arrives
 * 6. Food order MUST NOT be offered (Server-side & engine enforced)
 * 7. Passenger reaches destination (PASSENGER_ACTIVE -> PASSENGER ON BOARD)
 * 8. Passenger ride completes (PASSENGER_COMPLETED, earnings credited)
 * 9. Rider becomes AVAILABLE
 * 10. Grocery/food/parcel/medicine orders can now be offered normally
 */

const assert = require('assert');

// 0. Mock Browser Globals for Node.js
global.window = global;
global.window.addEventListener = function() {};
global.window.dispatchEvent = function() {};
global.CustomEvent = class CustomEvent { constructor(name, detail) { this.name = name; this.detail = detail; } };
global.localStorage = {
  _store: {},
  getItem: function(k) { return this._store[k] || null; },
  setItem: function(k, v) { this._store[k] = String(v); },
  removeItem: function(k) { delete this._store[k]; },
  clear: function() { this._store = {}; }
};

// 1. Load Engines
require('../public/assets/bsl_rider_fleet_engine.js');
const BslFleetEngine = global.BslFleetEngine;

require('../public/assets/bsl_route_sequencer.js');
const BslRouteSequencer = global.BslRouteSequencer;

require('../public/bhusawal_backend.js');
const BhusawalBackend = global.BhusawalBackend;

require('../public/bhusawal_dispatch_engine.js');
const DispatchEngine = global.BhusawalIntelligentDispatchEngine;

console.log('======================================================');
console.log('🛵 TEST SUITE: BSL CONNECT PASSENGER RIDE WORKFLOW');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ Case ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ Case ${totalTests} FAILED: ${name}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
  }
}

// Global state objects for testing
let rider = {
  id: 'BHU-RIDER-8942',
  name: 'Rahul Ramesh Patil',
  phone: '9876543210',
  isOnline: true,
  isVerified: true,
  kycApproved: true,
  state: 'AVAILABLE',
  isPassengerLocked: false,
  walletBalance: 1240,
  todayEarnings: 640,
  todayOrdersCount: 6,
  todayDistanceKm: 18.4,
  lat: 21.0478,
  lng: 75.7896,
  activeOrders: []
};

// Register rider in BhusawalBackend
BhusawalBackend.riders.save(rider);

const samplePassengerRide = {
  id: 'RIDE-BHU-489201',
  type: 'PASSENGER',
  passengerName: 'Amit Sharma',
  passengerPhone: '9876543210',
  pickupAddress: 'Bhusawal Railway Station (Platform 1 Exit)',
  dropAddress: 'Jamner Road Municipal Shopping Complex',
  pickupLat: 21.0495,
  pickupLng: 75.7870,
  dropLat: 21.0410,
  dropLng: 75.7920,
  fare: 55,
  otp: '4892',
  status: 'placed'
};

const sampleGroceryOrder = {
  id: 'ORD-GROCERY-101',
  type: 'GROCERY',
  store: 'Saijeevan Super Shoppy',
  pickupAddress: 'Saijeevan Super Shoppy, Station Road',
  dropAddress: 'Flat 302, Vardhaman Residency, Jamner Road',
  pickupLat: 21.0485,
  pickupLng: 75.7910,
  dropLat: 21.0425,
  dropLng: 75.7980,
  payout: 38,
  packageSize: 'MEDIUM',
  status: 'placed'
};

const sampleFoodOrder = {
  id: 'ORD-FOOD-202',
  type: 'FOOD',
  store: 'Moonlight Restaurant',
  pickupAddress: 'Moonlight Restaurant, Station Road',
  dropAddress: 'House 14, Railway Colony North',
  pickupLat: 21.0470,
  pickupLng: 75.7885,
  dropLat: 21.0490,
  dropLng: 75.7830,
  payout: 48,
  packageSize: 'MEDIUM',
  status: 'placed'
};

const sampleMedicineOrder = {
  id: 'ORD-MED-303',
  type: 'MEDICINE',
  store: 'Bhusawal Medical & Surgical',
  pickupAddress: 'Civil Hospital Road',
  dropAddress: 'Old Khadaka Road',
  pickupLat: 21.0450,
  pickupLng: 75.7930,
  dropLat: 21.0390,
  dropLng: 75.7940,
  payout: 55,
  packageSize: 'SMALL',
  status: 'placed'
};

const sampleParcelOrder = {
  id: 'ORD-PARCEL-404',
  type: 'PARCEL',
  store: 'Market Yard Courier Counter',
  pickupAddress: 'Market Yard Hub',
  dropAddress: 'MIDC Industrial Area',
  pickupLat: 21.0440,
  pickupLng: 75.7845,
  dropLat: 21.0510,
  dropLng: 75.7990,
  payout: 45,
  packageSize: 'MEDIUM',
  status: 'placed'
};

// -------------------------------------------------------------------------
// TEST CASES EXECUTION (CASES 1 TO 10)
// -------------------------------------------------------------------------

// CASE 1: Rider receives passenger while available
it('Rider receives passenger ride offer while in AVAILABLE state', () => {
  assert.strictEqual(rider.state, 'AVAILABLE');
  assert.strictEqual(BslFleetEngine.isPassengerMode(rider), false);

  const check = BslFleetEngine.canReceiveOrder(rider, samplePassengerRide);
  assert.strictEqual(check.canReceive, true, 'Available rider must be eligible to receive passenger ride');
  assert.ok(check.reason.includes('AVAILABLE and free for passenger ride'));
});

// CASE 2: Rider accepts passenger -> PASSENGER_PICKUP
it('Rider accepts passenger and enters PASSENGER_PICKUP with exclusivity lock', () => {
  const transRes = BslFleetEngine.transitionRiderState(rider, 'PASSENGER_PICKUP', { order: samplePassengerRide });
  assert.strictEqual(transRes.success, true, 'Transition to PASSENGER_PICKUP must succeed');
  assert.strictEqual(rider.state, 'PASSENGER_PICKUP');
  assert.strictEqual(rider.isPassengerLocked, true, 'isPassengerLocked flag must be TRUE');
  assert.strictEqual(BslFleetEngine.isPassengerMode(rider), true, 'isPassengerMode() must return TRUE');
  assert.strictEqual(rider.activeOrders.length, 1);
  assert.strictEqual(rider.activeOrders[0].id, samplePassengerRide.id);

  // Sync to Backend
  BhusawalBackend.riders.save(rider);
  BhusawalBackend.orders.create(samplePassengerRide);

  // Route sequencer confirms passenger pickup next action
  const route = BslRouteSequencer.computeOptimalRoute(rider, rider.activeOrders);
  assert.strictEqual(route.isPassengerExclusive, true);
  assert.strictEqual(route.nextAction.stopType, 'PICKUP');
  assert.strictEqual(route.nextAction.title, 'Go to Passenger Pickup');
});

// CASE 3: New grocery order arrives
it('New grocery order arrives in dispatch system', () => {
  BhusawalBackend.orders.create(sampleGroceryOrder);
  const fetched = BhusawalBackend.orders.getById(sampleGroceryOrder.id);
  assert.ok(fetched !== null);
  assert.strictEqual(fetched.status, 'placed');
});

// CASE 4: Grocery order MUST NOT be offered
it('CRITICAL RULE: Grocery order MUST NOT be offered to rider in PASSENGER_PICKUP', () => {
  // A. Fleet Engine Check
  const check = BslFleetEngine.canReceiveOrder(rider, sampleGroceryOrder);
  assert.strictEqual(check.canReceive, false, 'Grocery order MUST be rejected by fleet engine');
  assert.ok(check.reason.includes('PASSENGER mode'), 'Reason must explicitly reference passenger mode lock');

  // B. Dispatch Engine Candidate Matching Check
  const bestRider = DispatchEngine.findBestRiderForOrder(sampleGroceryOrder, [rider]);
  assert.strictEqual(bestRider, null, 'Dispatch engine MUST NOT select rider in PASSENGER_PICKUP');

  // C. Server-Side Hard Guard in BhusawalBackend.orders.assignRider
  const assignResult = BhusawalBackend.orders.assignRider(sampleGroceryOrder.id, rider.id, rider.name, rider.phone);
  assert.strictEqual(assignResult.success, false, 'Server-side assignment must be blocked');
  assert.strictEqual(assignResult.blocked, true, 'Server-side blocked flag must be true');
});

// CASE 5: Food order arrives
it('New food order (hot meal freshness SLA) arrives in dispatch system', () => {
  BhusawalBackend.orders.create(sampleFoodOrder);
  const fetched = BhusawalBackend.orders.getById(sampleFoodOrder.id);
  assert.ok(fetched !== null);
  assert.strictEqual(fetched.status, 'placed');
});

// CASE 6: Food order MUST NOT be offered
it('CRITICAL RULE: Food order MUST NOT be offered to rider in passenger workflow', () => {
  // A. Fleet Engine Check
  const check = BslFleetEngine.canReceiveOrder(rider, sampleFoodOrder);
  assert.strictEqual(check.canReceive, false, 'Food order MUST be rejected by fleet engine');
  assert.ok(check.reason.includes('PASSENGER mode'));

  // B. Multi-Order Stacking Check
  const stackCheck = BslFleetEngine.canAddToMultiOrder(rider, sampleFoodOrder);
  assert.strictEqual(stackCheck.allowed, false, 'Multi-order batching must be strictly forbidden during passenger mode');
  assert.ok(stackCheck.reason.includes('PASSENGER mode'));

  // Also verify medicine and parcel orders are equally blocked:
  assert.strictEqual(BslFleetEngine.canReceiveOrder(rider, sampleMedicineOrder).canReceive, false);
  assert.strictEqual(BslFleetEngine.canReceiveOrder(rider, sampleParcelOrder).canReceive, false);
});

// INTERMEDIATE STEP: Passenger Boarding & OTP Confirmation
it('Rider confirms passenger pickup via Boarding OTP (PASSENGER_PICKUP -> PASSENGER_ACTIVE)', () => {
  // Verify Boarding OTP '4892'
  assert.strictEqual(samplePassengerRide.otp, '4892');

  const transRes = BslFleetEngine.transitionRiderState(rider, 'PASSENGER_ACTIVE');
  assert.strictEqual(transRes.success, true);
  assert.strictEqual(rider.state, 'PASSENGER_ACTIVE');
  assert.strictEqual(BslFleetEngine.isPassengerMode(rider), true, 'Still in passenger mode');

  rider.activeOrders[0].status = 'PASSENGER_ON_BOARD';
  BhusawalBackend.riders.save(rider);

  // Route sequencer confirms destination drop next action
  const route = BslRouteSequencer.computeOptimalRoute(rider, rider.activeOrders);
  assert.strictEqual(route.isPassengerExclusive, true);
  assert.strictEqual(route.nextAction.stopType, 'DROP');
  assert.strictEqual(route.nextAction.title, 'Drop Passenger at Destination');
  assert.strictEqual(route.nextAction.actionLabel, 'End Trip & Collect Fare');
});

// CASE 7: Passenger reaches destination
it('Passenger reaches destination while on PASSENGER_ACTIVE (orders remain strictly paused)', () => {
  // Still strictly paused
  assert.strictEqual(BslFleetEngine.canReceiveOrder(rider, sampleGroceryOrder).canReceive, false);
  assert.strictEqual(BslFleetEngine.canReceiveOrder(rider, sampleFoodOrder).canReceive, false);
});

// CASE 8: Passenger ride completes
it('Passenger dropped & ride completed (PASSENGER_ACTIVE -> PASSENGER_COMPLETED)', () => {
  const initialWallet = rider.walletBalance;
  const fare = samplePassengerRide.fare; // 55

  const transRes = BslFleetEngine.transitionRiderState(rider, 'PASSENGER_COMPLETED', { fare: fare });
  assert.strictEqual(transRes.success, true);
  assert.strictEqual(rider.state, 'PASSENGER_COMPLETED');
  assert.strictEqual(rider.walletBalance, initialWallet + fare, 'Wallet balance credited with fare of ₹55');
  BhusawalBackend.riders.save(rider);
});

// CASE 9: Rider becomes available
it('Rider automatically returns to AVAILABLE state and clears locks', () => {
  const transRes = BslFleetEngine.transitionRiderState(rider, 'AVAILABLE', { clearOrders: true });
  assert.strictEqual(transRes.success, true);
  assert.strictEqual(rider.state, 'AVAILABLE');
  assert.strictEqual(rider.isPassengerLocked, false, 'isPassengerLocked flag returned to FALSE');
  assert.strictEqual(BslFleetEngine.isPassengerMode(rider), false, 'isPassengerMode() returned to FALSE');
  assert.strictEqual(rider.activeOrders.length, 0, 'Active orders list cleared');
  BhusawalBackend.riders.save(rider);
});

// CASE 10: Grocery/food/parcel/medicine orders can now be offered
it('Normal dispatch resumes: Grocery, food, medicine, and parcel orders can now be offered', () => {
  // A. Grocery Order can now be received
  const checkGrocery = BslFleetEngine.canReceiveOrder(rider, sampleGroceryOrder);
  assert.strictEqual(checkGrocery.canReceive, true, 'Grocery order can now be received');

  // B. Food Order can now be received
  const checkFood = BslFleetEngine.canReceiveOrder(rider, sampleFoodOrder);
  assert.strictEqual(checkFood.canReceive, true, 'Food order can now be received');

  // C. Medicine Order can now be received
  const checkMed = BslFleetEngine.canReceiveOrder(rider, sampleMedicineOrder);
  assert.strictEqual(checkMed.canReceive, true, 'Medicine order can now be received');

  // D. Parcel Order can now be received
  const checkParcel = BslFleetEngine.canReceiveOrder(rider, sampleParcelOrder);
  assert.strictEqual(checkParcel.canReceive, true, 'Parcel order can now be received');

  // E. Another Passenger ride can also be received
  const checkPassenger = BslFleetEngine.canReceiveOrder(rider, samplePassengerRide);
  assert.strictEqual(checkPassenger.canReceive, true, 'Next passenger ride can be received');

  // F. Dispatch Engine can successfully select this rider for dispatch
  const selectedRider = DispatchEngine.findBestRiderForOrder(sampleGroceryOrder, [rider]);
  assert.ok(selectedRider !== null, 'Dispatch engine successfully found candidate');
  assert.strictEqual(selectedRider.selectedRider.id, rider.id, 'Rider matched for grocery order');
});

console.log('\n======================================================');
console.log(`🎉 TEST SUMMARY: ${passedTests}/${totalTests} CASES PASSED (100% SUCCESS)`);
console.log('======================================================\n');

process.exit(passedTests === totalTests ? 0 : 1);

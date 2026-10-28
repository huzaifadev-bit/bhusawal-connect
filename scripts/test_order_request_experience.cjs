/**
 * ====================================================================
 * BSL CONNECT — UNIFIED ORDER REQUEST EXPERIENCE TEST SUITE
 * ====================================================================
 * Verifies all 6 order verticals:
 * 1. 🛒 GROCERY
 * 2. 🍔 FOOD
 * 3. 💊 MEDICINE
 * 4. 📦 PARCEL
 * 5. 🔄 PICKUP & DROP
 * 6. 🛵 PASSENGER
 * 
 * Verifies:
 * - Card information & visual identity
 * - Priority indicators (High Freshness for Food, Critical High Priority for Medicine)
 * - Package details (Package size for Parcel, Errand details for Pickup & Drop)
 * - Passenger Ride styling & Exclusivity warning
 * - Backend rule enforcement:
 *   - Accepting passenger ride stops all new order offers
 *   - Backend rejects incoming orders while rider is in passenger mode
 *   - Frontend cannot fake state differing from backend state
 */

const assert = require('assert');
require('../public/assets/bsl_rider_fleet_engine.js');
require('../public/assets/bsl_order_request_engine.js');

const BslFleetEngine = globalThis.BslFleetEngine;
const BslOrderRequestEngine = globalThis.BslOrderRequestEngine;

let passCount = 0;
let failCount = 0;

function it(desc, fn) {
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passCount++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     Error: ${err.message}`);
    failCount++;
  }
}

console.log('\n======================================================');
console.log('TEST SUITE 1: ALL 6 ORDER VERTICALS & CONFIGURATIONS');
console.log('======================================================');

const configs = BslOrderRequestEngine.ORDER_CONFIGS;

it('Supports exactly 6 canonical order types', () => {
  const types = Object.keys(configs);
  assert.strictEqual(types.length, 6);
  assert.ok(types.includes('GROCERY'));
  assert.ok(types.includes('FOOD'));
  assert.ok(types.includes('MEDICINE'));
  assert.ok(types.includes('PARCEL'));
  assert.ok(types.includes('PICKUP_DROP'));
  assert.ok(types.includes('PASSENGER'));
});

it('GROCERY: Config contains required fields and correct title', () => {
  const c = configs.GROCERY;
  assert.strictEqual(c.title, 'GROCERY DELIVERY');
  assert.strictEqual(c.icon, 'shopping_basket');
  assert.strictEqual(c.defaultEarning, 38);
  assert.ok(c.defaultPickup.includes('Saijeevan Super Shoppy'));
  assert.strictEqual(c.defaultPickupDist, '1.2 km');
  assert.strictEqual(c.defaultDropDist, '2.4 km');
  assert.ok(c.defaultPackageInfo.includes('Bags') || c.defaultPackageInfo.includes('Items'));
});

it('FOOD: Config contains Freshness SLA priority and restaurant details', () => {
  const c = configs.FOOD;
  assert.strictEqual(c.title, 'FOOD DELIVERY');
  assert.strictEqual(c.icon, 'restaurant');
  assert.ok(c.defaultPriorityText.includes('Freshness') || c.defaultPriorityText.includes('Hot Meal'));
  assert.ok(c.defaultPickup.includes('Royal Biryani'));
  assert.ok(c.defaultEarning > 0);
  assert.ok(c.defaultPickupDist);
  assert.ok(c.defaultDropDist);
});

it('MEDICINE: Config contains prominent CRITICAL HIGH PRIORITY indicator', () => {
  const c = configs.MEDICINE;
  assert.strictEqual(c.title, 'MEDICINE DELIVERY');
  assert.strictEqual(c.icon, 'medical_services');
  assert.ok(c.defaultPriorityText.includes('HIGH PRIORITY') || c.defaultPriorityText.includes('CRITICAL'));
  assert.ok(c.priorityBadge.includes('pulse'));
  assert.ok(c.defaultPickup.includes('Medical') || c.defaultPickup.includes('Hospital'));
  assert.strictEqual(c.defaultEarning, 55);
});

it('PARCEL: Config contains package size, dimensions, and weight', () => {
  const c = configs.PARCEL;
  assert.strictEqual(c.title, 'PARCEL DELIVERY');
  assert.strictEqual(c.icon, 'inventory_2');
  assert.ok(c.packageSize || c.defaultPackageInfo.includes('Size'));
  assert.ok(c.defaultPackageInfo.includes('Weight') || c.defaultPackageInfo.includes('Dimensions') || c.defaultPackageInfo.includes('Medium'));
  assert.ok(c.defaultPickup.includes('Courier') || c.defaultPickup.includes('Market Yard'));
});

it('PICKUP & DROP: Config contains errand details and point-to-point locations', () => {
  const c = configs.PICKUP_DROP;
  assert.strictEqual(c.title, 'PICKUP & DROP');
  assert.strictEqual(c.icon, 'swap_horiz');
  assert.ok(c.defaultPackageInfo.includes('Keys') || c.defaultPackageInfo.includes('Errand') || c.defaultPackageInfo.includes('Documents'));
  assert.ok(c.defaultPickup);
  assert.ok(c.defaultDrop);
  assert.ok(c.defaultEarning > 0);
});

it('PASSENGER: Dedicated ride-style card with exact exclusivity warning', () => {
  const c = configs.PASSENGER;
  assert.strictEqual(c.title, 'NEW PASSENGER RIDE');
  assert.strictEqual(c.icon, 'two_wheeler');
  assert.strictEqual(c.isPassengerRide, true);
  assert.strictEqual(c.exclusivityNotice, 'Accepting this ride will temporarily pause other order requests.');
  assert.ok(c.badgeBg.includes('bg-amber-400'));
  assert.ok(c.headerGradient.includes('amber'));
  assert.ok(c.defaultPackageInfo.includes('Passenger') || c.defaultPackageInfo.includes('Amit Sharma'));
});

console.log('\n======================================================');
console.log('TEST SUITE 2: BACKEND PASSENGER EXCLUSIVITY ENFORCEMENT');
console.log('======================================================');

const mockAvailableRider = {
  id: 'BHU-RIDER-8942',
  phone: '9876543210',
  name: 'Rahul Patil',
  isOnline: true,
  isVerified: true,
  kycApproved: true,
  state: 'AVAILABLE',
  activeOrders: [],
  activeOrderId: null
};

it('AVAILABLE rider can accept PASSENGER ride in backend engine', () => {
  const passengerOrder = {
    id: 'RIDE-101',
    type: 'PASSENGER',
    pickupAddress: 'Bhusawal Railway Station',
    dropAddress: 'Jamner Road Square',
    fare: 65
  };
  const check = BslFleetEngine.canAcceptOrder(mockAvailableRider, passengerOrder);
  assert.strictEqual(check.canAccept, true);
});

it('Accepting passenger ride transitions backend state to PASSENGER_PICKUP', () => {
  const rider = JSON.parse(JSON.stringify(mockAvailableRider));
  const passengerOrder = {
    id: 'RIDE-101',
    type: 'PASSENGER',
    pickupAddress: 'Bhusawal Railway Station',
    dropAddress: 'Jamner Road Square',
    fare: 65
  };

  const transitionRes = BslFleetEngine.transitionRiderState(rider, 'PASSENGER_PICKUP', { order: passengerOrder });
  assert.strictEqual(transitionRes.success, true);
  assert.strictEqual(rider.state, 'PASSENGER_PICKUP');
  assert.strictEqual(BslFleetEngine.isPassengerMode(rider), true);
  assert.strictEqual(rider.isPassengerLocked, true);
});

it('Backend strictly BLOCKS GROCERY offers when rider is in PASSENGER_PICKUP', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_PICKUP',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER' }]
  };

  const groceryOrder = { id: 'GROC-201', type: 'GROCERY' };
  const res = BslFleetEngine.canReceiveOrder(passengerRider, groceryOrder);
  assert.strictEqual(res.canReceive, false);
  assert.ok(res.reason.includes('PASSENGER mode'));
});

it('Backend strictly BLOCKS FOOD offers when rider is in PASSENGER_PICKUP', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_PICKUP',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER' }]
  };

  const foodOrder = { id: 'FOOD-202', type: 'FOOD' };
  const res = BslFleetEngine.canReceiveOrder(passengerRider, foodOrder);
  assert.strictEqual(res.canReceive, false);
  assert.ok(res.reason.includes('PASSENGER mode'));
});

it('Backend strictly BLOCKS MEDICINE offers when rider is in PASSENGER_PICKUP', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_PICKUP',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER' }]
  };

  const medOrder = { id: 'MED-203', type: 'MEDICINE' };
  const res = BslFleetEngine.canReceiveOrder(passengerRider, medOrder);
  assert.strictEqual(res.canReceive, false);
  assert.ok(res.reason.includes('PASSENGER mode'));
});

it('Backend strictly BLOCKS PARCEL offers when rider is in PASSENGER_ACTIVE', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_ACTIVE',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER' }]
  };

  const parcelOrder = { id: 'PARCEL-204', type: 'PARCEL' };
  const res = BslFleetEngine.canReceiveOrder(passengerRider, parcelOrder);
  assert.strictEqual(res.canReceive, false);
  assert.ok(res.reason.includes('PASSENGER mode'));
});

it('Backend strictly BLOCKS PICKUP_DROP offers when rider is in PASSENGER_ACTIVE', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_ACTIVE',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER' }]
  };

  const errandOrder = { id: 'ERRAND-205', type: 'PICKUP_DROP' };
  const res = BslFleetEngine.canReceiveOrder(passengerRider, errandOrder);
  assert.strictEqual(res.canReceive, false);
  assert.ok(res.reason.includes('PASSENGER mode'));
});

it('Backend strictly BLOCKS second PASSENGER ride when already on a passenger trip', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_ACTIVE',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER' }]
  };

  const rideOrder = { id: 'RIDE-102', type: 'PASSENGER' };
  const res = BslFleetEngine.canReceiveOrder(passengerRider, rideOrder);
  assert.strictEqual(res.canReceive, false);
  assert.ok(res.reason.includes('PASSENGER mode'));
});

console.log('\n======================================================');
console.log('TEST SUITE 3: PREVENT FAKE FRONTEND STATES & RESUMPTION');
console.log('======================================================');

it('Rider with active GROCERY order cannot fake accept PASSENGER ride', () => {
  const busyDeliveryRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'DELIVERING',
    activeOrders: [{ id: 'GROC-99', type: 'GROCERY' }]
  };

  const passengerOrder = { id: 'RIDE-103', type: 'PASSENGER' };
  const check = BslFleetEngine.canAcceptOrder(busyDeliveryRider, passengerOrder);
  assert.strictEqual(check.canAccept, false);
  assert.ok(check.reason.includes('exclusive vehicle'));
});

it('Offline rider cannot accept any order request', () => {
  const offlineRider = {
    id: 'BHU-RIDER-8942',
    isOnline: false,
    isVerified: true,
    kycApproved: true,
    state: 'OFFLINE',
    activeOrders: []
  };

  const order = { id: 'GROC-100', type: 'GROCERY' };
  const check = BslFleetEngine.canAcceptOrder(offlineRider, order);
  assert.strictEqual(check.canAccept, false);
  assert.ok(check.reason.includes('OFFLINE'));
});

it('Unapproved KYC rider cannot accept any order request', () => {
  const unapprovedRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: false,
    kycApproved: false,
    state: 'AVAILABLE',
    activeOrders: []
  };

  const order = { id: 'MED-100', type: 'MEDICINE' };
  const check = BslFleetEngine.canAcceptOrder(unapprovedRider, order);
  assert.strictEqual(check.canAccept, false);
  assert.ok(check.reason.includes('KYC is not approved'));
});

it('Passenger completion unlocks exclusivity and restores normal multi-vertical matching', () => {
  const passengerRider = {
    id: 'BHU-RIDER-8942',
    isOnline: true,
    isVerified: true,
    kycApproved: true,
    state: 'PASSENGER_ACTIVE',
    isPassengerLocked: true,
    activeOrders: [{ id: 'RIDE-101', type: 'PASSENGER', fare: 65 }]
  };

  // Step 1: Complete trip
  const res1 = BslFleetEngine.transitionRiderState(passengerRider, 'PASSENGER_COMPLETED', { fare: 65 });
  assert.strictEqual(res1.success, true);
  assert.strictEqual(passengerRider.state, 'PASSENGER_COMPLETED');

  // Step 2: Return to AVAILABLE
  const res2 = BslFleetEngine.transitionRiderState(passengerRider, 'AVAILABLE');
  assert.strictEqual(res2.success, true);
  assert.strictEqual(passengerRider.state, 'AVAILABLE');
  assert.strictEqual(BslFleetEngine.isPassengerMode(passengerRider), false);
  assert.strictEqual(passengerRider.activeOrders.length, 0);

  // Step 3: Now any delivery vertical can be received again
  const groceryCheck = BslFleetEngine.canReceiveOrder(passengerRider, { id: 'G-1', type: 'GROCERY' });
  assert.strictEqual(groceryCheck.canReceive, true);

  const foodCheck = BslFleetEngine.canReceiveOrder(passengerRider, { id: 'F-1', type: 'FOOD' });
  assert.strictEqual(foodCheck.canReceive, true);

  const medCheck = BslFleetEngine.canReceiveOrder(passengerRider, { id: 'M-1', type: 'MEDICINE' });
  assert.strictEqual(medCheck.canReceive, true);

  const parcelCheck = BslFleetEngine.canReceiveOrder(passengerRider, { id: 'P-1', type: 'PARCEL' });
  assert.strictEqual(parcelCheck.canReceive, true);

  const errandCheck = BslFleetEngine.canReceiveOrder(passengerRider, { id: 'E-1', type: 'PICKUP_DROP' });
  assert.strictEqual(errandCheck.canReceive, true);

  const rideCheck = BslFleetEngine.canReceiveOrder(passengerRider, { id: 'R-1', type: 'PASSENGER' });
  assert.strictEqual(rideCheck.canReceive, true);
});

console.log('\n======================================================');
console.log(`TOTAL RESULTS: ${passCount} PASSED | ${failCount} FAILED`);
console.log('======================================================\n');

if (failCount > 0) {
  process.exit(1);
}

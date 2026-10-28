/**
 * Test Suite: BSL Connect Rider Partner Fleet Architecture & State Engine
 * Run with: node scripts/test_rider_fleet_engine.cjs
 */

require('../public/assets/bsl_rider_fleet_engine.js');
const engine = globalThis.BslFleetEngine;
const { ORDER_TYPES, RIDER_STATES } = engine;

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`  ✅ PASS: ${message}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${message}`);
    failed++;
  }
}

console.log('\n======================================================');
console.log('TEST SUITE 1: ALL 11 RIDER STATES & TRANSITION INTEGRITY');
console.log('======================================================');

const states = [
  'OFFLINE', 'AVAILABLE', 'GOING_TO_PICKUP', 'AT_PICKUP',
  'PICKED_UP', 'DELIVERING', 'MULTI_ORDER', 'PASSENGER_PICKUP',
  'PASSENGER_ACTIVE', 'PASSENGER_COMPLETED', 'SUSPENDED'
];

states.forEach(s => {
  assert(RIDER_STATES[s] === s, `Rider state ${s} is defined and matches enum`);
});

// Test Legal Transitions
assert(engine.validateStateTransition('OFFLINE', 'AVAILABLE').valid, 'OFFLINE -> AVAILABLE is legal');
assert(engine.validateStateTransition('AVAILABLE', 'GOING_TO_PICKUP').valid, 'AVAILABLE -> GOING_TO_PICKUP is legal');
assert(engine.validateStateTransition('GOING_TO_PICKUP', 'AT_PICKUP').valid, 'GOING_TO_PICKUP -> AT_PICKUP is legal');
assert(engine.validateStateTransition('AT_PICKUP', 'PICKED_UP').valid, 'AT_PICKUP -> PICKED_UP is legal');
assert(engine.validateStateTransition('PICKED_UP', 'DELIVERING').valid, 'PICKED_UP -> DELIVERING is legal');
assert(engine.validateStateTransition('DELIVERING', 'MULTI_ORDER').valid, 'DELIVERING -> MULTI_ORDER is legal');
assert(engine.validateStateTransition('DELIVERING', 'AVAILABLE').valid, 'DELIVERING -> AVAILABLE is legal (order completed)');

// Test Passenger Lifecycle Transitions
assert(engine.validateStateTransition('AVAILABLE', 'PASSENGER_PICKUP').valid, 'AVAILABLE -> PASSENGER_PICKUP is legal');
assert(engine.validateStateTransition('PASSENGER_PICKUP', 'PASSENGER_ACTIVE').valid, 'PASSENGER_PICKUP -> PASSENGER_ACTIVE is legal');
assert(engine.validateStateTransition('PASSENGER_ACTIVE', 'PASSENGER_COMPLETED').valid, 'PASSENGER_ACTIVE -> PASSENGER_COMPLETED is legal');
assert(engine.validateStateTransition('PASSENGER_COMPLETED', 'AVAILABLE').valid, 'PASSENGER_COMPLETED -> AVAILABLE is legal');

// Test Illegal Transitions
assert(!engine.validateStateTransition('OFFLINE', 'DELIVERING').valid, 'OFFLINE -> DELIVERING is strictly illegal');
assert(!engine.validateStateTransition('PASSENGER_PICKUP', 'MULTI_ORDER').valid, 'PASSENGER_PICKUP -> MULTI_ORDER is strictly illegal');
assert(!engine.validateStateTransition('PASSENGER_ACTIVE', 'GOING_TO_PICKUP').valid, 'PASSENGER_ACTIVE -> GOING_TO_PICKUP is strictly illegal');
assert(!engine.validateStateTransition('PASSENGER_ACTIVE', 'AVAILABLE').valid, 'PASSENGER_ACTIVE -> AVAILABLE is illegal (must complete first)');

console.log('\n======================================================');
console.log('TEST SUITE 2: STRICT PASSENGER EXCLUSIVITY RULE');
console.log('======================================================');

// Setup Rider in PASSENGER_PICKUP
const passengerRider = {
  id: 'BHU-RIDER-TEST-1',
  name: 'Kunal Patil',
  state: RIDER_STATES.PASSENGER_PICKUP,
  isOnline: true,
  kycApproved: true,
  activeOrders: [{ id: 'RIDE-1', type: ORDER_TYPES.PASSENGER }]
};

assert(engine.isPassengerMode(passengerRider), 'isPassengerMode() returns true for rider in PASSENGER_PICKUP');

// Verify rider in PASSENGER_PICKUP cannot receive ANY order
const groceryOrder = { id: 'ORD-G1', type: ORDER_TYPES.GROCERY, pickupLat: 21.047, pickupLng: 75.789 };
const foodOrder = { id: 'ORD-F1', type: ORDER_TYPES.FOOD, pickupLat: 21.047, pickupLng: 75.789 };
const medicineOrder = { id: 'ORD-M1', type: ORDER_TYPES.MEDICINE, pickupLat: 21.047, pickupLng: 75.789 };
const parcelOrder = { id: 'ORD-P1', type: ORDER_TYPES.PARCEL, pickupLat: 21.047, pickupLng: 75.789 };
const newPassengerOrder = { id: 'RIDE-2', type: ORDER_TYPES.PASSENGER, pickupLat: 21.047, pickupLng: 75.789 };

assert(!engine.canReceiveOrder(passengerRider, groceryOrder).canReceive, 'Passenger rider cannot receive GROCERY order');
assert(!engine.canReceiveOrder(passengerRider, foodOrder).canReceive, 'Passenger rider cannot receive FOOD order');
assert(!engine.canReceiveOrder(passengerRider, medicineOrder).canReceive, 'Passenger rider cannot receive MEDICINE order');
assert(!engine.canReceiveOrder(passengerRider, parcelOrder).canReceive, 'Passenger rider cannot receive PARCEL order');
assert(!engine.canReceiveOrder(passengerRider, newPassengerOrder).canReceive, 'Passenger rider cannot receive another PASSENGER order');

// Advance to PASSENGER_ACTIVE
engine.transitionRiderState(passengerRider, RIDER_STATES.PASSENGER_ACTIVE);
assert(passengerRider.state === RIDER_STATES.PASSENGER_ACTIVE, 'Rider transitioned to PASSENGER_ACTIVE');
assert(engine.isPassengerMode(passengerRider), 'isPassengerMode() returns true for PASSENGER_ACTIVE');
assert(!engine.canReceiveOrder(passengerRider, groceryOrder).canReceive, 'Rider in PASSENGER_ACTIVE cannot receive GROCERY order');

// Advance to PASSENGER_COMPLETED
engine.transitionRiderState(passengerRider, RIDER_STATES.PASSENGER_COMPLETED, { fare: 65 });
assert(passengerRider.state === RIDER_STATES.PASSENGER_COMPLETED, 'Rider transitioned to PASSENGER_COMPLETED');
assert(passengerRider.walletBalance === 65, 'Rider wallet credited with passenger fare');

// Return to AVAILABLE
engine.transitionRiderState(passengerRider, RIDER_STATES.AVAILABLE, { clearOrders: true });
assert(passengerRider.state === RIDER_STATES.AVAILABLE, 'Rider returned to AVAILABLE');
assert(!engine.isPassengerMode(passengerRider), 'Rider is no longer in passenger mode');

// Normal order matching resumes
assert(engine.canReceiveOrder(passengerRider, groceryOrder).canReceive, 'AVAILABLE rider can now receive normal GROCERY order');

console.log('\n======================================================');
console.log('TEST SUITE 3: BUSY DELIVERY RIDER CANNOT RECEIVE RIDES');
console.log('======================================================');

const busyDeliveryRider = {
  id: 'BHU-RIDER-TEST-2',
  name: 'Amol Jadhav',
  state: RIDER_STATES.DELIVERING,
  isOnline: true,
  kycApproved: true,
  activeOrders: [{ id: 'ORD-FOOD-1', type: ORDER_TYPES.FOOD }]
};

const rideRequest = { id: 'RIDE-NEW', type: ORDER_TYPES.PASSENGER, pickupLat: 21.047, pickupLng: 75.789 };
const checkRideOnDelivery = engine.canReceiveOrder(busyDeliveryRider, rideRequest);
assert(!checkRideOnDelivery.canReceive, 'Busy delivery rider CANNOT receive passenger ride');
assert(checkRideOnDelivery.reason.includes('Passenger rides require 100% exclusive vehicle'), 'Reason explains exclusivity requirement');

console.log('\n======================================================');
console.log('TEST SUITE 4: MULTI-ORDER DISPATCH & CAPACITY RULES');
console.log('======================================================');

const deliveryRider = {
  id: 'BHU-RIDER-TEST-3',
  name: 'Suresh Patil',
  state: RIDER_STATES.DELIVERING,
  isOnline: true,
  kycApproved: true,
  lat: 21.0478,
  lng: 75.7896,
  activeOrders: [
    {
      id: 'ORD-G-1',
      type: ORDER_TYPES.GROCERY,
      packageSize: 'MEDIUM',
      dropLat: 21.0480,
      dropLng: 75.7900
    }
  ]
};

// 1. Compatible nearby food order
const compatibleFoodOrder = {
  id: 'ORD-F-2',
  type: ORDER_TYPES.FOOD,
  packageSize: 'MEDIUM',
  pickupLat: 21.0482,
  pickupLng: 75.7905,
  dropLat: 21.0490,
  dropLng: 75.7915
};

const multiCheck1 = engine.canAddToMultiOrder(deliveryRider, compatibleFoodOrder);
assert(multiCheck1.allowed, `Nearby food order can be added to multi-order batch (${multiCheck1.detourKm} km detour)`);

// 2. Distant order exceeding detour limit
const distantOrder = {
  id: 'ORD-FAR-1',
  type: ORDER_TYPES.GROCERY,
  packageSize: 'MEDIUM',
  pickupLat: 21.1200, // Very far outside city center
  pickupLng: 75.8900,
  dropLat: 21.1300,
  dropLng: 75.8950
};

const multiCheck2 = engine.canAddToMultiOrder(deliveryRider, distantOrder);
assert(!multiCheck2.allowed, 'Order exceeding detour limit is rejected from multi-order batch');
assert(multiCheck2.reason.includes('exceeds limit'), 'Reason indicates detour limit exceeded');

// 3. Stacking capacity test (up to max 3 delivery orders)
const stackedRider = {
  id: 'BHU-RIDER-TEST-4',
  name: 'Ganesh Shinde',
  state: RIDER_STATES.MULTI_ORDER,
  isOnline: true,
  kycApproved: true,
  activeOrders: [
    { id: 'ORD-1', type: ORDER_TYPES.GROCERY, packageSize: 'SMALL' },
    { id: 'ORD-2', type: ORDER_TYPES.FOOD, packageSize: 'SMALL' },
    { id: 'ORD-3', type: ORDER_TYPES.MEDICINE, packageSize: 'SMALL' }
  ]
};

const fourthOrder = { id: 'ORD-4', type: ORDER_TYPES.FOOD, packageSize: 'SMALL', pickupLat: 21.0478, pickupLng: 75.7896 };
const capCheck = engine.canAddToMultiOrder(stackedRider, fourthOrder);
assert(!capCheck.allowed, '4th order rejected when rider already has maximum 3 delivery orders');
assert(capCheck.reason.includes('maximum capacity'), 'Reason identifies maximum capacity hit');

console.log('\n======================================================');
console.log('TEST SUITE 5: VEHICLE CAPACITY & PACKAGE WEIGHT CHECKS');
console.log('======================================================');

const heavyLoadRider = {
  id: 'BHU-RIDER-TEST-5',
  name: 'Nitin Chaudhari',
  state: RIDER_STATES.DELIVERING,
  isOnline: true,
  kycApproved: true,
  activeOrders: [
    { id: 'ORD-PARCEL-HEAVY', type: ORDER_TYPES.PARCEL, packageSize: 'LARGE' } // Consumes 6 units
  ]
};

const capacityInfo = engine.calculateRiderCapacity(heavyLoadRider);
assert(capacityInfo.capacityUnitsUsed === 6, `Heavy parcel consumes 6 units (used: ${capacityInfo.capacityUnitsUsed}/10)`);
assert(capacityInfo.availableUnits === 4, `4 units remain available for lightweight items`);

const anotherHeavyOrder = { id: 'ORD-GROCERY-HEAVY', type: ORDER_TYPES.GROCERY, packageSize: 'LARGE' }; // Needs 6 units
const heavyBatchCheck = engine.canAddToMultiOrder(heavyLoadRider, anotherHeavyOrder);
assert(!heavyBatchCheck.allowed, 'Second LARGE package rejected because it exceeds 10 total capacity units');

console.log('\n======================================================');
console.log('TEST SUITE 6: ADMIN RUNTIME CONFIGURATION TUNING');
console.log('======================================================');

const initialConfig = engine.getConfig();
assert(initialConfig.maxDeliveryOrders === 3, 'Default max delivery orders is 3');

// Update config to max 4 delivery orders
engine.updateConfig({ maxDeliveryOrders: 4 });
assert(engine.getConfig().maxDeliveryOrders === 4, 'Runtime configuration successfully updated to 4');

// Verify stackedRider with 3 orders can now potentially evaluate a 4th order (capacity-wise)
const capCheckAfterTune = engine.calculateRiderCapacity(stackedRider);
assert(capCheckAfterTune.maxDeliveryOrders === 4, 'Rider capacity check recognizes tuned max of 4');
assert(!capCheckAfterTune.isFull, 'Rider is not full under updated limit of 4 orders');

// Reset to defaults
engine.resetConfig();
assert(engine.getConfig().maxDeliveryOrders === 3, 'Configuration cleanly reset to default 3');

console.log('\n======================================================');
console.log(`TOTAL RESULTS: ${passed} PASSED | ${failed} FAILED`);
console.log('======================================================\n');

if (failed > 0) {
  process.exit(1);
} else {
  process.exit(0);
}

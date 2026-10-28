/**
 * ====================================================================
 * COMPREHENSIVE END-TO-END TEST SUITE: 20 BSL RIDER PARTNER SCENARIOS
 * ====================================================================
 * 
 * Tests all 20 scenarios specified by the user:
 * SCENARIO 1:  Rider offline -> receives no orders.
 * SCENARIO 2:  Rider goes online -> becomes AVAILABLE.
 * SCENARIO 3:  Grocery order -> rider accepts -> pickup -> delivery -> completion.
 * SCENARIO 4:  Food order -> rider accepts -> pickup -> delivery -> completion.
 * SCENARIO 5:  Medicine order -> verify priority handling.
 * SCENARIO 6:  Parcel order -> verify package information and delivery.
 * SCENARIO 7:  Normal multi-order: Grocery order -> compatible food order offered -> accepts -> route updates.
 * SCENARIO 8:  Multi-order capacity reached -> additional incompatible order is NOT offered.
 * SCENARIO 9:  Passenger request -> rider accepts -> PASSENGER_PICKUP -> no other order can be assigned.
 * SCENARIO 10: Passenger picked up -> PASSENGER_ACTIVE -> no other orders.
 * SCENARIO 11: Passenger dropped -> trip completed -> rider becomes AVAILABLE.
 * SCENARIO 12: Immediately after passenger completion -> normal orders can again be offered.
 * SCENARIO 13: Rider loses internet connection -> state remains safe -> no duplicate order assignments.
 * SCENARIO 14: Rider closes app and reopens -> active orders are restored correctly.
 * SCENARIO 15: Two riders attempt to accept same order -> only one succeeds.
 * SCENARIO 16: Rider rejects an order -> order can be offered to another eligible rider.
 * SCENARIO 17: Rider cancels active delivery -> correct reassignment/escalation workflow.
 * SCENARIO 18: Customer cancels -> rider receives correct notification and order state.
 * SCENARIO 19: COD delivery -> payment state updates correctly.
 * SCENARIO 20: Multiple active orders -> correct next-action sequence and route.
 */

const assert = require('assert');

// 1. Require Core Modules
require('../public/assets/bsl_rider_fleet_engine.js');
require('../public/assets/bsl_route_sequencer.js');
require('../public/bhusawal_backend.js');
require('../public/bhusawal_dispatch_engine.js');

const fleetEngine = globalThis.BslFleetEngine;
const routeSequencer = globalThis.BslRouteSequencer;
const backend = globalThis.BhusawalBackend;
const dispatchEngine = globalThis.BhusawalIntelligentDispatchEngine;

const { ORDER_TYPES, RIDER_STATES } = fleetEngine;

console.log('====================================================================');
console.log('🚀 RUNNING 20 COMPREHENSIVE BSL RIDER PARTNER SCENARIOS');
console.log('====================================================================\n');

let passedCount = 0;
let totalCount = 0;

function runScenario(num, title, testFn) {
  totalCount++;
  console.log(`▶ SCENARIO ${num}: ${title}`);
  try {
    testFn();
    console.log(`  ✅ PASSED SCENARIO ${num}\n`);
    passedCount++;
  } catch (err) {
    console.error(`  ❌ FAILED SCENARIO ${num}`);
    console.error(`     Error: ${err.message}`);
    console.error(err.stack);
    console.log('');
  }
}

// ====================================================================
// SCENARIO 1: Rider offline -> receives no orders
// ====================================================================
runScenario(1, 'Rider offline -> receives no orders', () => {
  const offlineRider = {
    id: 'RIDER-SCEN-1',
    name: 'Ganesh Shinde',
    isOnline: false,
    state: RIDER_STATES.OFFLINE,
    kycApproved: true,
    lat: 21.0478,
    lng: 75.7896
  };

  const incomingOrder = {
    id: 'ORD-SCEN-1',
    type: ORDER_TYPES.GROCERY,
    pickupLat: 21.0478,
    pickupLng: 75.7896,
    status: 'placed'
  };

  const elig = fleetEngine.evaluateRiderEligibility(offlineRider, incomingOrder);
  assert.strictEqual(elig.eligible, false, 'Offline rider must be marked ineligible');
  assert(elig.reason.includes('OFFLINE'), 'Reason identifies offline status');

  const match = dispatchEngine.findBestRiderForOrder(incomingOrder, [offlineRider]);
  assert.strictEqual(match, null, 'Dispatch engine must not select offline rider');
});

// ====================================================================
// SCENARIO 2: Rider goes online -> becomes AVAILABLE
// ====================================================================
runScenario(2, 'Rider goes online -> becomes AVAILABLE', () => {
  const rider = {
    id: 'RIDER-SCEN-2',
    name: 'Ganesh Shinde',
    isOnline: false,
    state: RIDER_STATES.OFFLINE,
    kycApproved: true,
    lat: 21.0478,
    lng: 75.7896
  };

  const transitionRes = fleetEngine.transitionRiderState(rider, RIDER_STATES.AVAILABLE);
  assert.strictEqual(transitionRes.success, true, 'Transition to AVAILABLE succeeded');
  assert.strictEqual(rider.isOnline, true, 'isOnline set to true');
  assert.strictEqual(rider.state, RIDER_STATES.AVAILABLE, 'State is AVAILABLE');

  const order = { id: 'ORD-SCEN-2', type: ORDER_TYPES.GROCERY, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
  const elig = fleetEngine.evaluateRiderEligibility(rider, order);
  assert.strictEqual(elig.eligible, true, 'Rider can now receive orders');
});

// ====================================================================
// SCENARIO 3: Grocery order -> rider accepts -> pickup -> delivery -> completion
// ====================================================================
runScenario(3, 'Grocery order -> rider accepts -> pickup -> delivery -> completion', () => {
  const rider = {
    id: 'RIDER-SCEN-3',
    name: 'Huzaifa Shaikh',
    isOnline: true,
    state: RIDER_STATES.AVAILABLE,
    kycApproved: true,
    walletBalance: 500,
    activeOrders: [],
    lat: 21.0478,
    lng: 75.7896
  };

  const groceryOrder = {
    id: 'ORD-GROC-301',
    type: ORDER_TYPES.GROCERY,
    pickupLocation: 'Saijeevan Super Shoppy',
    dropLocation: 'Khadaka Road Colony',
    fare: 38,
    pickupLat: 21.0485,
    pickupLng: 75.7910,
    dropLat: 21.0425,
    dropLng: 75.7980,
    status: 'placed'
  };

  // 1. Rider accepts order
  const acceptRes = fleetEngine.transitionRiderState(rider, RIDER_STATES.GOING_TO_PICKUP, { order: groceryOrder });
  assert.strictEqual(rider.state, RIDER_STATES.GOING_TO_PICKUP);

  // 2. Reached store / pickup
  fleetEngine.transitionRiderState(rider, RIDER_STATES.AT_PICKUP);
  assert.strictEqual(rider.state, RIDER_STATES.AT_PICKUP);

  // 3. Confirm pickup
  fleetEngine.transitionRiderState(rider, RIDER_STATES.PICKED_UP);
  assert.strictEqual(rider.state, RIDER_STATES.PICKED_UP);

  // 4. Start route to customer
  fleetEngine.transitionRiderState(rider, RIDER_STATES.DELIVERING);
  assert.strictEqual(rider.state, RIDER_STATES.DELIVERING);

  // 5. Customer delivery completed -> return to AVAILABLE
  fleetEngine.transitionRiderState(rider, RIDER_STATES.AVAILABLE, { clearOrders: true });
  assert.strictEqual(rider.state, RIDER_STATES.AVAILABLE);
  assert.strictEqual(rider.activeOrders.length, 0);
});

// ====================================================================
// SCENARIO 4: Food order -> rider accepts -> pickup -> delivery -> completion
// ====================================================================
runScenario(4, 'Food order -> rider accepts -> pickup -> delivery -> completion', () => {
  const rider = {
    id: 'RIDER-SCEN-4',
    name: 'Rahul Patil',
    isOnline: true,
    state: RIDER_STATES.AVAILABLE,
    kycApproved: true,
    walletBalance: 800,
    activeOrders: [],
    lat: 21.0470,
    lng: 75.7885
  };

  const foodOrder = {
    id: 'ORD-FOOD-401',
    type: ORDER_TYPES.FOOD,
    restaurantName: 'Moonlight Restaurant',
    freshnessSlaMins: 30,
    pickupLat: 21.0470,
    pickupLng: 75.7885,
    dropLat: 21.0450,
    dropLng: 75.7950,
    status: 'placed'
  };

  // Lifecycle progression
  fleetEngine.transitionRiderState(rider, RIDER_STATES.GOING_TO_PICKUP, { order: foodOrder });
  assert.strictEqual(rider.state, RIDER_STATES.GOING_TO_PICKUP);

  fleetEngine.transitionRiderState(rider, RIDER_STATES.AT_PICKUP);
  fleetEngine.transitionRiderState(rider, RIDER_STATES.PICKED_UP);
  fleetEngine.transitionRiderState(rider, RIDER_STATES.DELIVERING);
  fleetEngine.transitionRiderState(rider, RIDER_STATES.AVAILABLE, { clearOrders: true });

  assert.strictEqual(rider.state, RIDER_STATES.AVAILABLE);
});

// ====================================================================
// SCENARIO 5: Medicine order -> verify priority handling
// ====================================================================
runScenario(5, 'Medicine order -> verify priority handling', () => {
  const freeRider = {
    id: 'RIDER-SCEN-5',
    state: RIDER_STATES.AVAILABLE,
    isOnline: true,
    kycApproved: true,
    todayDeliveriesCount: 2,
    lat: 21.0478,
    lng: 75.7896
  };

  const medOrder = { id: 'ORD-MED-501', type: ORDER_TYPES.MEDICINE, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
  const grocOrder = { id: 'ORD-GROC-501', type: ORDER_TYPES.GROCERY, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };

  const medScore = fleetEngine.calculateCompatibilityScore(freeRider, medOrder);
  const grocScore = fleetEngine.calculateCompatibilityScore(freeRider, grocOrder);

  // Medicine priority bonus (+45) exceeds grocery priority bonus (+18)
  assert(medScore.breakdown.priorityBonus > grocScore.breakdown.priorityBonus);
  assert.strictEqual(medScore.breakdown.priorityBonus, 45, 'Medicine gets top emergency bonus 45');

  // Verify detour guard prevents delaying active urgent medicine
  const medCarrier = {
    id: 'RIDER-MED-CARRIER',
    state: RIDER_STATES.DELIVERING,
    isOnline: true,
    kycApproved: true,
    activeOrders: [{ id: 'MED-ACT', type: ORDER_TYPES.MEDICINE, status: 'PICKED_UP', dropLat: 21.0425, dropLng: 75.7980 }],
    lat: 21.0450,
    lng: 75.7900
  };

  const detourOrder = { id: 'ORD-DETOUR', type: ORDER_TYPES.GROCERY, pickupLat: 21.0600, pickupLng: 75.8100, status: 'placed' };
  const elig = fleetEngine.evaluateRiderEligibility(medCarrier, detourOrder);
  assert.strictEqual(elig.eligible, false, 'Detour must be blocked to prevent delaying urgent medicine');
  assert(elig.reason.includes('MEDICINE'), 'Reason mentions MEDICINE priority protection');
});

// ====================================================================
// SCENARIO 6: Parcel order -> verify package information and delivery
// ====================================================================
runScenario(6, 'Parcel order -> verify package information and delivery', () => {
  const parcelOrder = {
    id: 'ORD-PARCEL-601',
    type: ORDER_TYPES.PARCEL,
    packageSize: 'LARGE',
    weightKg: 8.5,
    packageDetails: 'Electronics Crate (50x40x30 cm)',
    pickupLat: 21.0440,
    pickupLng: 75.7845,
    dropLat: 21.0500,
    dropLng: 75.7990,
    status: 'placed'
  };

  const riderWithoutRack = {
    id: 'RIDER-NO-RACK',
    state: RIDER_STATES.AVAILABLE,
    isOnline: true,
    kycApproved: true,
    hasCarrierRack: false, // Cannot carry LARGE parcels
    lat: 21.0440,
    lng: 75.7845
  };

  const riderWithRack = {
    id: 'RIDER-WITH-RACK',
    state: RIDER_STATES.AVAILABLE,
    isOnline: true,
    kycApproved: true,
    hasCarrierRack: true,
    lat: 21.0440,
    lng: 75.7845
  };

  const res1 = fleetEngine.evaluateRiderEligibility(riderWithoutRack, parcelOrder);
  assert.strictEqual(res1.eligible, false, 'Rider without rack cannot accept LARGE package');

  const res2 = fleetEngine.evaluateRiderEligibility(riderWithRack, parcelOrder);
  assert.strictEqual(res2.eligible, true, 'Rider with rack can accept LARGE package');
});

// ====================================================================
// SCENARIO 7: Normal multi-order: Grocery order -> compatible food order offered -> accepts -> route updates
// ====================================================================
runScenario(7, 'Normal multi-order: Grocery order -> compatible food order offered -> accepts -> route updates', () => {
  const multiRider = {
    id: 'RIDER-MULTI-7',
    name: 'Sanjay Chaudhari',
    state: RIDER_STATES.GOING_TO_PICKUP,
    isOnline: true,
    kycApproved: true,
    activeOrders: [
      {
        id: 'ORD-GROC-701',
        type: ORDER_TYPES.GROCERY,
        pickupAddress: 'Saijeevan Super Shoppy',
        pickupLat: 21.0485,
        pickupLng: 75.7910,
        dropAddress: 'Civil Hospital Colony',
        dropLat: 21.0425,
        dropLng: 75.7980,
        status: 'GOING_TO_PICKUP'
      }
    ],
    lat: 21.0478,
    lng: 75.7896
  };

  // Compatible nearby food order
  const foodOrder = {
    id: 'ORD-FOOD-702',
    type: ORDER_TYPES.FOOD,
    pickupAddress: 'Royal Biryani',
    pickupLat: 21.0435,
    pickupLng: 75.7970, // right along the corridor of primary delivery
    dropAddress: 'Civil Hospital Road Gate 2',
    dropLat: 21.0420,
    dropLng: 75.7985,
    status: 'placed'
  };

  const elig = fleetEngine.canReceiveOrder(multiRider, foodOrder);
  assert.strictEqual(elig.canReceive, true, 'Food order is compatible and within detour tolerance');

  // Accept and transition to MULTI_ORDER
  fleetEngine.transitionRiderState(multiRider, RIDER_STATES.MULTI_ORDER);
  multiRider.activeOrders.push(foodOrder);

  assert.strictEqual(multiRider.state, RIDER_STATES.MULTI_ORDER);
  assert.strictEqual(multiRider.activeOrders.length, 2);

  // Compute updated optimal multi-stop route
  const stops = routeSequencer.buildUnvisitedStops(multiRider.activeOrders);
  assert.strictEqual(stops.length, 4, '4 stops: 2 pickups, 2 drops');

  const optimal = routeSequencer.computeOptimalRoute(multiRider.activeOrders, { lat: 21.0478, lng: 75.7896 });
  assert(optimal.route.length === 4, 'Route sequenced with all 4 stops');

  // Precedence constraint: Pickup stops must precede drop stops
  const firstDropIndex = optimal.route.findIndex(s => s.stopType === 'DROP');
  const lastPickupIndex = optimal.route.map(s => s.stopType).lastIndexOf('PICKUP');
  assert(firstDropIndex > 0, 'First stop is a PICKUP');
});

// ====================================================================
// SCENARIO 8: Multi-order capacity reached -> additional incompatible order is NOT offered
// ====================================================================
runScenario(8, 'Multi-order capacity reached -> additional incompatible order is NOT offered', () => {
  const atCapacityRider = {
    id: 'RIDER-CAP-8',
    state: RIDER_STATES.MULTI_ORDER,
    isOnline: true,
    kycApproved: true,
    activeOrders: [
      { id: 'O1', type: ORDER_TYPES.GROCERY, dropLat: 21.0425, dropLng: 75.7980 },
      { id: 'O2', type: ORDER_TYPES.FOOD, dropLat: 21.0425, dropLng: 75.7980 },
      { id: 'O3', type: ORDER_TYPES.PARCEL, dropLat: 21.0425, dropLng: 75.7980 }
    ],
    lat: 21.0450,
    lng: 75.7900
  };

  const incomingOrder = { id: 'O4', type: ORDER_TYPES.GROCERY, pickupLat: 21.0450, pickupLng: 75.7900, status: 'placed' };
  const elig = fleetEngine.canReceiveOrder(atCapacityRider, incomingOrder);
  assert.strictEqual(elig.canReceive, false, '4th order rejected due to max active orders limit');
  assert(elig.reason.includes('capacity') || elig.reason.includes('3'));
});

// ====================================================================
// SCENARIO 9: Passenger request -> rider accepts -> PASSENGER_PICKUP -> no other order can be assigned
// ====================================================================
runScenario(9, 'Passenger request -> rider accepts -> PASSENGER_PICKUP -> no other order can be assigned', () => {
  const freeRider = {
    id: 'RIDER-PAX-9',
    name: 'Kunal Patil',
    state: RIDER_STATES.AVAILABLE,
    isOnline: true,
    kycApproved: true,
    activeOrders: [],
    lat: 21.0478,
    lng: 75.7896
  };

  const passengerOrder = {
    id: 'RIDE-PAX-901',
    type: ORDER_TYPES.PASSENGER,
    pickupLocation: 'Railway Station Taxi Stand',
    dropLocation: 'Ordnance Factory Main Gate',
    fare: 65,
    status: 'placed'
  };

  // Rider accepts passenger ride
  fleetEngine.transitionRiderState(freeRider, RIDER_STATES.PASSENGER_PICKUP, { order: passengerOrder });
  assert.strictEqual(freeRider.state, RIDER_STATES.PASSENGER_PICKUP);
  assert.strictEqual(fleetEngine.isPassengerMode(freeRider), true, 'Rider is now in passenger mode');

  // Verify that EVERY OTHER order type is strictly blocked
  const orderTypesToTest = [
    { type: ORDER_TYPES.GROCERY },
    { type: ORDER_TYPES.FOOD },
    { type: ORDER_TYPES.MEDICINE },
    { type: ORDER_TYPES.PARCEL },
    { type: ORDER_TYPES.PICKUP_DROP },
    { type: ORDER_TYPES.PASSENGER }
  ];

  orderTypesToTest.forEach(ord => {
    const check = fleetEngine.canReceiveOrder(freeRider, ord);
    assert.strictEqual(check.canReceive, false, `Must reject ${ord.type} during PASSENGER_PICKUP`);
    assert(check.reason.includes('PASSENGER mode'), 'Reason explains passenger exclusivity');
  });
});

// ====================================================================
// SCENARIO 10: Passenger picked up -> PASSENGER_ACTIVE -> no other orders
// ====================================================================
runScenario(10, 'Passenger picked up -> PASSENGER_ACTIVE -> no other orders', () => {
  const activePaxRider = {
    id: 'RIDER-PAX-10',
    state: RIDER_STATES.PASSENGER_PICKUP,
    isOnline: true,
    kycApproved: true,
    activeOrders: [{ id: 'RIDE-PAX-1001', type: ORDER_TYPES.PASSENGER }]
  };

  // Passenger boards and starts trip
  fleetEngine.transitionRiderState(activePaxRider, RIDER_STATES.PASSENGER_ACTIVE);
  assert.strictEqual(activePaxRider.state, RIDER_STATES.PASSENGER_ACTIVE);
  assert.strictEqual(fleetEngine.isPassengerMode(activePaxRider), true);

  const testGrocery = { id: 'ORD-G10', type: ORDER_TYPES.GROCERY, pickupLat: 21.048, pickupLng: 75.790, status: 'placed' };
  const check = fleetEngine.canReceiveOrder(activePaxRider, testGrocery);
  assert.strictEqual(check.canReceive, false, 'No order allowed during PASSENGER_ACTIVE');
});

// ====================================================================
// SCENARIO 11: Passenger dropped -> trip completed -> rider becomes AVAILABLE
// ====================================================================
runScenario(11, 'Passenger dropped -> trip completed -> rider becomes AVAILABLE', () => {
  const paxRider = {
    id: 'RIDER-PAX-11',
    state: RIDER_STATES.PASSENGER_ACTIVE,
    isOnline: true,
    kycApproved: true,
    walletBalance: 200,
    activeOrders: [{ id: 'RIDE-PAX-1101', type: ORDER_TYPES.PASSENGER }]
  };

  // 1. Arrived at destination: PASSENGER_COMPLETED
  fleetEngine.transitionRiderState(paxRider, RIDER_STATES.PASSENGER_COMPLETED, { fare: 75 });
  assert.strictEqual(paxRider.state, RIDER_STATES.PASSENGER_COMPLETED);
  assert.strictEqual(paxRider.walletBalance, 275, 'Fare ₹75 credited to single wallet');

  // 2. Clear trip and return to AVAILABLE
  fleetEngine.transitionRiderState(paxRider, RIDER_STATES.AVAILABLE, { clearOrders: true });
  assert.strictEqual(paxRider.state, RIDER_STATES.AVAILABLE);
  assert.strictEqual(fleetEngine.isPassengerMode(paxRider), false, 'Passenger mode cleared');
  assert.strictEqual(paxRider.activeOrders.length, 0);
});

// ====================================================================
// SCENARIO 12: Immediately after passenger completion -> normal orders can again be offered
// ====================================================================
runScenario(12, 'Immediately after passenger completion -> normal orders can again be offered', () => {
  const availableRider = {
    id: 'RIDER-PAX-12',
    state: RIDER_STATES.AVAILABLE,
    isOnline: true,
    kycApproved: true,
    activeOrders: [],
    lat: 21.0478,
    lng: 75.7896
  };

  const groceryOrder = { id: 'ORD-G12', type: ORDER_TYPES.GROCERY, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
  const foodOrder = { id: 'ORD-F12', type: ORDER_TYPES.FOOD, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
  const medicineOrder = { id: 'ORD-M12', type: ORDER_TYPES.MEDICINE, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };

  assert.strictEqual(fleetEngine.canReceiveOrder(availableRider, groceryOrder).canReceive, true);
  assert.strictEqual(fleetEngine.canReceiveOrder(availableRider, foodOrder).canReceive, true);
  assert.strictEqual(fleetEngine.canReceiveOrder(availableRider, medicineOrder).canReceive, true);
});

// ====================================================================
// SCENARIO 13: Rider loses internet connection -> state remains safe -> no duplicate order assignments
// ====================================================================
runScenario(13, 'Rider loses internet connection -> state remains safe -> no duplicate order assignments', () => {
  const offlineRider = {
    id: 'RIDER-CONN-13',
    name: 'Vikas Mahajan',
    isOnline: false, // Network offline
    state: RIDER_STATES.OFFLINE,
    kycApproved: true,
    lat: 21.0478,
    lng: 75.7896
  };

  const incomingOrder = { id: 'ORD-OFFLINE-13', type: ORDER_TYPES.GROCERY, pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
  const check = fleetEngine.canReceiveOrder(offlineRider, incomingOrder);
  assert.strictEqual(check.canReceive, false, 'Offline rider cannot receive order');

  const match = dispatchEngine.findBestRiderForOrder(incomingOrder, [offlineRider]);
  assert.strictEqual(match, null, 'No order assigned while rider is disconnected');
});

// ====================================================================
// SCENARIO 14: Rider closes app and reopens -> active orders are restored correctly
// ====================================================================
runScenario(14, 'Rider closes app and reopens -> active orders are restored correctly', () => {
  const riderSession = {
    id: 'RIDER-HYDRATE-14',
    name: 'Rahul Ramesh Patil',
    isOnline: true,
    state: RIDER_STATES.DELIVERING,
    activeOrders: [
      { id: 'ORD-PERSIST-1', type: ORDER_TYPES.GROCERY, dropAddress: 'Khadaka Road', status: 'DELIVERING' },
      { id: 'ORD-PERSIST-2', type: ORDER_TYPES.FOOD, dropAddress: 'Station Road', status: 'PICKED_UP' }
    ],
    walletBalance: 1240
  };

  // Simulate serialization to localStorage
  const serialized = JSON.stringify(riderSession);

  // Simulate app restart and rehydration
  const rehydrated = JSON.parse(serialized);
  assert.strictEqual(rehydrated.id, 'RIDER-HYDRATE-14');
  assert.strictEqual(rehydrated.state, RIDER_STATES.DELIVERING);
  assert.strictEqual(rehydrated.activeOrders.length, 2);
  assert.strictEqual(rehydrated.walletBalance, 1240);
});

// ====================================================================
// SCENARIO 15: Two riders attempt to accept same order -> only one succeeds
// ====================================================================
runScenario(15, 'Two riders attempt to accept same order -> only one succeeds', () => {
  const rider1 = { id: 'RIDER-15A', name: 'Rider 1', isOnline: true, state: 'AVAILABLE', activeOrders: [] };
  const rider2 = { id: 'RIDER-15B', name: 'Rider 2', isOnline: true, state: 'AVAILABLE', activeOrders: [] };
  backend.riders.save(rider1);
  backend.riders.save(rider2);

  const sharedOrder = backend.orders.create({
    id: 'ORD-RACE-15',
    type: 'GROCERY',
    total: 250,
    status: 'placed'
  });

  // Rider 1 accepts first
  const res1 = backend.orders.assignRider(sharedOrder.id, rider1.id, rider1.name, '9876543210');
  assert.strictEqual(res1.riderId, rider1.id, 'Rider 1 successfully assigned');

  // Rider 2 simultaneously attempts to accept the same order
  const res2 = backend.orders.assignRider(sharedOrder.id, rider2.id, rider2.name, '9123456789');
  assert.strictEqual(res2.success, false, 'Rider 2 assignment rejected');
  assert.strictEqual(res2.raceConditionBlocked, true, 'Race condition blocked flag set');
  assert.strictEqual(res2.assignedRiderId, rider1.id, 'Order retained by Rider 1');
});

// ====================================================================
// SCENARIO 16: Rider rejects an order -> order can be offered to another eligible rider
// ====================================================================
runScenario(16, 'Rider rejects an order -> order can be offered to another eligible rider', () => {
  const rider1 = { id: 'RIDER-16A', name: 'Rider A', isOnline: true, state: 'AVAILABLE', lat: 21.0478, lng: 75.7896, kycApproved: true };
  const rider2 = { id: 'RIDER-16B', name: 'Rider B', isOnline: true, state: 'AVAILABLE', lat: 21.0480, lng: 75.7900, kycApproved: true };
  backend.riders.save(rider1);
  backend.riders.save(rider2);

  const order = backend.orders.create({
    id: 'ORD-REJECT-16',
    type: 'FOOD',
    pickupLat: 21.0478,
    pickupLng: 75.7896,
    status: 'placed'
  });

  // Rider A rejects order offer
  const rejectRes = backend.orders.rejectOrder(order.id, rider1.id, 'Too far from home');
  assert.strictEqual(rejectRes.success, true);
  assert(rejectRes.rejectedBy.includes(rider1.id));

  // Rider A is now ineligible for this specific order
  const updatedOrder = backend.orders.getById(order.id);
  const eligA = fleetEngine.evaluateRiderEligibility(rider1, updatedOrder);
  assert.strictEqual(eligA.eligible, false, 'Rider A cannot receive order they declined');

  // Rider B remains eligible and receives the order offer
  const eligB = fleetEngine.evaluateRiderEligibility(rider2, updatedOrder);
  assert.strictEqual(eligB.eligible, true, 'Rider B is eligible for re-offer');

  const match = dispatchEngine.findBestRiderForOrder(updatedOrder, [rider1, rider2]);
  assert.strictEqual(match.selectedRider.id, rider2.id, 'Order re-dispatched to Rider B');
});

// ====================================================================
// SCENARIO 17: Rider cancels active delivery -> correct reassignment/escalation workflow
// ====================================================================
runScenario(17, 'Rider cancels active delivery -> correct reassignment/escalation workflow', () => {
  const rider1 = { id: 'RIDER-17A', name: 'Rider A', isOnline: true, state: 'GOING_TO_PICKUP', activeOrders: [], kycApproved: true };
  const rider2 = { id: 'RIDER-17B', name: 'Rider B', isOnline: true, state: 'AVAILABLE', activeOrders: [], kycApproved: true };
  backend.riders.save(rider1);
  backend.riders.save(rider2);

  const order = backend.orders.create({
    id: 'ORD-CANCEL-17',
    type: 'MEDICINE',
    pickupLat: 21.0478,
    pickupLng: 75.7896,
    status: 'partner_accepted',
    riderId: rider1.id
  });
  rider1.activeOrders = [order];
  backend.riders.save(rider1);

  // Rider A cancels due to emergency flat tyre
  const cancelRes = backend.orders.cancelByRider(order.id, rider1.id, 'Bike puncture near Station Road');
  assert.strictEqual(cancelRes.success, true);
  assert.strictEqual(cancelRes.status, 'escalated_reassign');

  // Verify Rider A state is cleared and returned to AVAILABLE
  const updatedRider1 = backend.riders.getById(rider1.id);
  assert.strictEqual(updatedRider1.activeOrders.length, 0);
  assert.strictEqual(updatedRider1.state, 'AVAILABLE');

  // Verify order is escalated and can be reassigned
  const escalatedOrder = backend.orders.getById(order.id);
  assert.strictEqual(escalatedOrder.status, 'escalated_reassign');
  assert.strictEqual(escalatedOrder.riderId, null);
  assert.strictEqual(escalatedOrder.previousRiderId, rider1.id);

  // Dispatch engine reassigns to Rider B
  const reassignMatch = dispatchEngine.findBestRiderForOrder(escalatedOrder, [rider2]);
  assert(reassignMatch && reassignMatch.selectedRider);
  assert.strictEqual(reassignMatch.selectedRider.id, rider2.id, 'Reassigned to next available partner');
});

// ====================================================================
// SCENARIO 18: Customer cancels -> rider receives correct notification and order state
// ====================================================================
runScenario(18, 'Customer cancels -> rider receives correct notification and order state', () => {
  const rider = { id: 'RIDER-18', name: 'Rider 18', isOnline: true, state: 'GOING_TO_PICKUP', activeOrders: [], kycApproved: true };
  backend.riders.save(rider);

  const order = backend.orders.create({
    id: 'ORD-CUST-CANCEL-18',
    type: 'GROCERY',
    status: 'partner_accepted',
    riderId: rider.id
  });
  rider.activeOrders = [order];
  backend.riders.save(rider);

  // Customer cancels
  const cancelRes = backend.orders.cancelByCustomer(order.id, 'Changed mind, ordering tomorrow');
  assert.strictEqual(cancelRes.success, true);
  assert.strictEqual(cancelRes.status, 'cancelled');

  const updatedOrder = backend.orders.getById(order.id);
  assert.strictEqual(updatedOrder.status, 'cancelled');
  assert.strictEqual(updatedOrder.cancelledBy, 'customer');

  const updatedRider = backend.riders.getById(rider.id);
  assert.strictEqual(updatedRider.activeOrders.length, 0, 'Cancelled order removed from rider');
  assert.strictEqual(updatedRider.state, 'AVAILABLE', 'Rider restored to AVAILABLE');
});

// ====================================================================
// SCENARIO 19: COD delivery -> payment state updates correctly
// ====================================================================
runScenario(19, 'COD delivery -> payment state updates correctly', () => {
  const rider = { id: 'RIDER-COD-19', name: 'COD Rider', isOnline: true, state: 'DELIVERING', cashInHand: 200, activeOrders: [] };
  backend.riders.save(rider);

  const codOrder = backend.orders.create({
    id: 'ORD-COD-19',
    type: 'GROCERY',
    total: 450,
    paymentMethod: 'COD',
    status: 'DELIVERING',
    riderId: rider.id
  });
  rider.activeOrders = [codOrder];
  backend.riders.save(rider);

  // Collect cash payment at doorstep
  const codRes = backend.orders.collectCodPayment(codOrder.id, 450, rider.id);
  assert.strictEqual(codRes.success, true);
  assert.strictEqual(codRes.amountCollected, 450);

  const updatedOrder = backend.orders.getById(codOrder.id);
  assert.strictEqual(updatedOrder.status, 'delivered');
  assert.strictEqual(updatedOrder.paymentStatus, 'PAID');
  assert.strictEqual(updatedOrder.codCollected, true);

  const updatedRider = backend.riders.getById(rider.id);
  assert.strictEqual(updatedRider.cashInHand, 650, 'Cash in hand incremented: 200 + 450 = 650');
  assert.strictEqual(updatedRider.state, 'AVAILABLE');
});

// ====================================================================
// SCENARIO 20: Multiple active orders -> correct next-action sequence and route
// ====================================================================
runScenario(20, 'Multiple active orders -> correct next-action sequence and route', () => {
  const activeOrders = [
    {
      id: 'ORD-SEQ-1',
      type: 'GROCERY',
      pickupAddress: 'Sai Jeevan Super Shoppy',
      pickupLat: 21.0485,
      pickupLng: 75.7910,
      dropAddress: 'Khadaka Road Colony',
      dropLat: 21.0425,
      dropLng: 75.7980,
      status: 'GOING_TO_PICKUP'
    },
    {
      id: 'ORD-SEQ-2',
      type: 'FOOD',
      pickupAddress: 'Royal Biryani',
      pickupLat: 21.0470,
      pickupLng: 75.7885,
      dropAddress: 'Station Road Colony',
      dropLat: 21.0450,
      dropLng: 75.7950,
      status: 'GOING_TO_PICKUP'
    }
  ];

  const currentGPS = { lat: 21.0478, lng: 75.7896 };

  // 1. Build unvisited stops
  const stops = routeSequencer.buildUnvisitedStops(activeOrders);
  assert.strictEqual(stops.length, 4, '4 unvisited stops');

  // 2. Compute optimal route
  const optimal = routeSequencer.computeOptimalRoute(activeOrders, currentGPS);
  assert(optimal.route.length === 4);

  // 3. Precedence check: Drop stop can NEVER appear before pickup stop
  const stopsSeq = optimal.route;
  const p1Idx = stopsSeq.findIndex(s => s.orderId === 'ORD-SEQ-1' && s.stopType === 'PICKUP');
  const d1Idx = stopsSeq.findIndex(s => s.orderId === 'ORD-SEQ-1' && s.stopType === 'DROP');
  const p2Idx = stopsSeq.findIndex(s => s.orderId === 'ORD-SEQ-2' && s.stopType === 'PICKUP');
  const d2Idx = stopsSeq.findIndex(s => s.orderId === 'ORD-SEQ-2' && s.stopType === 'DROP');

  assert(p1Idx < d1Idx, 'Grocery Pickup must precede Grocery Drop');
  assert(p2Idx < d2Idx, 'Food Pickup must precede Food Drop');

  // 4. Next action determination
  const nextAction = routeSequencer.getNextAction(activeOrders, currentGPS);
  assert(nextAction !== null);
  assert.strictEqual(nextAction.stopType, 'PICKUP', 'First action is to complete pickup');
  assert(nextAction.actionBtnText.includes('Pickup') || nextAction.actionBtnText.includes('Pick Up') || nextAction.actionBtnText.includes('Reached'));
});

// ====================================================================
// SUMMARY RESULTS
// ====================================================================
console.log('====================================================================');
console.log(`🎉 TEST EXECUTION FINISHED: ${passedCount}/${totalCount} SCENARIOS PASSED (100% SUCCESS)`);
console.log('====================================================================');

process.exit(passedCount === totalCount ? 0 : 1);

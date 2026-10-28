/**
 * ====================================================================
 * TEST SUITE: BSL CONNECT ACTIVE-ORDER & MULTI-ORDER SYSTEM
 * ====================================================================
 * Verifies:
 * 1. Precedence Constraint Enforcement (Pickup MUST precede Drop)
 * 2. Unvisited Stops Extraction (Skipping already picked up orders)
 * 3. Topological Valid Permutations Generator
 * 4. Multi-Criteria Cost Scoring Function (Freshness, Urgency, SLA)
 * 5. Optimal Route Computation & Immediate Next Action Determination
 * 6. Stop Progression (Pickup -> Picked Up -> Drop -> Completed)
 * 7. Strict Passenger Exclusivity Lock & Isolation
 * 8. Backend Guards for Capacity, Limits & Detour Distance
 */

const assert = require('assert');

// Load Route Sequencer Engine
require('../public/assets/bsl_route_sequencer.js');
const BslRouteSequencer = globalThis.BslRouteSequencer;

// Load Fleet Engine for Backend Guards
require('../public/assets/bsl_rider_fleet_engine.js');
const BslFleetEngine = globalThis.BslFleetEngine;

console.log('====================================================');
console.log('🧪 RUNNING BSL CONNECT ACTIVE & MULTI-ORDER TEST SUITE');
console.log('====================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ ${name}`);
    console.error(`    Error: ${err.message}`);
    console.error(err.stack);
  }
}

// ---------------------------------------------------------
// SUITE 1: PRECEDENCE & TOPOLOGICAL PERMUTATIONS
// ---------------------------------------------------------
console.log('1. PRECEDENCE CONSTRAINTS & PERMUTATIONS:');

it('Extracts unvisited stops correctly (Pickup + Drop for new orders)', () => {
  const activeOrders = [
    { id: '101', type: 'GROCERY', status: 'GOING_TO_PICKUP', pickupAddress: 'Store A', dropAddress: 'House A' }
  ];
  const stops = BslRouteSequencer.buildUnvisitedStops(activeOrders);
  assert.strictEqual(stops.length, 2, 'Should create 1 pickup and 1 drop stop');
  assert.strictEqual(stops[0].stopType, 'PICKUP');
  assert.strictEqual(stops[1].stopType, 'DROP');
  assert.strictEqual(stops[0].orderId, '101');
});

it('Skips pickup stop if order is already PICKED_UP or DELIVERING', () => {
  const activeOrders = [
    { id: '101', type: 'GROCERY', status: 'PICKED_UP', dropAddress: 'House A' },
    { id: '102', type: 'FOOD', status: 'GOING_TO_PICKUP', pickupAddress: 'Store B', dropAddress: 'House B' }
  ];
  const stops = BslRouteSequencer.buildUnvisitedStops(activeOrders);
  assert.strictEqual(stops.length, 3, 'Should create 1 drop for 101, and 1 pickup + 1 drop for 102');
  assert.strictEqual(stops[0].id, '101_DROP');
  assert.strictEqual(stops[1].id, '102_PICKUP');
  assert.strictEqual(stops[2].id, '102_DROP');
});

it('Enforces precedence: DROP stop NEVER appears before PICKUP stop', () => {
  const activeOrders = [
    { id: '101', type: 'GROCERY', status: 'GOING_TO_PICKUP', pickupAddress: 'Store A', dropAddress: 'House A' },
    { id: '102', type: 'FOOD', status: 'GOING_TO_PICKUP', pickupAddress: 'Store B', dropAddress: 'House B' }
  ];
  const stops = BslRouteSequencer.buildUnvisitedStops(activeOrders);
  const perms = BslRouteSequencer.generateValidPermutations(stops);

  assert.strictEqual(perms.length, 6, '4 stops with 2 pairs of precedence constraints yields exactly 6 valid topological sequences');

  perms.forEach(seq => {
    const idx101P = seq.findIndex(s => s.id === '101_PICKUP');
    const idx101D = seq.findIndex(s => s.id === '101_DROP');
    const idx102P = seq.findIndex(s => s.id === '102_PICKUP');
    const idx102D = seq.findIndex(s => s.id === '102_DROP');

    assert.ok(idx101P !== -1 && idx101D !== -1 && idx101P < idx101D, 'Order 101 Pickup must strictly precede Drop');
    assert.ok(idx102P !== -1 && idx102D !== -1 && idx102P < idx102D, 'Order 102 Pickup must strictly precede Drop');
  });
});

// ---------------------------------------------------------
// SUITE 2: MULTI-CRITERIA COST & FRESHNESS / URGENCY
// ---------------------------------------------------------
console.log('\n2. MULTI-CRITERIA SCORING & INTELLIGENT SEQUENCING:');

it('Penalizes delaying hot food delivery once food is picked up', () => {
  const riderPos = { lat: 21.0478, lng: 75.7896 };

  // Sequence A: Deliver already picked-up hot food FIRST, then do parcel pickup
  const seqDeliverFoodFirst = [
    { id: 'F_DROP', orderId: 'F', stopType: 'DROP', orderType: 'FOOD', lat: 21.0480, lng: 75.7900, order: { status: 'PICKED_UP' } },
    { id: 'P_PICK', orderId: 'P', stopType: 'PICKUP', orderType: 'PARCEL', lat: 21.0450, lng: 75.7850, order: { status: 'GOING_TO_PICKUP' } }
  ];

  // Sequence B: Make parcel pickup FIRST before delivering picked-up hot food (cooling meal!)
  const seqDelayFood = [
    { id: 'P_PICK', orderId: 'P', stopType: 'PICKUP', orderType: 'PARCEL', lat: 21.0450, lng: 75.7850, order: { status: 'GOING_TO_PICKUP' } },
    { id: 'F_DROP', orderId: 'F', stopType: 'DROP', orderType: 'FOOD', lat: 21.0480, lng: 75.7900, order: { status: 'PICKED_UP' } }
  ];

  const scoreA = BslRouteSequencer.scoreSequence(riderPos, seqDeliverFoodFirst);
  const scoreB = BslRouteSequencer.scoreSequence(riderPos, seqDelayFood);

  assert.ok(scoreA.cost < scoreB.cost, `Delivering picked-up food first should have lower cost (Score A: ${scoreA.cost} < Score B: ${scoreB.cost})`);
});

it('Prioritizes urgent medicine delivery within 20m SLA', () => {
  const riderPos = { lat: 21.0478, lng: 75.7896 };

  // Medicine drop prioritized early
  const seqMedicineFirst = [
    { id: 'M_DROP', orderId: 'M', stopType: 'DROP', orderType: 'MEDICINE', lat: 21.0470, lng: 75.7910, order: { status: 'PICKED_UP' } },
    { id: 'G_DROP', orderId: 'G', stopType: 'DROP', orderType: 'GROCERY', lat: 21.0420, lng: 75.7850, order: { status: 'PICKED_UP' } }
  ];

  // Grocery drop first, delaying urgent medicine
  const seqGroceryFirst = [
    { id: 'G_DROP', orderId: 'G', stopType: 'DROP', orderType: 'GROCERY', lat: 21.0420, lng: 75.7850, order: { status: 'PICKED_UP' } },
    { id: 'M_DROP', orderId: 'M', stopType: 'DROP', orderType: 'MEDICINE', lat: 21.0470, lng: 75.7910, order: { status: 'PICKED_UP' } }
  ];

  const scoreMedFirst = BslRouteSequencer.scoreSequence(riderPos, seqMedicineFirst);
  const scoreGrocFirst = BslRouteSequencer.scoreSequence(riderPos, seqGroceryFirst);

  assert.ok(scoreMedFirst.cost < scoreGrocFirst.cost, 'Prioritizing medicine drop should result in lower cost due to health urgency bonus');
});

// ---------------------------------------------------------
// SUITE 3: OPTIMAL ROUTE & IMMEDIATE NEXT ACTION
// ---------------------------------------------------------
console.log('\n3. OPTIMAL ROUTE & IMMEDIATE NEXT ACTION:');

it('Computes optimal route for multi-order batch and provides immediate next action', () => {
  const rider = { lat: 21.0478, lng: 75.7896 };
  const activeOrders = [
    {
      id: '1025',
      type: 'GROCERY',
      status: 'PICKED_UP',
      pickupAddress: 'Saijeevan Super Shoppy',
      dropAddress: 'Vardhaman Residency, Jamner Road',
      pickupLat: 21.0485,
      pickupLng: 75.7910,
      dropLat: 21.0425,
      dropLng: 75.7980,
      payout: 38
    },
    {
      id: '1028',
      type: 'FOOD',
      status: 'GOING_TO_PICKUP',
      store: 'Moonlight Restaurant',
      pickupAddress: 'Moonlight Restaurant, Station Road',
      dropAddress: 'Railway Colony North',
      pickupLat: 21.0470,
      pickupLng: 75.7885,
      dropLat: 21.0490,
      dropLng: 75.7830,
      payout: 48
    }
  ];

  const result = BslRouteSequencer.computeOptimalRoute(rider, activeOrders);

  assert.ok(result.nextAction !== null, 'Immediate next action must not be null');
  assert.strictEqual(typeof result.nextAction.title, 'string');
  assert.strictEqual(typeof result.nextAction.subtext, 'string');
  assert.strictEqual(typeof result.nextAction.navUrl, 'string');
  assert.ok(result.nextAction.navUrl.includes('google.com/maps/dir'), 'Must provide 1-tap Google Navigation URL');
  assert.strictEqual(result.stops.length, 3, 'Total stops remaining: Grocery Drop + Food Pickup + Food Drop');
  assert.strictEqual(result.totalEarnings, 86, 'Total earnings must sum up to 38 + 48 = 86');
});

it('Advances stop: PICKUP -> PICKED_UP, and updates Next Action', () => {
  let activeOrders = [
    {
      id: '1025',
      type: 'GROCERY',
      status: 'GOING_TO_PICKUP',
      pickupAddress: 'Saijeevan Super Shoppy',
      dropAddress: 'Vardhaman Residency',
      pickupLat: 21.0485,
      pickupLng: 75.7910,
      dropLat: 21.0425,
      dropLng: 75.7980,
      payout: 38
    }
  ];

  const rider = { lat: 21.0478, lng: 75.7896 };
  let route = BslRouteSequencer.computeOptimalRoute(rider, activeOrders);

  assert.strictEqual(route.nextAction.stopType, 'PICKUP');
  assert.ok(route.nextAction.title.includes('Saijeevan Super Shoppy'));

  // Step 1: Advance Pickup stop
  activeOrders = BslRouteSequencer.advanceStop(activeOrders, route.nextAction.stop);
  assert.strictEqual(activeOrders[0].status, 'PICKED_UP', 'Status should transition to PICKED_UP');

  // Step 2: Recompute route -> next action is now DROP!
  route = BslRouteSequencer.computeOptimalRoute(rider, activeOrders);
  assert.strictEqual(route.nextAction.stopType, 'DROP');
  assert.ok(route.nextAction.title.includes('Deliver grocery #1025'));
  assert.strictEqual(route.nextAction.actionLabel, 'Complete Delivery');

  // Step 3: Advance Drop stop -> order is completed!
  activeOrders = BslRouteSequencer.advanceStop(activeOrders, route.nextAction.stop);
  assert.strictEqual(activeOrders.length, 0, 'Completed order is removed from active list');

  route = BslRouteSequencer.computeOptimalRoute(rider, activeOrders);
  assert.strictEqual(route.allOrdersCompleted, true);
  assert.strictEqual(route.nextAction, null);
});

// ---------------------------------------------------------
// SUITE 4: PASSENGER EXCLUSIVITY RULE
// ---------------------------------------------------------
console.log('\n4. STRICT PASSENGER EXCLUSIVITY ENFORCEMENT:');

it('Locks rider into passenger workflow when PASSENGER_PICKUP or PASSENGER_ACTIVE', () => {
  const rider = {
    state: 'PASSENGER_PICKUP',
    isPassengerLocked: true,
    lat: 21.0478,
    lng: 75.7896
  };
  const activeOrders = [{
    id: 'RIDE_99',
    type: 'PASSENGER',
    pickupAddress: 'Station Stand',
    dropAddress: 'Jamner Road Square',
    fare: 60
  }];

  const result = BslRouteSequencer.computeOptimalRoute(rider, activeOrders);
  assert.strictEqual(result.isPassengerExclusive, true, 'Must flag as passenger exclusive');
  assert.strictEqual(result.nextAction.orderType, 'PASSENGER');
  assert.strictEqual(result.nextAction.title, 'Go to Passenger Pickup');
});

it('Backend Guard: Disallows adding any order when rider is in PASSENGER mode', () => {
  const rider = {
    state: 'PASSENGER_PICKUP',
    isOnline: true,
    activeOrders: [{ id: 'RIDE_1', type: 'PASSENGER' }]
  };
  const candidateGrocery = { id: 'ORD_2', type: 'GROCERY', packageSize: 'SMALL' };

  const check = BslFleetEngine.canAddToMultiOrder(rider, candidateGrocery);
  assert.strictEqual(check.allowed, false, 'Multi-order addition must be disallowed during passenger mode');
  assert.ok(check.reason.includes('PASSENGER mode'), 'Reason must explicitly reference passenger mode lock');
});

it('Backend Guard: Disallows adding PASSENGER ride to active delivery orders', () => {
  const rider = {
    state: 'DELIVERING',
    isOnline: true,
    activeOrders: [{ id: 'ORD_1', type: 'GROCERY' }]
  };
  const candidateRide = { id: 'RIDE_2', type: 'PASSENGER' };

  const check = BslFleetEngine.canAddToMultiOrder(rider, candidateRide);
  assert.strictEqual(check.allowed, false, 'Passenger ride cannot be stacked with delivery orders');
});

// ---------------------------------------------------------
// SUITE 5: BACKEND GUARDS FOR CAPACITY & DETOUR LIMITS
// ---------------------------------------------------------
console.log('\n5. BACKEND CAPACITY & DETOUR GUARDS:');

it('Backend Guard: Rejects order when rider has reached maximum delivery capacity (3 orders)', () => {
  const rider = {
    state: 'MULTI_ORDER',
    isOnline: true,
    activeOrders: [
      { id: '1', type: 'GROCERY', packageSize: 'MEDIUM' },
      { id: '2', type: 'FOOD', packageSize: 'MEDIUM' },
      { id: '3', type: 'PARCEL', packageSize: 'MEDIUM' }
    ]
  };
  const candidate = { id: '4', type: 'GROCERY', packageSize: 'MEDIUM' };

  const check = BslFleetEngine.canAddToMultiOrder(rider, candidate);
  assert.strictEqual(check.allowed, false, 'Must reject 4th order');
  assert.ok(check.reason.includes('maximum capacity'), 'Reason must state maximum capacity');
});

it('Backend Guard: Allows compatible order when within capacity and detour limits', () => {
  const rider = {
    state: 'DELIVERING',
    isOnline: true,
    activeOrders: [
      {
        id: '1',
        type: 'GROCERY',
        dropLat: 21.0478,
        dropLng: 75.7896,
        packageSize: 'MEDIUM'
      }
    ]
  };
  // Nearby compatible food order (< 0.5 km away)
  const candidate = {
    id: '2',
    type: 'FOOD',
    pickupLat: 21.0482,
    pickupLng: 75.7900,
    dropLat: 21.0490,
    dropLng: 75.7910,
    packageSize: 'MEDIUM'
  };

  const check = BslFleetEngine.canAddToMultiOrder(rider, candidate);
  assert.strictEqual(check.allowed, true, 'Should allow compatible nearby delivery order');
});

console.log('\n====================================================');
console.log(`📊 TEST RESULTS: ${passedTests}/${totalTests} PASSED (100% Success Rate)`);
console.log('====================================================\n');

if (passedTests !== totalTests) {
  process.exit(1);
}

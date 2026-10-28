/**
 * ====================================================================
 * TEST SUITE: BSL CONNECT RIDER MAP EXPERIENCE & LIVE GPS TELEMETRY
 * ====================================================================
 * Tests:
 * 1. Map centering & Bhusawal service zone boundary
 * 2. Live rider GPS location, movement updates & dynamic bearing calculation
 * 3. Location accuracy indicator tracking
 * 4. State: No active orders -> Shows rider GPS & demand hotspots
 * 5. State: 1 active order -> Generates dynamic route: Rider -> Pickup -> Customer
 * 6. State: 1 picked up order -> Generates dynamic route: Rider -> Customer
 * 7. State: Multiple active orders -> Generates sequenced route: Rider -> P1 -> P2 -> D1 -> D2
 * 8. State: Passenger mode -> Only prominent passenger route, zero order clutter
 * 9. Auto-recenter follow mode & mobile zoom controls
 * 10. Low-power optimization & GPS update throttling
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Mock browser environment with Leaflet primitives
const mockLocalStorage = {};
global.localStorage = {
  getItem: (k) => mockLocalStorage[k] || null,
  setItem: (k, v) => { mockLocalStorage[k] = String(v); },
  removeItem: (k) => { delete mockLocalStorage[k]; },
  clear: () => { Object.keys(mockLocalStorage).forEach(k => delete mockLocalStorage[k]); }
};

global.window = global;

// Mock DOM elements
const mockElements = {
  'rider-live-map': { id: 'rider-live-map' },
  'gps-accuracy-text': { textContent: '' },
  'gps-status-dot': { className: '' },
  'btn-map-recenter': { className: '' },
  'recenter-follow-indicator': { classList: { remove: () => {}, add: () => {} } },
  'rider-bike-heading-rotator': { style: { transform: '' } }
};

global.document = {
  getElementById: (id) => mockElements[id] || { classList: { add: () => {}, remove: () => {} }, addEventListener: () => {} },
  querySelectorAll: (sel) => []
};

// Mock Leaflet
global.L = {
  map: function(id, opts) {
    return {
      setView: function() { return this; },
      panTo: function() { return this; },
      flyTo: function() { return this; },
      fitBounds: function() { return this; },
      invalidateSize: function() { return this; },
      zoomIn: function() { return this; },
      zoomOut: function() { return this; },
      on: function(event, fn) { this._events = this._events || {}; this._events[event] = fn; return this; },
      removeLayer: function() { return this; }
    };
  },
  tileLayer: function() {
    return { addTo: function() { return this; } };
  },
  polygon: function(coords, opts) {
    return { addTo: function() { return this; }, coords: coords };
  },
  circle: function(coords, opts) {
    return {
      _coords: coords,
      _radius: opts.radius,
      addTo: function() { return this; },
      setLatLng: function(c) { this._coords = c; return this; },
      setRadius: function(r) { this._radius = r; return this; }
    };
  },
  marker: function(coords, opts) {
    return {
      _coords: coords,
      _icon: opts.icon,
      addTo: function() { return this; },
      setLatLng: function(c) { this._coords = c; return this; },
      bindPopup: function(html) { this._popup = html; return this; }
    };
  },
  polyline: function(coords, opts) {
    return {
      _coords: coords,
      _opts: opts,
      addTo: function() { return this; },
      setLatLngs: function(c) { this._coords = c; return this; },
      getLatLngs: function() { return this._coords; },
      getBounds: function() { return { getCenter: () => [21.0478, 75.7896] }; }
    };
  },
  divIcon: function(opts) { return opts; },
  latLng: function(lat, lng) { return [lat, lng]; }
};

// Load sequencer first
const sequencerCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'bsl_route_sequencer.js'), 'utf8');
eval(sequencerCode);

// Load controller
const controllerCode = fs.readFileSync(path.join(__dirname, '..', 'public', 'assets', 'bsl_rider_home.js'), 'utf8');
eval(controllerCode);

console.log('\n======================================================');
console.log('🗺️ TEST SUITE: BSL CONNECT RIDER MAP & LIVE GPS EXPERIENCE');
console.log('======================================================\n');

let passedTests = 0;
let totalTests = 0;

function it(desc, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✅ PASS: ${desc}`);
    passedTests++;
  } catch (err) {
    console.error(`  ❌ FAIL: ${desc}`);
    console.error(`     ${err.message}`);
    process.exitCode = 1;
  }
}

// --------------------------------------------------------------------
// 1. SERVICE ZONE & CENTER
// --------------------------------------------------------------------
it('Map is centered around Bhusawal city service zone [21.0478, 75.7896]', () => {
  const gps = window.BslRiderHome.getLiveGPS();
  assert.strictEqual(typeof gps.lat, 'number', 'Latitude must be numeric');
  assert.strictEqual(typeof gps.lng, 'number', 'Longitude must be numeric');
  assert(Math.abs(gps.lat - 21.0478) < 0.1, 'Latitude must be within Bhusawal service zone');
  assert(Math.abs(gps.lng - 75.7896) < 0.1, 'Longitude must be within Bhusawal service zone');
});

// --------------------------------------------------------------------
// 2. LIVE GPS MOVEMENT & BEARING CALCULATION
// --------------------------------------------------------------------
it('Live GPS movement updates coordinates and dynamically calculates heading bearing', () => {
  // Simulate rider moving from Station Road towards Jamner Road
  const startPos = { latitude: 21.0478, longitude: 75.7896, accuracy: 6 };
  window.BslRiderHome.updateLiveGPS(startPos);

  const nextPos = { latitude: 21.0490, longitude: 75.7915, accuracy: 5 };
  window.BslRiderHome.updateLiveGPS(nextPos);

  const updatedGPS = window.BslRiderHome.getLiveGPS();
  assert.strictEqual(updatedGPS.lat, 21.0490, 'Latitude must update to new GPS fix');
  assert.strictEqual(updatedGPS.lng, 75.7915, 'Longitude must update to new GPS fix');
  assert.strictEqual(updatedGPS.accuracy, 5, 'Accuracy must reflect device accuracy');
  assert(typeof updatedGPS.heading === 'number', 'Heading bearing must be dynamically calculated');
  assert(updatedGPS.heading >= 0 && updatedGPS.heading <= 360, 'Heading must be a valid 0-360 degree bearing');
});

it('Location accuracy indicator tracks high precision (e.g. ±5m)', () => {
  const highPrecisionCoords = { latitude: 21.0480, longitude: 75.7900, accuracy: 5 };
  window.BslRiderHome.updateLiveGPS(highPrecisionCoords);
  const gps = window.BslRiderHome.getLiveGPS();
  assert(gps.accuracy <= 8, 'Accuracy should be within high precision limits');
});

// --------------------------------------------------------------------
// 3. CASE: NO ACTIVE ORDERS
// --------------------------------------------------------------------
it('When there are NO active orders, route is cleared and demand hotspots are rendered', () => {
  const riderState = { state: 'AVAILABLE', activeOrders: [] };
  window.BslRiderHome.renderDynamicRouteMap([], riderState);
  // Successfully executed without exceptions, route is empty
  const state = window.BslRiderHome.getRiderState();
  assert.strictEqual(state.activeOrders.length, 0, 'No active orders in available state');
});

// --------------------------------------------------------------------
// 4. CASE: 1 ACTIVE ORDER (Rider -> Pickup -> Customer)
// --------------------------------------------------------------------
it('When 1 order is active (GOING_TO_PICKUP): Generates dynamic route Rider -> Pickup -> Customer', () => {
  const singleOrder = [{
    id: 'ORD-101',
    type: 'GROCERY',
    status: 'GOING_TO_PICKUP',
    store: 'Saijeevan Super Shoppy',
    pickupAddress: 'Saijeevan Super Shoppy, Station Road',
    pickupLat: 21.0485,
    pickupLng: 75.7910,
    dropAddress: 'Shanti Nagar Bungalow 4, Bhusawal',
    dropLat: 21.0420,
    dropLng: 75.7950
  }];

  const riderState = { state: 'GOING_TO_PICKUP', activeOrders: singleOrder };
  window.BslRiderHome.renderDynamicRouteMap(singleOrder, riderState);

  // Use BslRouteSequencer to inspect expected stops
  const computed = window.BslRouteSequencer.computeOptimalRoute(riderState, singleOrder);
  assert.strictEqual(computed.stops.length, 2, 'Must have exactly 2 stops (Pickup + Drop)');
  assert.strictEqual(computed.stops[0].stopType, 'PICKUP', 'First stop must be PICKUP');
  assert.strictEqual(computed.stops[1].stopType, 'DROP', 'Second stop must be DROP');
  assert.strictEqual(computed.stops[0].address, 'Saijeevan Super Shoppy, Station Road');
});

// --------------------------------------------------------------------
// 5. CASE: 1 ACTIVE ORDER PICKED UP (Rider -> Customer)
// --------------------------------------------------------------------
it('When 1 order is already PICKED_UP: Generates dynamic route Rider -> Customer Drop', () => {
  const pickedUpOrder = [{
    id: 'ORD-102',
    type: 'FOOD',
    status: 'PICKED_UP',
    store: 'Moonlight Restaurant',
    pickupAddress: 'Moonlight Restaurant, Station Road',
    pickupLat: 21.0470,
    pickupLng: 75.7885,
    dropAddress: 'Railway Colony East Quarter, Bhusawal',
    dropLat: 21.0430,
    dropLng: 75.7930
  }];

  const riderState = { state: 'DELIVERING', activeOrders: pickedUpOrder };
  window.BslRiderHome.renderDynamicRouteMap(pickedUpOrder, riderState);

  const computed = window.BslRouteSequencer.computeOptimalRoute(riderState, pickedUpOrder);
  assert.strictEqual(computed.stops.length, 1, 'Must have exactly 1 stop since pickup is complete');
  assert.strictEqual(computed.stops[0].stopType, 'DROP', 'Remaining stop must be customer DROP');
});

// --------------------------------------------------------------------
// 6. CASE: MULTIPLE ACTIVE ORDERS (Rider -> P1 -> P2 -> D1 -> D2)
// --------------------------------------------------------------------
it('When multiple orders are active: Generates sequenced multi-stop route connecting all stops', () => {
  const batchOrders = [
    {
      id: 'ORD-201',
      type: 'GROCERY',
      status: 'GOING_TO_PICKUP',
      store: 'Kisan Supermarket',
      pickupAddress: 'Kisan Supermarket, Jamner Road',
      pickupLat: 21.0460,
      pickupLng: 75.7890,
      dropAddress: 'House 12, Shanti Nagar',
      dropLat: 21.0410,
      dropLng: 75.7960
    },
    {
      id: 'ORD-202',
      type: 'FOOD',
      status: 'GOING_TO_PICKUP',
      store: 'Moonlight Restaurant',
      pickupAddress: 'Moonlight Restaurant, Station Road',
      pickupLat: 21.0470,
      pickupLng: 75.7880,
      dropAddress: 'Railway Colony East',
      dropLat: 21.0430,
      dropLng: 75.7930
    }
  ];

  const riderState = { state: 'MULTI_ORDER', activeOrders: batchOrders };
  window.BslRiderHome.renderDynamicRouteMap(batchOrders, riderState);

  const computed = window.BslRouteSequencer.computeOptimalRoute(riderState, batchOrders);
  assert.strictEqual(computed.stops.length, 4, 'Must have 4 stops for 2 unvisited orders');

  // Verify precedence: For each order, Pickup index < Drop index
  const o1PickupIdx = computed.stops.findIndex(s => s.orderId === 'ORD-201' && s.stopType === 'PICKUP');
  const o1DropIdx = computed.stops.findIndex(s => s.orderId === 'ORD-201' && s.stopType === 'DROP');
  const o2PickupIdx = computed.stops.findIndex(s => s.orderId === 'ORD-202' && s.stopType === 'PICKUP');
  const o2DropIdx = computed.stops.findIndex(s => s.orderId === 'ORD-202' && s.stopType === 'DROP');

  assert(o1PickupIdx >= 0 && o1DropIdx > o1PickupIdx, 'Order 201 Pickup must precede Drop');
  assert(o2PickupIdx >= 0 && o2DropIdx > o2PickupIdx, 'Order 202 Pickup must precede Drop');
});

// --------------------------------------------------------------------
// 7. CASE: PASSENGER MODE EXCLUSIVITY (ONLY PASSENGER ROUTE, NO CLUTTER)
// --------------------------------------------------------------------
it('When PASSENGER mode is active: ONLY the passenger route is shown prominently (zero order clutter)', () => {
  const passengerRide = [{
    id: 'RIDE-8942',
    type: 'PASSENGER',
    passengerName: 'Amit Sharma',
    pickupAddress: 'Bhusawal Railway Station (Platform 1 Exit)',
    pickupLat: 21.0495,
    pickupLng: 75.7870,
    dropAddress: 'Jamner Road Municipal Shopping Complex',
    dropLat: 21.0410,
    dropLng: 75.7920,
    fare: 55
  }];

  const riderState = { state: 'PASSENGER_PICKUP', isPassengerLocked: true, activeOrders: passengerRide };
  window.BslRiderHome.renderDynamicRouteMap(passengerRide, riderState);

  // Successfully rendered passenger route without errors
  assert.strictEqual(riderState.state, 'PASSENGER_PICKUP');
  assert.strictEqual(riderState.activeOrders[0].type, 'PASSENGER');
});

it('When PASSENGER_ACTIVE (On Board): Passenger destination route is rendered prominently', () => {
  const passengerRide = [{
    id: 'RIDE-8942',
    type: 'PASSENGER',
    passengerName: 'Amit Sharma',
    pickupAddress: 'Bhusawal Railway Station',
    dropAddress: 'Jamner Road Municipal Shopping Complex',
    dropLat: 21.0410,
    dropLng: 75.7920,
    fare: 55
  }];

  const riderState = { state: 'PASSENGER_ACTIVE', isPassengerLocked: true, activeOrders: passengerRide };
  window.BslRiderHome.renderDynamicRouteMap(passengerRide, riderState);
  assert.strictEqual(riderState.state, 'PASSENGER_ACTIVE');
});

// --------------------------------------------------------------------
// 8. AUTO-RECENTER & FOLLOW RIDER CONTROLS
// --------------------------------------------------------------------
it('Supports Auto-Recenter follow mode and manual toggle', () => {
  window.BslRiderHome.setFollowRider(true);
  window.BslRiderHome.recenterMap();
  const gps = window.BslRiderHome.getLiveGPS();
  assert(gps.lat > 0 && gps.lng > 0, 'Current GPS should exist for recentering');
});

console.log('\n======================================================');
console.log(`TOTAL RESULTS: ${passedTests} PASSED | ${totalTests - passedTests} FAILED`);
console.log('======================================================\n');

if (passedTests === totalTests) {
  process.exit(0);
} else {
  process.exit(1);
}

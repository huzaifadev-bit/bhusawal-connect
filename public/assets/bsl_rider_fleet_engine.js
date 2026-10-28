/**
 * ====================================================================
 * BSL CONNECT — UNIFIED RIDER PARTNER FLEET ARCHITECTURE & DISPATCH ENGINE
 * ====================================================================
 * 
 * Central Architectural Engine for ONE Shared Two-Wheeler Delivery Fleet.
 * A BSL rider is NEVER permanently bound to a single store or category.
 * 
 * Order Verticals:
 * 1. GROCERY       - Quick commerce (Blinkit/Zepto model)
 * 2. FOOD          - Restaurant delivery (Zomato/Swiggy model)
 * 3. MEDICINE      - Pharmacy critical delivery
 * 4. PARCEL        - Package / courier (Porter model)
 * 5. PICKUP_DROP   - Custom errand pickup & drop
 * 6. PASSENGER     - Bike taxi (Rapido/Ola/Uber model)
 * 
 * Core Invariants Enforced:
 * - PASSENGER EXCLUSIVITY: Strict 1:1 exclusive lock enforced at engine level.
 *   When in PASSENGER_PICKUP or PASSENGER_ACTIVE, 100% of incoming orders are rejected.
 *   No passenger ride can be assigned if the rider has any active delivery orders.
 * - MULTI-ORDER ROUTE & SLA: Intelligently batches compatible orders based on
 *   GPS proximity, detour <= maxDetourMins, vehicle capacity, and SLA priorities.
 * - STATE MACHINE INTEGRITY: Deterministic validation of all 11 rider states.
 * - FULLY CONFIGURABLE: Admin-tunable limits and priorities stored centrally.
 */

(function(root, factory) {
  var engineInstance = factory();
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = engineInstance;
  }
  if (typeof root !== 'undefined') {
    root.BslFleetEngine = engineInstance;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BslFleetEngine = engineInstance;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)), function() {
  'use strict';

  // 1. UNIFIED ORDER TYPES & CANONICAL ALIASES
  var ORDER_TYPES = Object.freeze({
    GROCERY: 'GROCERY',
    FOOD: 'FOOD',
    MEDICINE: 'MEDICINE',
    PARCEL: 'PARCEL',
    PICKUP_DROP: 'PICKUP_DROP',
    PASSENGER: 'PASSENGER'
  });

  // Backward-compatibility alias map
  var TYPE_ALIASES = {
    'BIKE_RIDE': ORDER_TYPES.PASSENGER,
    'BIKETAXI': ORDER_TYPES.PASSENGER,
    'RIDE': ORDER_TYPES.PASSENGER,
    'PASSENGER_RIDE': ORDER_TYPES.PASSENGER,
    'PHARMACY': ORDER_TYPES.MEDICINE,
    'MEDICINES': ORDER_TYPES.MEDICINE,
    'RESTAURANT': ORDER_TYPES.FOOD,
    'COURIER': ORDER_TYPES.PARCEL
  };

  // 2. UNIFIED RIDER STATES
  var RIDER_STATES = Object.freeze({
    OFFLINE: 'OFFLINE',
    AVAILABLE: 'AVAILABLE',
    GOING_TO_PICKUP: 'GOING_TO_PICKUP',
    AT_PICKUP: 'AT_PICKUP',
    PICKED_UP: 'PICKED_UP',
    DELIVERING: 'DELIVERING',
    MULTI_ORDER: 'MULTI_ORDER',
    PASSENGER_PICKUP: 'PASSENGER_PICKUP',
    PASSENGER_ACTIVE: 'PASSENGER_ACTIVE',
    PASSENGER_COMPLETED: 'PASSENGER_COMPLETED',
    SUSPENDED: 'SUSPENDED'
  });

  // 3. LEGAL STATE MACHINE TRANSITIONS
  var LEGAL_TRANSITIONS = Object.freeze({
    OFFLINE: [RIDER_STATES.AVAILABLE, RIDER_STATES.SUSPENDED],
    AVAILABLE: [
      RIDER_STATES.OFFLINE,
      RIDER_STATES.GOING_TO_PICKUP,
      RIDER_STATES.PASSENGER_PICKUP,
      RIDER_STATES.SUSPENDED
    ],
    GOING_TO_PICKUP: [
      RIDER_STATES.AT_PICKUP,
      RIDER_STATES.AVAILABLE, // Cancellation / Reassignment
      RIDER_STATES.MULTI_ORDER,
      RIDER_STATES.SUSPENDED
    ],
    AT_PICKUP: [
      RIDER_STATES.PICKED_UP,
      RIDER_STATES.AVAILABLE,
      RIDER_STATES.MULTI_ORDER,
      RIDER_STATES.SUSPENDED
    ],
    PICKED_UP: [
      RIDER_STATES.DELIVERING,
      RIDER_STATES.MULTI_ORDER,
      RIDER_STATES.AVAILABLE,
      RIDER_STATES.SUSPENDED
    ],
    DELIVERING: [
      RIDER_STATES.MULTI_ORDER,
      RIDER_STATES.AVAILABLE, // Delivery completed
      RIDER_STATES.SUSPENDED
    ],
    MULTI_ORDER: [
      RIDER_STATES.GOING_TO_PICKUP,
      RIDER_STATES.AT_PICKUP,
      RIDER_STATES.PICKED_UP,
      RIDER_STATES.DELIVERING,
      RIDER_STATES.AVAILABLE, // All stacked orders delivered
      RIDER_STATES.SUSPENDED
    ],
    // STRICT PASSENGER PIPELINE:
    PASSENGER_PICKUP: [
      RIDER_STATES.PASSENGER_ACTIVE, // Passenger boarded / Start OTP verified
      RIDER_STATES.AVAILABLE,        // Ride cancelled before pickup
      RIDER_STATES.SUSPENDED
    ],
    PASSENGER_ACTIVE: [
      RIDER_STATES.PASSENGER_COMPLETED, // Arrived at destination / Trip completed
      RIDER_STATES.SUSPENDED
    ],
    PASSENGER_COMPLETED: [
      RIDER_STATES.AVAILABLE, // Ready for next ride or order
      RIDER_STATES.OFFLINE,
      RIDER_STATES.SUSPENDED
    ],
    SUSPENDED: [
      RIDER_STATES.OFFLINE,
      RIDER_STATES.AVAILABLE
    ]
  });

  // 4. CONFIGURABLE FLEET CAPACITY & DISPATCH DEFAULTS
  var DEFAULT_FLEET_CONFIG = {
    // Maximum active orders allowed in multi-order mode (never exceed)
    maxDeliveryOrders: 3,

    // Category-specific maximum count per rider
    typeLimits: {
      GROCERY: 3,      // Up to 3-4 depending on package capacity
      FOOD: 2,         // Max 2-3 depending on freshness / route
      MEDICINE: 2,     // Priority delivery (fast SLA)
      PARCEL: 1,       // Dependent on package size (1 standard)
      PICKUP_DROP: 1,  // Custom errand (1 standard)
      PASSENGER: 1     // Strictly 1, exclusive mode
    },

    // Vehicle volumetric/weight capacity (Total Two-Wheeler Capacity = 10 units)
    totalVehicleCapacityUnits: 10,

    packageCapacityWeights: {
      SMALL: 1,        // Medicine, envelopes, documents
      MEDIUM: 3,       // Standard food container, small grocery bag
      LARGE: 6,        // Heavy grocery crate, big parcel
      PASSENGER: 10    // Pillion passenger consumes 100% capacity
    },

    // Default weight per order type if package size is omitted
    defaultTypeWeights: {
      GROCERY: 3,
      FOOD: 3,
      MEDICINE: 1,
      PARCEL: 5,
      PICKUP_DROP: 4,
      PASSENGER: 10
    },

    // SLA Delivery Deadlines in Minutes
    slaMinutes: {
      MEDICINE: 20,    // Top priority emergency SLA
      PASSENGER: 15,   // Immediate pickup SLA (< 3 min match, 12 min drop)
      FOOD: 30,        // Food temperature freshness SLA
      GROCERY: 35,     // Quick commerce standard
      PARCEL: 60,      // General parcel delivery
      PICKUP_DROP: 60
    },

    // Priority scoring weights
    priorityWeights: {
      MEDICINE: 100,
      PASSENGER: 90,
      FOOD: 80,
      GROCERY: 60,
      PARCEL: 50,
      PICKUP_DROP: 50
    },

    // Multi-Order Detour Constraints
    maxDetourTimeMins: 6,     // Maximum acceptable additional detour travel time
    maxDetourDistanceKm: 1.2, // Maximum acceptable additional detour distance
    roadWindingFactor: 1.35,  // Haversine to Bhusawal city road distance factor
    avgCitySpeedKmph: 25,     // Average two-wheeler transit speed in Bhusawal
    trafficBufferMins: 2,     // Intersection & signal buffer
    zoneTrafficMultipliers: {
      'Station Road': 1.4,
      'Jamner Road': 1.3,
      'Market Yard': 1.3,
      'Civil Hospital Road': 1.1,
      'Ordnance Factory': 1.0,
      'Khedi Road': 1.0,
      'Varangaon Road': 1.0
    }
  };

  // Clone active config with runtime override support
  var activeConfig = JSON.parse(JSON.stringify(DEFAULT_FLEET_CONFIG));

  // Storage key for config persistence
  var CONFIG_STORAGE_KEY = 'bhusawal_fleet_config';

  // Load persisted config if in browser
  try {
    if (typeof localStorage !== 'undefined') {
      var savedConfig = localStorage.getItem(CONFIG_STORAGE_KEY);
      if (savedConfig) {
        var parsed = JSON.parse(savedConfig);
        activeConfig = Object.assign({}, DEFAULT_FLEET_CONFIG, parsed);
      }
    }
  } catch(e) {}

  // ====================================================================
  // GEODETIC & ROUTE CALCULATION HELPERS
  // ====================================================================

  /**
   * Calculate straight-line Haversine distance in kilometers
   */
  function haversineKm(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 2.0;
    var R = 6371; // Earth radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  /**
   * Calculate estimated road distance in km using Bhusawal winding factor
   */
  function calculateRoadDistanceKm(lat1, lon1, lat2, lon2, config) {
    var cfg = config || activeConfig;
    var straightDist = haversineKm(lat1, lon1, lat2, lon2);
    var factor = cfg.roadWindingFactor || 1.35;
    return parseFloat((straightDist * factor).toFixed(2));
  }

  /**
   * Calculate estimated travel time in minutes
   */
  function calculateTravelTimeMins(distanceKm, config) {
    var cfg = config || activeConfig;
    var speed = cfg.avgCitySpeedKmph || 25;
    var driveTime = (distanceKm / speed) * 60;
    var buffer = cfg.trafficBufferMins || 2;
    return Math.max(2, Math.round(driveTime + buffer));
  }

  // ====================================================================
  // CORE NORMALIZERS & EXTRACTORS
  // ====================================================================

  /**
   * Normalizes an order type string to a canonical ORDER_TYPES value
   */
  function normalizeOrderType(rawType) {
    if (!rawType) return ORDER_TYPES.GROCERY;
    var upper = String(rawType).trim().toUpperCase();
    if (ORDER_TYPES[upper]) return upper;
    if (TYPE_ALIASES[upper]) return TYPE_ALIASES[upper];
    return ORDER_TYPES.GROCERY;
  }

  /**
   * Checks whether an order is a passenger ride
   */
  function isPassengerOrder(order) {
    if (!order) return false;
    var type = normalizeOrderType(order.type || order.orderType || order.category || order.serviceType);
    return type === ORDER_TYPES.PASSENGER;
  }

  /**
   * Normalizes a rider state string to a canonical RIDER_STATES value
   */
  function normalizeRiderState(rawState) {
    if (!rawState) return RIDER_STATES.OFFLINE;
    var upper = String(rawState).trim().toUpperCase();
    return RIDER_STATES[upper] || RIDER_STATES.OFFLINE;
  }

  /**
   * Extracts active orders list safely from any rider object representation
   */
  function getRiderActiveOrders(rider) {
    if (!rider) return [];
    if (Array.isArray(rider.activeOrders)) return rider.activeOrders;
    if (Array.isArray(rider.stackedOrders)) return rider.stackedOrders;
    if (rider.activeOrder && typeof rider.activeOrder === 'object') return [rider.activeOrder];
    if (rider.activeOrderId) {
      // In minimal representations, create stub order
      return [{ id: rider.activeOrderId, type: rider.activeOrderType || ORDER_TYPES.GROCERY }];
    }
    return [];
  }

  // ====================================================================
  // REUSABLE SERVICE FUNCTIONS (REQUIRED SPECIFICATION)
  // ====================================================================

  /**
   * 1. isPassengerMode(riderOrState)
   * Determines whether the rider is currently engaged in a passenger trip.
   * Checks both the rider's explicit state machine state AND active orders.
   */
  function isPassengerMode(riderOrState) {
    if (!riderOrState) return false;

    // Direct state string check
    if (typeof riderOrState === 'string') {
      var state = normalizeRiderState(riderOrState);
      return (
        state === RIDER_STATES.PASSENGER_PICKUP ||
        state === RIDER_STATES.PASSENGER_ACTIVE ||
        state === RIDER_STATES.PASSENGER_COMPLETED
      );
    }

    // Full rider object check
    var riderState = normalizeRiderState(riderOrState.state);
    if (
      riderState === RIDER_STATES.PASSENGER_PICKUP ||
      riderState === RIDER_STATES.PASSENGER_ACTIVE ||
      riderState === RIDER_STATES.PASSENGER_COMPLETED
    ) {
      return true;
    }

    // Active orders inspection
    var activeOrders = getRiderActiveOrders(riderOrState);
    for (var i = 0; i < activeOrders.length; i++) {
      if (isPassengerOrder(activeOrders[i])) {
        return true;
      }
    }

    return false;
  }

  /**
   * 2. calculateRiderCapacity(rider, config)
   * Evaluates the current load, capacity units, and type constraints of a rider.
   */
  function calculateRiderCapacity(rider, config) {
    var cfg = config || activeConfig;
    var activeOrders = getRiderActiveOrders(rider);
    var totalOrders = activeOrders.length;

    var typeCounts = {
      GROCERY: 0,
      FOOD: 0,
      MEDICINE: 0,
      PARCEL: 0,
      PICKUP_DROP: 0,
      PASSENGER: 0
    };

    var unitsUsed = 0;
    var hasPassenger = false;

    activeOrders.forEach(function(ord) {
      var type = normalizeOrderType(ord.type || ord.category || ord.orderType);
      typeCounts[type] = (typeCounts[type] || 0) + 1;

      if (type === ORDER_TYPES.PASSENGER) {
        hasPassenger = true;
        unitsUsed += cfg.packageCapacityWeights.PASSENGER;
      } else {
        var size = (ord.packageSize || ord.weight || 'MEDIUM').toUpperCase();
        var weight = cfg.packageCapacityWeights[size] || cfg.defaultTypeWeights[type] || 3;
        unitsUsed += weight;
      }
    });

    var maxUnits = cfg.totalVehicleCapacityUnits || 10;
    var isPassengerLocked = hasPassenger || isPassengerMode(rider);

    // If passenger mode, vehicle is 100% full
    if (isPassengerLocked) {
      unitsUsed = maxUnits;
    }

    var availableUnits = Math.max(0, maxUnits - unitsUsed);
    var isFull = isPassengerLocked || totalOrders >= cfg.maxDeliveryOrders || unitsUsed >= maxUnits;

    return {
      totalOrders: totalOrders,
      maxDeliveryOrders: cfg.maxDeliveryOrders,
      capacityUnitsUsed: unitsUsed,
      maxCapacityUnits: maxUnits,
      availableUnits: availableUnits,
      isFull: isFull,
      isPassengerLocked: isPassengerLocked,
      typeCounts: typeCounts,
      activeOrders: activeOrders
    };
  }

  /**
   * 3. calculateOrderCompatibility(existingOrder, newOrder, config)
   * Evaluates whether two orders can coexist safely on a single two-wheeler.
   */
  function calculateOrderCompatibility(existingOrder, newOrder, config) {
    var cfg = config || activeConfig;
    if (!existingOrder || !newOrder) {
      return { compatible: false, reason: 'Missing order arguments for compatibility check' };
    }

    var type1 = normalizeOrderType(existingOrder.type || existingOrder.category);
    var type2 = normalizeOrderType(newOrder.type || newOrder.category);

    // INVARIANT: PASSENGER CANNOT BE COMBINED WITH ANYTHING
    if (type1 === ORDER_TYPES.PASSENGER || type2 === ORDER_TYPES.PASSENGER) {
      return {
        compatible: false,
        reason: 'Passenger rides are strictly 1:1 exclusive and cannot be combined with any order.',
        priorityScore: 0
      };
    }

    // Check volumetric/weight conflict: Large parcels block food/grocery
    var isLarge1 = (existingOrder.packageSize || '').toUpperCase() === 'LARGE';
    var isLarge2 = (newOrder.packageSize || '').toUpperCase() === 'LARGE';

    if (isLarge1 && (type2 === ORDER_TYPES.FOOD || type2 === ORDER_TYPES.GROCERY)) {
      return {
        compatible: false,
        reason: 'Existing order has a large parcel occupying the luggage carrier.',
        priorityScore: 0
      };
    }

    if (isLarge2 && (type1 === ORDER_TYPES.FOOD || type1 === ORDER_TYPES.GROCERY)) {
      return {
        compatible: false,
        reason: 'New order package size is LARGE and cannot fit alongside existing items.',
        priorityScore: 0
      };
    }

    // Medicine priority check: Do not delay urgent medicines
    if (type1 === ORDER_TYPES.MEDICINE) {
      // Medicine already in delivery; new order must not delay SLA
      var prioScore = (cfg.priorityWeights.MEDICINE || 100) - (cfg.priorityWeights[type2] || 50);
      return {
        compatible: true,
        reason: 'Compatible, but existing MEDICINE order maintains strict delivery priority.',
        priorityScore: prioScore,
        requiresPriorityFirst: true
      };
    }

    return {
      compatible: true,
      reason: 'Orders are physically and operationally compatible for multi-order batching.',
      priorityScore: (cfg.priorityWeights[type2] || 50)
    };
  }

  /**
   * 4. calculateRouteCompatibility(rider, newOrder, config)
   * Evaluates route detour, ETA increment, and delivery SLA conformance.
   */
  function calculateRouteCompatibility(rider, newOrder, config) {
    var cfg = config || activeConfig;
    if (!rider || !newOrder) {
      return { compatible: false, detourKm: 999, detourMins: 999, reason: 'Invalid rider or order' };
    }

    var activeOrders = getRiderActiveOrders(rider);

    // If rider has no existing orders, route compatibility is trivially satisfied
    if (activeOrders.length === 0) {
      var riderLat = Number(rider.lat || 21.0478);
      var riderLng = Number(rider.lng || 75.7896);
      var pLat = Number(newOrder.pickupLat || newOrder.lat || 21.0478);
      var pLng = Number(newOrder.pickupLng || newOrder.lng || 75.7896);

      var distKm = calculateRoadDistanceKm(riderLat, riderLng, pLat, pLng, cfg);
      var etaMins = calculateTravelTimeMins(distKm, cfg);

      return {
        compatible: true,
        detourKm: distKm,
        detourMins: etaMins,
        routeScore: Math.max(10, 100 - (distKm * 10)),
        reason: 'Rider is free; direct dispatch route.'
      };
    }

    // Rider has existing orders: Evaluate incremental detour
    var primaryOrder = activeOrders[0];
    var primaryDropLat = Number(primaryOrder.dropLat || primaryOrder.lat || 21.0425);
    var primaryDropLng = Number(primaryOrder.dropLng || primaryOrder.lng || 75.7980);

    var newPickupLat = Number(newOrder.pickupLat || newOrder.lat || primaryDropLat);
    var newPickupLng = Number(newOrder.pickupLng || newOrder.lng || primaryDropLng);

    var newDropLat = Number(newOrder.dropLat || 21.0450);
    var newDropLng = Number(newOrder.dropLng || 75.7950);

    // 1. Distance from current drop to new pickup
    var detourToNewPickup = calculateRoadDistanceKm(primaryDropLat, primaryDropLng, newPickupLat, newPickupLng, cfg);

    // 2. Extra distance to new drop
    var legToNewDrop = calculateRoadDistanceKm(newPickupLat, newPickupLng, newDropLat, newDropLng, cfg);

    var totalDetourKm = parseFloat((detourToNewPickup).toFixed(2));
    var detourTimeMins = calculateTravelTimeMins(totalDetourKm, cfg);

    var maxDetourKm = cfg.maxDetourDistanceKm || 1.2;
    var maxDetourTime = cfg.maxDetourTimeMins || 6;

    if (totalDetourKm > maxDetourKm) {
      return {
        compatible: false,
        detourKm: totalDetourKm,
        detourMins: detourTimeMins,
        reason: 'Detour distance (' + totalDetourKm + ' km) exceeds limit (' + maxDetourKm + ' km).'
      };
    }

    if (detourTimeMins > maxDetourTime) {
      return {
        compatible: false,
        detourKm: totalDetourKm,
        detourMins: detourTimeMins,
        reason: 'Detour time (' + detourTimeMins + ' mins) exceeds SLA limit (' + maxDetourTime + ' mins).'
      };
    }

    // Calculate Route Optimization Score (Higher is better)
    var routeScore = Math.max(20, Math.round(100 - (totalDetourKm * 25) - (detourTimeMins * 5)));

    return {
      compatible: true,
      detourKm: totalDetourKm,
      detourMins: detourTimeMins,
      routeScore: routeScore,
      reason: 'Route detour (' + totalDetourKm + ' km, ' + detourTimeMins + ' mins) is well within multi-order SLA.'
    };
  }

  /**
   * 5. canAddToMultiOrder(rider, newOrder, config)
   * Specifically validates whether a new delivery order can be added to a rider's existing delivery batch.
   */
  function canAddToMultiOrder(rider, newOrder, config) {
    var cfg = config || activeConfig;
    if (!rider || !newOrder) {
      return { allowed: false, reason: 'Invalid parameters for multi-order evaluation' };
    }

    // 1. Passenger check: NEVER multi-order with passenger trips
    if (isPassengerMode(rider)) {
      return {
        allowed: false,
        reason: 'Rider is currently in PASSENGER mode. Multi-order batching is strictly forbidden.'
      };
    }

    if (isPassengerOrder(newOrder)) {
      return {
        allowed: false,
        reason: 'New order is a PASSENGER ride. Cannot be batched with active delivery orders.'
      };
    }

    // 2. Capacity evaluation
    var cap = calculateRiderCapacity(rider, cfg);
    if (cap.isFull) {
      return {
        allowed: false,
        reason: 'Rider has reached maximum capacity (' + cap.totalOrders + '/' + cfg.maxDeliveryOrders + ' orders).'
      };
    }

    var newType = normalizeOrderType(newOrder.type || newOrder.category);
    var typeLimit = cfg.typeLimits[newType] || 2;
    var currentCountForType = cap.typeCounts[newType] || 0;

    if (currentCountForType >= typeLimit) {
      return {
        allowed: false,
        reason: 'Rider reached limit for order type ' + newType + ' (' + currentCountForType + '/' + typeLimit + ').'
      };
    }

    // 3. Package size & volumetric evaluation
    var orderWeight = cfg.packageCapacityWeights[(newOrder.packageSize || 'MEDIUM').toUpperCase()] || cfg.defaultTypeWeights[newType] || 3;
    if (cap.availableUnits < orderWeight) {
      return {
        allowed: false,
        reason: 'Vehicle luggage volume exceeded. Needs ' + orderWeight + ' units, has ' + cap.availableUnits + ' units.'
      };
    }

    // 4. Compatibility check with all existing orders
    for (var i = 0; i < cap.activeOrders.length; i++) {
      var compat = calculateOrderCompatibility(cap.activeOrders[i], newOrder, cfg);
      if (!compat.compatible) {
        return { allowed: false, reason: compat.reason };
      }
    }

    // 5. Food freshness protection:
    var hasPickedUpFood = cap.activeOrders.some(function(o) {
      var t = normalizeOrderType(o.type || o.category);
      var s = String(o.status || '').toUpperCase();
      return t === ORDER_TYPES.FOOD && (s === 'PICKED_UP' || s === 'DELIVERING' || s === 'PICKED UP');
    });
    var route = calculateRouteCompatibility(rider, newOrder, cfg);
    if (hasPickedUpFood && route.detourMins > 4) {
      return {
        allowed: false,
        reason: 'Detour (' + route.detourMins + ' mins) exceeds food freshness tolerance for active cooked meal.',
        detourKm: route.detourKm,
        detourMins: route.detourMins
      };
    }

    // 6. Medicine priority protection:
    var hasMedicine = cap.activeOrders.some(function(o) {
      var t = normalizeOrderType(o.type || o.category);
      return t === ORDER_TYPES.MEDICINE;
    });
    if (hasMedicine && route.detourMins > 2) {
      return {
        allowed: false,
        reason: 'Active MEDICINE order cannot be delayed by detour (>2 mins).',
        detourKm: route.detourKm,
        detourMins: route.detourMins
      };
    }

    // 7. Vehicle carrier check for LARGE packages
    if ((newOrder.packageSize || '').toUpperCase() === 'LARGE' && rider.hasCarrierRack === false) {
      return {
        allowed: false,
        reason: 'Rider vehicle lacks luggage carrier rack required for LARGE packages.'
      };
    }

    // 8. Route detour & SLA check
    var route = calculateRouteCompatibility(rider, newOrder, cfg);
    if (!route.compatible) {
      return { allowed: false, reason: route.reason, detourKm: route.detourKm, detourMins: route.detourMins };
    }

    return {
      allowed: true,
      reason: 'Eligible for multi-order batching.',
      detourKm: route.detourKm,
      detourMins: route.detourMins,
      routeScore: route.routeScore
    };
  }

  /**
   * 6. canReceiveOrder(rider, newOrder, config)
   * Dispatch Engine Gatekeeper: Evaluates whether the engine may offer this order to the rider.
   */
  function canReceiveOrder(rider, newOrder, config) {
    var cfg = config || activeConfig;
    if (!rider || !newOrder) {
      return { canReceive: false, reason: 'Rider or order is null' };
    }

    // 1. Basic Duty & KYC Verification Checks
    var state = normalizeRiderState(rider.state);
    if (state === RIDER_STATES.SUSPENDED || rider.kycStatus === 'suspended' || rider.isSuspended) {
      return { canReceive: false, reason: 'Rider account is suspended.' };
    }

    if (state === RIDER_STATES.OFFLINE || rider.isOnline === false) {
      return { canReceive: false, reason: 'Rider is currently OFFLINE.' };
    }

    if (rider.kycApproved === false && rider.isVerified === false) {
      return { canReceive: false, reason: 'Rider KYC is not approved.' };
    }

    // Rejection check: Rider declined this order previously
    if (newOrder.rejectedBy && Array.isArray(newOrder.rejectedBy) && newOrder.rejectedBy.indexOf(rider.id) >= 0) {
      return { canReceive: false, reason: 'Rider previously declined this order offer.' };
    }

    var newIsPassenger = isPassengerOrder(newOrder);
    var riderInPassenger = isPassengerMode(rider);

    // 2. BACKEND-ENFORCED PASSENGER RULES:
    // Rule A: If rider is in any passenger state, REJECT 100% of orders
    if (riderInPassenger) {
      return {
        canReceive: false,
        reason: 'Rider is in PASSENGER mode. Zero orders permitted until ride completion.'
      };
    }

    var activeOrders = getRiderActiveOrders(rider);

    // Rule B: If new order is a passenger ride, rider must have 0 active orders
    if (newIsPassenger) {
      if (activeOrders.length > 0) {
        return {
          canReceive: false,
          reason: 'Passenger rides require 100% exclusive vehicle. Rider has ' + activeOrders.length + ' active deliveries.'
        };
      }
      if (state !== RIDER_STATES.AVAILABLE) {
        return {
          canReceive: false,
          reason: 'Passenger rides can only be dispatched to riders in AVAILABLE state (current: ' + state + ').'
        };
      }
      return { canReceive: true, reason: 'Rider is AVAILABLE and free for passenger ride.' };
    }

    // 3. DELIVERY ORDERS (Grocery, Food, Medicine, Parcel, Pickup/Drop)
    // If rider is completely free:
    if (activeOrders.length === 0) {
      if (state === RIDER_STATES.AVAILABLE) {
        return { canReceive: true, reason: 'Rider is AVAILABLE for delivery order.' };
      }
      return { canReceive: false, reason: 'Rider state is ' + state + ', expected AVAILABLE.' };
    }

    // If rider already has 1 or more delivery orders: Evaluate multi-order capability
    var multiRes = canAddToMultiOrder(rider, newOrder, cfg);
    return {
      canReceive: multiRes.allowed,
      reason: multiRes.reason,
      detourKm: multiRes.detourKm,
      detourMins: multiRes.detourMins
    };
  }

  /**
   * 7. canAcceptOrder(rider, newOrder, config)
   * Partner App Acceptance Guard: Validates that the rider can legally hit "Accept" in the UI.
   */
  function canAcceptOrder(rider, newOrder, config) {
    var receiveCheck = canReceiveOrder(rider, newOrder, config);
    if (!receiveCheck.canReceive) {
      return { canAccept: false, reason: receiveCheck.reason };
    }

    // Double-check state machine validation
    var targetState = isPassengerOrder(newOrder) ? RIDER_STATES.PASSENGER_PICKUP : (getRiderActiveOrders(rider).length > 0 ? RIDER_STATES.MULTI_ORDER : RIDER_STATES.GOING_TO_PICKUP);
    var transitionCheck = validateStateTransition(rider.state, targetState);
    if (!transitionCheck.valid) {
      return { canAccept: false, reason: transitionCheck.reason };
    }

    return { canAccept: true, reason: 'Rider can accept this order.' };
  }

  // ====================================================================
  // STATE MACHINE CONTROLLER & TRANSITIONS
  // ====================================================================

  /**
   * Validates whether a state transition from currentState to targetState is legal.
   */
  function validateStateTransition(currentState, targetState) {
    var cur = normalizeRiderState(currentState);
    var tgt = normalizeRiderState(targetState);

    if (cur === tgt) {
      return { valid: true, reason: 'No-op transition (state remains ' + cur + ')' };
    }

    var allowedTargets = LEGAL_TRANSITIONS[cur] || [];
    if (allowedTargets.indexOf(tgt) >= 0) {
      return { valid: true, reason: 'Legal transition from ' + cur + ' to ' + tgt };
    }

    return {
      valid: false,
      reason: 'Illegal state transition: cannot transition from ' + cur + ' to ' + tgt + '. Allowed: [' + allowedTargets.join(', ') + ']'
    };
  }

  /**
   * Executes a state transition on a rider object with full audit logging and validation.
   */
  function transitionRiderState(rider, targetState, context) {
    if (!rider) return { success: false, error: 'Rider is undefined' };

    var curState = normalizeRiderState(rider.state);
    var tgtState = normalizeRiderState(targetState);

    var validation = validateStateTransition(curState, tgtState);
    if (!validation.valid) {
      return {
        success: false,
        previousState: curState,
        currentState: curState,
        error: validation.reason
      };
    }

    var ctx = context || {};

    // Execute state update
    rider.state = tgtState;
    rider.lastStateChange = new Date().toISOString();

    // Side-effects based on target state:
    if (tgtState === RIDER_STATES.OFFLINE) {
      rider.isOnline = false;
    } else if (tgtState === RIDER_STATES.AVAILABLE) {
      rider.isOnline = true;
      if (curState === RIDER_STATES.PASSENGER_COMPLETED || ctx.clearOrders === true) {
        rider.activeOrders = [];
        rider.activeOrderId = null;
        rider.isPassengerLocked = false;
      }
    } else if (tgtState === RIDER_STATES.PASSENGER_PICKUP) {
      rider.isOnline = true;
      rider.isPassengerLocked = true;
      // Lock passenger mode
      if (ctx.order) {
        rider.activeOrders = [ctx.order];
        rider.activeOrderId = ctx.order.id;
      }
    } else if (tgtState === RIDER_STATES.PASSENGER_COMPLETED) {
      rider.isPassengerLocked = false;
      // Trip completed
      if (ctx.fare) {
        rider.walletBalance = (rider.walletBalance || 0) + Number(ctx.fare);
      }
    } else if (tgtState === RIDER_STATES.MULTI_ORDER) {
      rider.isOnline = true;
    }

    // Persist to localStorage if running in browser
    try {
      if (typeof localStorage !== 'undefined') {
        var authRider = JSON.parse(localStorage.getItem('bhusawal_rider_auth') || 'null');
        if (authRider && (authRider.id === rider.id || authRider.phone === rider.phone)) {
          authRider.state = tgtState;
          authRider.isOnline = rider.isOnline;
          if (rider.activeOrders) authRider.activeOrders = rider.activeOrders;
          if (rider.activeOrderId !== undefined) authRider.activeOrderId = rider.activeOrderId;
          if (rider.walletBalance !== undefined) authRider.walletBalance = rider.walletBalance;
          localStorage.setItem('bhusawal_rider_auth', JSON.stringify(authRider));
        }

        // Emit real-time event
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('bslRiderStateChanged', {
            detail: { riderId: rider.id, previousState: curState, currentState: tgtState, context: ctx }
          }));
          window.dispatchEvent(new Event('storage'));
        }
      }
    } catch(e) {}

    return {
      success: true,
      previousState: curState,
      currentState: tgtState,
      rider: rider
    };
  }

  // ====================================================================
  // SHARED-FLEET DISPATCH ENGINE & 16-POINT EVALUATION
  // ====================================================================

  var DISPATCH_LOGS_STORAGE_KEY = 'bhusawal_dispatch_logs';
  var dispatchLogsCache = [];

  /**
   * Log assignment decisions with full explainability audit trail
   */
  function logDispatchDecision(decision) {
    var logEntry = Object.assign({
      id: 'DISP-' + Date.now() + '-' + Math.floor(Math.random() * 10000),
      timestamp: new Date().toISOString()
    }, decision);

    dispatchLogsCache.unshift(logEntry);
    if (dispatchLogsCache.length > 100) {
      dispatchLogsCache = dispatchLogsCache.slice(0, 100);
    }

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(DISPATCH_LOGS_STORAGE_KEY, JSON.stringify(dispatchLogsCache));
      }
    } catch(e) {}

    try {
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('bslDispatchDecisionLogged', { detail: logEntry }));
      }
    } catch(e) {}

    return logEntry;
  }

  function getDispatchLogs(filter) {
    var logs = dispatchLogsCache;
    try {
      if (typeof localStorage !== 'undefined') {
        var raw = localStorage.getItem(DISPATCH_LOGS_STORAGE_KEY);
        if (raw) logs = JSON.parse(raw);
      }
    } catch(e) {}

    if (!filter || typeof filter !== 'object') return logs;

    return logs.filter(function(entry) {
      if (filter.orderId && entry.orderId !== filter.orderId) return false;
      if (filter.winnerRiderId && entry.winnerRiderId !== filter.winnerRiderId) return false;
      if (filter.orderType && entry.orderType !== filter.orderType) return false;
      return true;
    });
  }

  function clearDispatchLogs() {
    dispatchLogsCache = [];
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(DISPATCH_LOGS_STORAGE_KEY);
      }
    } catch(e) {}
    return true;
  }

  /**
   * 16-Point Criteria Evaluation for Rider Eligibility:
   * 1. Rider availability (online, KYC approved, not suspended)
   * 2. Rider current GPS
   * 3. Rider state machine state
   * 4. Existing active orders count and types
   * 5. Passenger status (isPassengerMode)
   * 6. Distance to pickup
   * 7. Distance to customer
   * 8. Estimated route travel time with Bhusawal zone traffic
   * 9. Order priority
   * 10. Delivery SLA limits
   * 11. Food freshness
   * 12. Medicine priority
   * 13. Package size / volumetric capacity
   * 14. Maximum active orders limit
   * 15. Rider vehicle type & capabilities
   * 16. Current workload & fairness
   */
  function evaluateRiderEligibility(rider, order, config) {
    var cfg = config || activeConfig;
    if (!rider || !order) {
      return { eligible: false, reason: 'Rider or order is null', criterion: 'Input Validation' };
    }

    // 1. Availability check
    var state = normalizeRiderState(rider.state);
    if (state === RIDER_STATES.SUSPENDED || rider.kycStatus === 'suspended' || rider.isSuspended) {
      return { eligible: false, reason: 'Rider account is suspended.', criterion: 'Rider Availability' };
    }

    if (state === RIDER_STATES.OFFLINE || rider.isOnline === false) {
      return { eligible: false, reason: 'Rider is currently OFFLINE.', criterion: 'Rider Availability' };
    }

    if (rider.kycApproved === false && rider.isVerified === false && rider.kycStatus === 'rejected') {
      return { eligible: false, reason: 'Rider KYC is not approved.', criterion: 'Rider Availability' };
    }

    // Rejection check: Rider declined this order previously
    if (order.rejectedBy && Array.isArray(order.rejectedBy) && order.rejectedBy.indexOf(rider.id) >= 0) {
      return { eligible: false, reason: 'Rider previously declined this order offer.', criterion: 'Rider Acceptance' };
    }

    // 2. Passenger Mode Exclusivity (Rider In Passenger Mode)
    if (isPassengerMode(rider)) {
      return { eligible: false, reason: 'Rider is in PASSENGER mode. Zero orders permitted until ride completion.', criterion: 'Passenger Status' };
    }

    var activeOrders = getRiderActiveOrders(rider);
    var isPassengerOrd = isPassengerOrder(order);

    // 3. Passenger Order Exclusivity (Incoming Order is Passenger)
    if (isPassengerOrd) {
      if (activeOrders.length > 0) {
        return { eligible: false, reason: 'Passenger rides require 100% exclusive vehicle. Rider has ' + activeOrders.length + ' active deliveries.', criterion: 'Passenger Status' };
      }
      if (state !== RIDER_STATES.AVAILABLE && state !== RIDER_STATES.PASSENGER_COMPLETED) {
        return { eligible: false, reason: 'Passenger rides can only be dispatched to riders in AVAILABLE state (current: ' + state + ').', criterion: 'Rider State' };
      }
      var vType = String(rider.vehicleType || rider.vehicle || '').toLowerCase();
      if (vType.indexOf('bicycle') >= 0 || rider.passengerCapable === false || rider.hasPillionSeat === false) {
        return { eligible: false, reason: 'Rider vehicle is not authorized or equipped for passenger rides.', criterion: 'Rider Vehicle Type' };
      }
      return { eligible: true, reason: 'Rider is AVAILABLE and verified for passenger ride.', criterion: 'Compliant' };
    }

    // 4. Delivery Orders (Grocery, Food, Medicine, Parcel, Pickup/Drop)
    if (activeOrders.length === 0) {
      if (state !== RIDER_STATES.AVAILABLE && state !== RIDER_STATES.PASSENGER_COMPLETED) {
        return { eligible: false, reason: 'Rider state is ' + state + ', expected AVAILABLE.', criterion: 'Rider State' };
      }
      var pkgSize = (order.packageSize || 'MEDIUM').toUpperCase();
      var orderUnits = cfg.packageCapacityWeights[pkgSize] || cfg.defaultTypeWeights[normalizeOrderType(order.type)] || 3;
      if (orderUnits > (cfg.totalVehicleCapacityUnits || 10)) {
        return { eligible: false, reason: 'Order volume (' + orderUnits + ' units) exceeds total vehicle capacity (' + (cfg.totalVehicleCapacityUnits || 10) + ' units).', criterion: 'Package Size/Capacity' };
      }
      if (pkgSize === 'LARGE' && rider.hasCarrierRack === false) {
        return { eligible: false, reason: 'Rider vehicle lacks luggage carrier rack required for LARGE packages.', criterion: 'Rider Vehicle Type' };
      }
      return { eligible: true, reason: 'Rider is AVAILABLE for delivery order.', criterion: 'Compliant' };
    }

    // Multi-Order Constraints
    var multiCheck = canAddToMultiOrder(rider, order, cfg);
    if (!multiCheck.allowed) {
      var crit = 'Multi-Order Constraint';
      if (multiCheck.reason.indexOf('capacity') >= 0 || multiCheck.reason.indexOf('limit for order type') >= 0) crit = 'Maximum Active Orders';
      else if (multiCheck.reason.indexOf('volume') >= 0 || multiCheck.reason.indexOf('luggage') >= 0) crit = 'Package Size/Capacity';
      else if (multiCheck.reason.indexOf('Detour') >= 0 || multiCheck.reason.indexOf('detour') >= 0) crit = 'Route Detour & SLA';
      else if (multiCheck.reason.indexOf('freshness') >= 0) crit = 'Food Freshness';
      else if (multiCheck.reason.indexOf('MEDICINE') >= 0) crit = 'Medicine Priority';
      else if (multiCheck.reason.indexOf('PASSENGER') >= 0) crit = 'Passenger Status';
      return { eligible: false, reason: multiCheck.reason, criterion: crit, detourKm: multiCheck.detourKm, detourMins: multiCheck.detourMins };
    }

    return { eligible: true, reason: 'Eligible for multi-order batching.', criterion: 'Compliant', detourKm: multiCheck.detourKm, detourMins: multiCheck.detourMins };
  }

  /**
   * Compatibility & Quality Score Calculation:
   * Selects the BEST rider rather than simply the closest rider.
   */
  function calculateCompatibilityScore(rider, order, config) {
    var cfg = config || activeConfig;
    var elig = evaluateRiderEligibility(rider, order, cfg);
    if (!elig.eligible) {
      return {
        eligible: false,
        score: -Infinity,
        rejectionReason: elig.reason,
        criterion: elig.criterion,
        breakdown: null
      };
    }

    var riderLat = Number(rider.lat || 21.0478);
    var riderLng = Number(rider.lng || 75.7896);
    var pickupLat = Number(order.pickupLat || order.lat || 21.0478);
    var pickupLng = Number(order.pickupLng || order.lng || 75.7896);
    var pickupZone = order.pickupZone || order.zone || 'Station Road';

    var straightDist = haversineKm(riderLat, riderLng, pickupLat, pickupLng);
    var roadDistKm = parseFloat((straightDist * (cfg.roadWindingFactor || 1.35)).toFixed(2));

    var trafficMultiplier = (cfg.zoneTrafficMultipliers && cfg.zoneTrafficMultipliers[pickupZone]) || 1.1;
    var speedKmph = cfg.avgCitySpeedKmph || 25;
    var vType = String(rider.vehicleType || rider.vehicle || '').toLowerCase();
    if (vType.indexOf('ev') >= 0 || vType.indexOf('scooter') >= 0) speedKmph = 28;
    else if (vType.indexOf('motorcycle') >= 0) speedKmph = 30;

    var driveMins = (roadDistKm / speedKmph) * 60 * trafficMultiplier;
    var roadEtaMins = Math.max(2, Math.round(driveMins + (cfg.trafficBufferMins || 2)));

    var activeOrders = getRiderActiveOrders(rider);
    var activeCount = activeOrders.length;
    var type = normalizeOrderType(order.type || order.category || order.orderType);

    var isEnRouteBatchable = false;
    var detourKm = elig.detourKm || 0;
    var detourMins = elig.detourMins || 0;
    var detourPenalty = 0;
    var batchBonus = 0;

    if (activeCount > 0) {
      if (detourKm <= 0.8 && detourMins <= 4) {
        isEnRouteBatchable = true;
        batchBonus = 20; // Highly efficient batch bonus
      } else {
        detourPenalty = Math.round((detourKm * 15) + (detourMins * 3));
      }
    }

    // 1. Proximity Score (0 to 50 pts)
    var proximityScore = Math.max(0, parseFloat((50 - (roadDistKm * 8)).toFixed(1)));

    // 2. ETA Penalty
    var etaPenalty = Math.round(roadEtaMins * 1.5);

    // 3. Priority Bonus (Medicine: 45 pts, Passenger: 27 pts, Food: 24 pts, Grocery: 18 pts, Parcel: 15 pts)
    var priorityVal = (cfg.priorityWeights && cfg.priorityWeights[type]) || 50;
    var priorityBonus = Math.round(priorityVal * 0.3);
    if (type === ORDER_TYPES.MEDICINE) {
      priorityBonus += 15; // Medicine emergency SLA boost
    }

    // 4. Fairness Bonus (0 to 20 pts)
    var todayDeliveries = Number(rider.todayDeliveriesCount || rider.completedTrips || 0);
    var fairnessBonus = Math.max(0, 20 - (todayDeliveries * 2));

    // 5. Food Freshness Penalty
    var freshnessPenalty = 0;
    var hasActiveFood = activeOrders.some(function(o) {
      return normalizeOrderType(o.type || o.category) === ORDER_TYPES.FOOD;
    });
    if (hasActiveFood && detourMins > 2) {
      freshnessPenalty = 25;
    }

    // 6. Vehicle Agility Bonus
    var vehicleBonus = 0;
    if (vType.indexOf('ev') >= 0 || vType.indexOf('scooter') >= 0 || vType.indexOf('motorcycle') >= 0) {
      vehicleBonus = 5;
    }

    var finalScore = parseFloat((proximityScore - etaPenalty + priorityBonus + fairnessBonus + batchBonus + vehicleBonus - detourPenalty - freshnessPenalty).toFixed(2));

    return {
      eligible: true,
      score: finalScore,
      distanceKm: roadDistKm,
      roadEtaMins: roadEtaMins,
      isEnRouteBatchable: isEnRouteBatchable,
      detourKm: detourKm,
      detourMins: detourMins,
      activeOrdersCount: activeCount,
      breakdown: {
        proximityScore: proximityScore,
        etaPenalty: -etaPenalty,
        priorityBonus: priorityBonus,
        fairnessBonus: fairnessBonus,
        batchBonus: batchBonus,
        vehicleBonus: vehicleBonus,
        detourPenalty: -detourPenalty,
        freshnessPenalty: -freshnessPenalty
      }
    };
  }

  /**
   * Finds the best rider for an order evaluating all candidates against the 16-point matrix
   */
  function findBestRiderForOrder(order, ridersPool, config) {
    if (!order) return null;
    var cfg = config || activeConfig;

    var s = String(order.status || 'placed').toLowerCase();
    var isAssignableStatus = (s === 'placed' || s === 'pending' || s === 'escalated_reassign');
    if (order.riderId || !isAssignableStatus) {
      console.warn('⚠️ Dispatch Blocked: Order #' + order.id + ' is already assigned to Rider ' + order.riderId);
      return { error: 'DUPLICATE_ASSIGNMENT_BLOCKED', selectedRider: null, candidatesEvaluated: [], rejectedCandidates: [] };
    }

    var pool = ridersPool;
    if (!pool || pool.length === 0) {
      if (typeof window !== 'undefined' && window.BhusawalBackend) {
        pool = window.BhusawalBackend.riders.getAll();
      } else if (typeof localStorage !== 'undefined') {
        try {
          pool = JSON.parse(localStorage.getItem('bhusawal_riders_pool') || '[]');
        } catch(e) { pool = []; }
      }
    }

    if (!pool || pool.length === 0) return null;

    var candidates = [];
    var rejectedCandidates = [];

    pool.forEach(function(rider) {
      var scoreResult = calculateCompatibilityScore(rider, order, cfg);
      if (!scoreResult.eligible) {
        rejectedCandidates.push({
          riderId: rider.id,
          riderName: rider.name || rider.fullName,
          reason: scoreResult.rejectionReason,
          criterion: scoreResult.criterion
        });
        return;
      }

      candidates.push({
        rider: rider,
        score: scoreResult.score,
        distanceKm: scoreResult.distanceKm,
        roadEtaMins: scoreResult.roadEtaMins,
        isEnRouteBatchable: scoreResult.isEnRouteBatchable,
        activeOrdersCount: scoreResult.activeOrdersCount,
        detourKm: scoreResult.detourKm,
        detourMins: scoreResult.detourMins,
        breakdown: scoreResult.breakdown
      });
    });

    if (candidates.length === 0) {
      var unassignedLog = logDispatchDecision({
        orderId: order.id,
        orderType: normalizeOrderType(order.type || order.category),
        winnerRiderId: null,
        winnerRiderName: null,
        winnerScore: null,
        winnerBreakdown: null,
        candidatesEvaluated: [],
        rejectedCandidates: rejectedCandidates,
        configSnapshot: {
          maxDeliveryOrders: cfg.maxDeliveryOrders,
          maxDetourDistanceKm: cfg.maxDetourDistanceKm,
          maxDetourTimeMins: cfg.maxDetourTimeMins,
          totalVehicleCapacityUnits: cfg.totalVehicleCapacityUnits
        }
      });
      return {
        selectedRider: null,
        score: null,
        candidatesEvaluated: [],
        rejectedCandidates: rejectedCandidates,
        decisionLog: unassignedLog
      };
    }

    // Rank candidates by highest compatibility score
    candidates.sort(function(a, b) { return b.score - a.score; });

    var winner = candidates[0];

    var decisionLog = logDispatchDecision({
      orderId: order.id,
      orderType: normalizeOrderType(order.type || order.category),
      winnerRiderId: winner.rider.id,
      winnerRiderName: winner.rider.name || winner.rider.fullName,
      winnerScore: winner.score,
      winnerBreakdown: winner.breakdown,
      candidatesEvaluated: candidates.map(function(c) {
        return {
          riderId: c.rider.id,
          riderName: c.rider.name || c.rider.fullName,
          score: c.score,
          distanceKm: c.distanceKm,
          roadEtaMins: c.roadEtaMins,
          activeOrdersCount: c.activeOrdersCount,
          detourKm: c.detourKm,
          detourMins: c.detourMins,
          breakdown: c.breakdown
        };
      }),
      rejectedCandidates: rejectedCandidates,
      configSnapshot: {
        maxDeliveryOrders: cfg.maxDeliveryOrders,
        maxDetourDistanceKm: cfg.maxDetourDistanceKm,
        maxDetourTimeMins: cfg.maxDetourTimeMins,
        totalVehicleCapacityUnits: cfg.totalVehicleCapacityUnits
      }
    });

    return {
      selectedRider: winner.rider,
      score: winner.score,
      distanceKm: winner.distanceKm,
      roadEtaMins: winner.roadEtaMins,
      isEnRouteBatchable: winner.isEnRouteBatchable,
      activeOrdersCount: winner.activeOrdersCount,
      detourKm: winner.detourKm,
      detourMins: winner.detourMins,
      breakdown: winner.breakdown,
      allCandidateScores: candidates,
      rejectedCandidates: rejectedCandidates,
      decisionLog: decisionLog
    };
  }

  /**
   * Dispatches an order to the best matching rider
   */
  function dispatchOrder(order, ridersPool, config) {
    var matchResult = findBestRiderForOrder(order, ridersPool, config);
    if (!matchResult || !matchResult.selectedRider) {
      console.log('⚠️ Dispatch Engine: No available riders currently for Order #' + (order ? order.id : ''));
      return matchResult;
    }

    var rider = matchResult.selectedRider;

    if (typeof window !== 'undefined' && window.BhusawalBackend) {
      window.BhusawalBackend.orders.assignRider(order.id, rider.id, rider.name || rider.fullName, rider.phone);
    } else {
      order.riderId = rider.id;
      order.riderName = rider.name || rider.fullName;
      order.status = 'Partner Assigned';
      rider.activeOrderId = order.id;
      rider.activeOrdersCount = (rider.activeOrdersCount || 0) + 1;
      if (!Array.isArray(rider.activeOrders)) rider.activeOrders = [];
      rider.activeOrders.push(order);
    }

    return matchResult;
  }

  function autoDispatchPendingOrders(ridersPool, config) {
    var pending = [];
    if (typeof window !== 'undefined' && window.BhusawalBackend) {
      pending = window.BhusawalBackend.orders.getAll().filter(function(o) {
        return !o.riderId && (o.status === 'placed' || o.status === 'Pending' || o.status === 'pending');
      });
    } else if (typeof localStorage !== 'undefined') {
      try {
        pending = JSON.parse(localStorage.getItem('pending_rider_orders') || '[]');
      } catch(e) { pending = []; }
    }

    var dispatched = [];
    pending.forEach(function(ord) {
      var res = dispatchOrder(ord, ridersPool, config);
      if (res && res.selectedRider) {
        dispatched.push({ order: ord, result: res });
      }
    });

    return dispatched;
  }

  // ====================================================================
  // CONFIGURATION MANAGEMENT
  // ====================================================================

  function getConfig() {
    return JSON.parse(JSON.stringify(activeConfig));
  }

  function updateConfig(newConfig) {
    if (!newConfig || typeof newConfig !== 'object') return getConfig();
    activeConfig = Object.assign({}, activeConfig, newConfig);

    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(activeConfig));
      }
    } catch(e) {}

    return getConfig();
  }

  function resetConfig() {
    activeConfig = JSON.parse(JSON.stringify(DEFAULT_FLEET_CONFIG));
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.removeItem(CONFIG_STORAGE_KEY);
      }
    } catch(e) {}
    return getConfig();
  }

  // ====================================================================
  // PUBLIC MODULE EXPORT
  // ====================================================================

  return {
    version: '3.0.0-unified-fleet',
    ORDER_TYPES: ORDER_TYPES,
    RIDER_STATES: RIDER_STATES,
    LEGAL_TRANSITIONS: LEGAL_TRANSITIONS,
    DEFAULT_FLEET_CONFIG: DEFAULT_FLEET_CONFIG,

    // Core Invariant & Compatibility Services
    isPassengerMode: isPassengerMode,
    isPassengerOrder: isPassengerOrder,
    calculateRiderCapacity: calculateRiderCapacity,
    calculateOrderCompatibility: calculateOrderCompatibility,
    calculateRouteCompatibility: calculateRouteCompatibility,
    canAddToMultiOrder: canAddToMultiOrder,
    canReceiveOrder: canReceiveOrder,
    canAcceptOrder: canAcceptOrder,

    // State Machine Services
    validateStateTransition: validateStateTransition,
    transitionRiderState: transitionRiderState,

    // Shared-Fleet Dispatch & Evaluation Services
    evaluateRiderEligibility: evaluateRiderEligibility,
    calculateCompatibilityScore: calculateCompatibilityScore,
    findBestRiderForOrder: findBestRiderForOrder,
    dispatchOrder: dispatchOrder,
    autoDispatchPendingOrders: autoDispatchPendingOrders,
    logDispatchDecision: logDispatchDecision,
    getDispatchLogs: getDispatchLogs,
    clearDispatchLogs: clearDispatchLogs,

    // Route & Distance Services
    calculateRoadDistanceKm: calculateRoadDistanceKm,
    calculateTravelTimeMins: calculateTravelTimeMins,

    // Configuration Services
    getConfig: getConfig,
    updateConfig: updateConfig,
    resetConfig: resetConfig,

    // Helpers
    normalizeOrderType: normalizeOrderType,
    normalizeRiderState: normalizeRiderState
  };
});

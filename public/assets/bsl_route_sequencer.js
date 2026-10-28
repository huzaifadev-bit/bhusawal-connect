/**
 * ====================================================================
 * BSL CONNECT — INTELLIGENT ROUTE SEQUENCER & ACTIVE MULTI-ORDER ENGINE
 * ====================================================================
 * 
 * Optimal Route Sequencing & Next Action Determination for BSL Riders.
 * 
 * Intelligently recommends the NEXT ACTION based on:
 * - Current Rider GPS & Distance
 * - Pickup locations & Customer drop locations
 * - Precedence constraints (Pickup MUST precede Drop)
 * - Medicine Emergency Urgency (strictest SLA: 20m)
 * - Food Freshness Constraints (hot meal cooling timer once picked up)
 * - Delivery deadlines & SLA conformance
 * - Route detour and travel time minimization
 * 
 * Invariants Enforced:
 * - NEVER sorts simply by shortest distance.
 * - Passenger rides are 100% exclusive; never sequenced with delivery orders.
 * - Precedence constraint: An order's Drop stop can NEVER appear before its Pickup stop.
 */

(function(root, factory) {
  var engine = factory();
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = engine;
  }
  if (typeof root !== 'undefined') {
    root.BslRouteSequencer = engine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BslRouteSequencer = engine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function() {
  'use strict';

  var BHUSAWAL_CENTER = [21.0478, 75.7896];
  var ROAD_WINDING_FACTOR = 1.35;
  var AVG_SPEED_KMPH = 25;

  // 1. DISTANCE & TRAVEL TIME HELPERS
  function haversineKm(lat1, lon1, lat2, lon2) {
    if (lat1 === undefined || lon1 === undefined || lat2 === undefined || lon2 === undefined) return 2.0;
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function calculateRoadDistanceKm(lat1, lon1, lat2, lon2) {
    return parseFloat((haversineKm(lat1, lon1, lat2, lon2) * ROAD_WINDING_FACTOR).toFixed(2));
  }

  function calculateTravelTimeMins(distKm) {
    return Math.max(2, Math.round((distKm / AVG_SPEED_KMPH) * 60 + 2)); // 2 min traffic buffer
  }

  // 2. UNVISITED STOPS EXTRACTOR
  /**
   * Builds the set of remaining stops that must be completed.
   * If an order is already PICKED_UP or DELIVERING, its PICKUP stop is skipped.
   */
  function buildUnvisitedStops(activeOrders) {
    if (!Array.isArray(activeOrders) || activeOrders.length === 0) return [];

    var stops = [];

    activeOrders.forEach(function(ord) {
      var ordId = ord.id || ord.orderId;
      var type = (ord.type || ord.category || 'GROCERY').toUpperCase();
      var st = (ord.status || 'GOING_TO_PICKUP').toUpperCase();

      if (st === 'COMPLETED' || st === 'DELIVERED') return;

      var isPickedUp = (st === 'PICKED_UP' || st === 'DELIVERING' || st === 'ON_THE_WAY');

      // A. Pickup Stop (only if not yet picked up)
      if (!isPickedUp) {
        stops.push({
          id: ordId + '_PICKUP',
          orderId: ordId,
          stopType: 'PICKUP',
          label: 'Pickup: ' + (ord.pickupAddress || ord.store || 'Store'),
          address: ord.pickupAddress || ord.store || 'Store',
          lat: Number(ord.pickupLat || ord.lat || BHUSAWAL_CENTER[0]),
          lng: Number(ord.pickupLng || ord.lng || BHUSAWAL_CENTER[1]),
          orderType: type,
          status: st,
          priority: ord.priority || (type === 'MEDICINE' ? 'CRITICAL' : (type === 'FOOD' ? 'HIGH_FRESHNESS' : 'STANDARD')),
          payout: Number(ord.payout || ord.deliveryFee || 45),
          order: ord
        });
      }

      // B. Drop Stop
      stops.push({
        id: ordId + '_DROP',
        orderId: ordId,
        stopType: 'DROP',
        label: 'Drop: ' + (ord.dropAddress || ord.address || 'Customer Drop'),
        address: ord.dropAddress || ord.address || 'Customer Drop',
        lat: Number(ord.dropLat || 21.0425),
        lng: Number(ord.dropLng || 75.7980),
        orderType: type,
        status: isPickedUp ? 'IN_TRANSIT' : 'WAITING_PICKUP',
        priority: ord.priority || (type === 'MEDICINE' ? 'CRITICAL' : (type === 'FOOD' ? 'HIGH_FRESHNESS' : 'STANDARD')),
        payout: Number(ord.payout || ord.deliveryFee || 45),
        customerName: ord.customerName || ord.receiverName || 'Customer',
        customerPhone: ord.customerPhone || ord.receiverPhone || '9876543210',
        order: ord
      });
    });

    return stops;
  }

  // 3. TOPOLOGICAL VALID PERMUTATIONS GENERATOR
  /**
   * Generates all permutations of stops that satisfy precedence:
   * For every order, its PICKUP stop MUST appear before its DROP stop.
   */
  function generateValidPermutations(stops) {
    if (stops.length <= 1) return [stops];

    var results = [];

    function permute(currentSeq, remaining) {
      if (remaining.length === 0) {
        results.push(currentSeq);
        return;
      }

      for (var i = 0; i < remaining.length; i++) {
        var candidate = remaining[i];

        // Precedence check: if candidate is a DROP, its PICKUP must already be in currentSeq or already completed
        if (candidate.stopType === 'DROP') {
          var pickupNeeded = candidate.orderId + '_PICKUP';
          var hasPickupInRemaining = remaining.some(function(s) { return s.id === pickupNeeded; });
          if (hasPickupInRemaining) {
            // Cannot visit Drop before Pickup!
            continue;
          }
        }

        var nextSeq = currentSeq.concat([candidate]);
        var nextRemaining = remaining.slice(0, i).concat(remaining.slice(i + 1));
        permute(nextSeq, nextRemaining);
      }
    }

    permute([], stops);
    return results;
  }

  // 4. MULTI-CRITERIA COST SCORING FUNCTION
  /**
   * Evaluates the cost of a sequence of stops.
   * Minimizes:
   * - Total travel distance & time
   * - Customer delay
   * - Food freshness loss (holding picked-up hot food while making more stops)
   * - Medicine delay penalty (urgent health SLA)
   * - Out-of-the-way backtracking
   */
  function scoreSequence(riderPos, sequence) {
    var curLat = riderPos.lat;
    var curLng = riderPos.lng;

    var totalDistKm = 0;
    var cumulativeMins = 0;
    var penaltyScore = 0;

    for (var i = 0; i < sequence.length; i++) {
      var stop = sequence[i];
      var legDist = calculateRoadDistanceKm(curLat, curLng, stop.lat, stop.lng);
      var legTime = calculateTravelTimeMins(legDist);

      totalDistKm += legDist;
      cumulativeMins += legTime;

      // RULE A: MEDICINE URGENCY PENALTY
      // Medicine has the strictest SLA (20 min). If medicine drop is delayed, apply heavy penalty.
      if (stop.orderType === 'MEDICINE' && stop.stopType === 'DROP') {
        if (cumulativeMins > 20) {
          penaltyScore += (cumulativeMins - 20) * 80; // Heavy SLA overshoot penalty
        } else {
          // Bonus for delivering medicine early
          penaltyScore -= (20 - cumulativeMins) * 15;
        }
      }

      // RULE B: FOOD FRESHNESS PENALTY
      // Once food is picked up, hot meals cool rapidly.
      // If food drop is pushed behind other pickup stops, penalize heavily.
      if (stop.orderType === 'FOOD' && stop.stopType === 'DROP') {
        var foodAlreadyPickedUp = (stop.order.status === 'PICKED_UP' || stop.order.status === 'DELIVERING');
        if (foodAlreadyPickedUp) {
          // Food is already on the bike! Every additional minute costs freshness.
          penaltyScore += cumulativeMins * 45;
        } else {
          // If picked up in this sequence, penalize excessive transit time
          if (cumulativeMins > 25) {
            penaltyScore += (cumulativeMins - 25) * 50;
          }
        }
      }

      // RULE C: STANDARD ORDER DEADLINE PENALTY
      if (cumulativeMins > 35) {
        penaltyScore += (cumulativeMins - 35) * 20;
      }

      curLat = stop.lat;
      curLng = stop.lng;
    }

    // Total cost formula:
    // Distance cost (weight: 15) + Time cost (weight: 10) + SLA/Freshness penalties
    var totalCost = (totalDistKm * 15) + (cumulativeMins * 10) + penaltyScore;

    return {
      cost: totalCost,
      totalDistKm: parseFloat(totalDistKm.toFixed(2)),
      totalTimeMins: cumulativeMins
    };
  }

  // 5. OPTIMAL ROUTE SEQUENCING CONTROLLER
  /**
   * Computes the optimal sequence of stops for active orders and determines the immediate NEXT ACTION.
   */
  function computeOptimalRoute(arg1, arg2) {
    var rider = Array.isArray(arg1) ? arg2 : arg1;
    var activeOrders = Array.isArray(arg1) ? arg1 : arg2;
    if (!Array.isArray(activeOrders) || activeOrders.length === 0) {
      return {
        stops: [],
        route: [],
        nextAction: null,
        totalDistanceKm: 0,
        totalTimeMins: 0,
        totalEarnings: 0,
        allOrdersCompleted: true
      };
    }

    // Enforce Passenger Rule: If on a passenger ride, return passenger next action exclusively
    if (rider && (rider.state === 'PASSENGER_PICKUP' || rider.state === 'PASSENGER_ACTIVE' || rider.isPassengerLocked)) {
      var passOrder = activeOrders[0] || {};
      var isBoarded = rider.state === 'PASSENGER_ACTIVE';
      var passStops = [{
        id: 'PASS_STOP',
        orderId: passOrder.id || 'RIDE',
        stopType: isBoarded ? 'DROP' : 'PICKUP',
        label: isBoarded ? ('Drop Passenger: ' + (passOrder.dropAddress || 'Destination')) : ('Pickup Passenger: ' + (passOrder.pickupAddress || 'Pickup Point')),
        orderType: 'PASSENGER',
        status: isBoarded ? 'TRIP_ACTIVE' : 'GOING_TO_PASSENGER',
        payout: Number(passOrder.fare || 55)
      }];

      return {
        isPassengerExclusive: true,
        stops: passStops,
        route: passStops,
        nextAction: {
          title: isBoarded ? 'Drop Passenger at Destination' : 'Go to Passenger Pickup',
          subtext: isBoarded ? (passOrder.dropAddress || 'Jamner Road Square') : (passOrder.pickupAddress || 'Bhusawal Railway Station'),
          stopType: isBoarded ? 'DROP' : 'PICKUP',
          orderId: passOrder.id || 'RIDE',
          orderType: 'PASSENGER',
          actionLabel: isBoarded ? 'End Trip & Collect Fare' : 'Verify Boarding OTP',
          actionBtnText: isBoarded ? 'End Trip & Collect Fare' : 'Verify Boarding OTP',
          lat: isBoarded ? 21.0410 : 21.0495,
          lng: isBoarded ? 75.7920 : 75.7870,
          navUrl: 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(isBoarded ? (passOrder.dropAddress || 'Jamner Road Square') : (passOrder.pickupAddress || 'Bhusawal Railway Station'))
        },
        totalDistanceKm: 3.8,
        totalTimeMins: 12,
        totalEarnings: Number(passOrder.fare || 55),
        allOrdersCompleted: false
      };
    }

    var stops = buildUnvisitedStops(activeOrders);
    if (stops.length === 0) {
      return {
        stops: [],
        route: [],
        nextAction: null,
        totalDistanceKm: 0,
        totalTimeMins: 0,
        totalEarnings: 0,
        allOrdersCompleted: true
      };
    }

    var riderPos = {
      lat: Number((rider && rider.lat) || BHUSAWAL_CENTER[0]),
      lng: Number((rider && rider.lng) || BHUSAWAL_CENTER[1])
    };

    var validPermutations = generateValidPermutations(stops);

    // Evaluate each valid sequence with the multi-criteria cost scoring function
    var bestSequence = validPermutations[0];
    var bestEvaluation = scoreSequence(riderPos, bestSequence);

    for (var i = 1; i < validPermutations.length; i++) {
      var seq = validPermutations[i];
      var evalResult = scoreSequence(riderPos, seq);
      if (evalResult.cost < bestEvaluation.cost) {
        bestSequence = seq;
        bestEvaluation = evalResult;
      }
    }

    // Determine the immediate NEXT ACTION from the first stop in optimal sequence
    var firstStop = bestSequence[0];
    var nextAction = null;

    if (firstStop) {
      var isPickup = firstStop.stopType === 'PICKUP';
      var title = isPickup
        ? ('Go to ' + (firstStop.order.pickupAddress || firstStop.order.store || 'Store'))
        : ('Deliver ' + firstStop.orderType.toLowerCase() + ' #' + firstStop.orderId);

      var subtext = isPickup
        ? ('Pickup ' + firstStop.orderType + ' #' + firstStop.orderId + ' • ' + (firstStop.order.store || firstStop.address))
        : ('Customer Drop: ' + (firstStop.order.dropAddress || firstStop.address) + ' (' + (firstStop.customerName || 'Customer') + ')');

      var actionLabel = isPickup ? 'Confirm Pickup' : 'Complete Delivery';

      var navTarget = encodeURIComponent(firstStop.address + ', Bhusawal');
      var navUrl = 'https://www.google.com/maps/dir/?api=1&destination=' + navTarget + '&travelmode=driving';

      nextAction = {
        title: title,
        subtext: subtext,
        stopType: firstStop.stopType,
        orderId: firstStop.orderId,
        orderType: firstStop.orderType,
        actionLabel: actionLabel,
        actionBtnText: actionLabel,
        lat: firstStop.lat,
        lng: firstStop.lng,
        address: firstStop.address,
        payout: firstStop.payout,
        navUrl: navUrl,
        stop: firstStop
      };
    }

    var totalEarnings = activeOrders.reduce(function(sum, o) {
      return sum + Number(o.payout || o.deliveryFee || o.fare || 45);
    }, 0);

    return {
      stops: bestSequence,
      route: bestSequence,
      nextAction: nextAction,
      totalDistanceKm: bestEvaluation.totalDistKm,
      totalTimeMins: bestEvaluation.totalTimeMins,
      totalEarnings: totalEarnings,
      allOrdersCompleted: false
    };
  }

  // 6. STOP PROGRESSION HANDLER
  /**
   * Advances the status of the current active stop.
   * If PICKUP is completed -> order enters PICKED_UP.
   * If DROP is completed -> order enters COMPLETED and payout is credited.
   */
  function advanceStop(activeOrders, stopToAdvance) {
    if (!Array.isArray(activeOrders) || !stopToAdvance) return activeOrders;

    var updated = [];

    activeOrders.forEach(function(ord) {
      var ordId = ord.id || ord.orderId;
      if (ordId === stopToAdvance.orderId) {
        if (stopToAdvance.stopType === 'PICKUP') {
          // Transition to PICKED_UP
          ord.status = 'PICKED_UP';
          ord.pickedUpAt = new Date().toISOString();
          updated.push(ord);
        } else {
          // DROP completed -> Order delivered
          ord.status = 'COMPLETED';
          ord.deliveredAt = new Date().toISOString();
          // Do not push into updated active orders list (order finished!)
        }
      } else {
        updated.push(ord);
      }
    });

    return updated;
  }

  /**
   * 7. getNextAction(arg1, arg2)
   * Quick convenience method to determine immediate next action
   */
  function getNextAction(arg1, arg2) {
    var routeRes = computeOptimalRoute(arg1, arg2);
    if (!routeRes || !routeRes.nextAction) return null;
    return routeRes.nextAction;
  }

  return {
    haversineKm: haversineKm,
    calculateRoadDistanceKm: calculateRoadDistanceKm,
    calculateTravelTimeMins: calculateTravelTimeMins,
    buildUnvisitedStops: buildUnvisitedStops,
    generateValidPermutations: generateValidPermutations,
    scoreSequence: scoreSequence,
    computeOptimalRoute: computeOptimalRoute,
    getNextAction: getNextAction,
    advanceStop: advanceStop
  };
});

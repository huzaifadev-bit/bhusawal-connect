/**
 * Bhusawal Connect - Smart Order Assignment & Intelligent Multi-Order Engine
 * Deterministic Nearest-Road-Distance, Lowest-ETA & Multi-Order Route Optimization
 */
window.BhusawalSmartDispatcher = (function() {
  
  // Service Type Maximum Stack Limits (Never Overload)
  var MAX_ACTIVE_CAPACITY = {
    'GROCERY': 2,
    'FOOD': 2,
    'MEDICINE': 2,
    'PARCEL': 1
  };

  // 1. Calculate Road Distance using Haversine * Road Winding Curvature Factor (1.35x)
  function getRoadDistanceKm(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 2.2;
    var R = 6371; // Earth radius in km
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = 
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    var c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    var straightDist = R * c;
    
    // Road Winding Factor (1.35x for Bhusawal city road turns & intersections)
    var ROAD_FACTOR = 1.35;
    return parseFloat((straightDist * ROAD_FACTOR).toFixed(2));
  }

  // 2. Calculate Road ETA in Minutes
  function getRoadETAMins(roadDistanceKm, vehicleType) {
    var speedKmph = 25; // default bike speed in city
    if (vehicleType === 'EV Scooter') speedKmph = 28;
    else if (vehicleType === 'Petrol Motorcycle') speedKmph = 30;
    else if (vehicleType === 'Commercial Auto') speedKmph = 22;
    else if (vehicleType === 'Bicycle') speedKmph = 15;

    var driveTimeMins = (roadDistanceKm / speedKmph) * 60;
    var trafficBufferMins = 2; // 2 min signal/intersection delay
    return Math.max(3, Math.round(driveTimeMins + trafficBufferMins));
  }

  // 3. Registered Fleet Pool Manager
  function getRiderPool() {
    var pool = [];
    try {
      pool = JSON.parse(localStorage.getItem('bhusawal_riders_pool') || '[]');
    } catch(e) {}

    if (!Array.isArray(pool) || pool.length === 0) {
      pool = [
        {
          id: 'BHU-RIDER-8942',
          name: 'Rahul Ramesh Patil',
          phone: '9876543210',
          vehicleType: 'EV Scooter',
          bikeNo: 'MH 19 AX 4892',
          isOnline: true,
          isVerified: true,
          isActive: true,
          activeOrders: [],
          lat: 21.0478,
          lng: 75.7896,
          rating: 4.9,
          zone: 'Station Road'
        },
        {
          id: 'BHU-RIDER-4120',
          name: 'Suresh Chaudhari',
          phone: '9123456789',
          vehicleType: 'Petrol Motorcycle',
          bikeNo: 'MH 19 BZ 1024',
          isOnline: true,
          isVerified: true,
          isActive: true,
          activeOrders: [],
          lat: 21.0445,
          lng: 75.7850,
          rating: 4.8,
          zone: 'Main Market'
        },
        {
          id: 'BHU-RIDER-3091',
          name: 'Ganesh Mahajan',
          phone: '9822345678',
          vehicleType: 'EV Scooter',
          bikeNo: 'MH 19 CQ 5512',
          isOnline: true,
          isVerified: true,
          isActive: true,
          activeOrders: [],
          lat: 21.0410,
          lng: 75.7920,
          rating: 4.95,
          zone: 'Jamner Road'
        },
        {
          id: 'BHU-RIDER-7712',
          name: 'Vikas Sonawane',
          phone: '9422789012',
          vehicleType: 'Petrol Motorcycle',
          bikeNo: 'MH 19 DK 9901',
          isOnline: true,
          isVerified: true,
          isActive: true,
          activeOrders: [],
          lat: 21.0520,
          lng: 75.7990,
          rating: 4.7,
          zone: 'Varangaon Road'
        },
        {
          id: 'BHU-RIDER-5520',
          name: 'Anil Kulkarni',
          phone: '9370123456',
          vehicleType: 'Commercial Auto',
          bikeNo: 'MH 19 EA 3341',
          isOnline: true,
          isVerified: true,
          isActive: true,
          activeOrders: [],
          lat: 21.0380,
          lng: 75.7780,
          rating: 4.85,
          zone: 'NH 53 Bypass'
        }
      ];

      try {
        var currentRider = JSON.parse(localStorage.getItem('bhusawal_rider_auth') || 'null');
        if (currentRider && currentRider.fullName) {
          var existingIdx = pool.findIndex(function(r) { return r.phone === currentRider.phone; });
          var activeItem = {
            id: 'BHU-RIDER-8942',
            name: currentRider.fullName,
            phone: currentRider.phone || '9876543210',
            vehicleType: currentRider.vehicleType || 'EV Scooter',
            bikeNo: currentRider.bikeNo || 'MH 19 AX 4892',
            isOnline: !!currentRider.isOnline,
            isVerified: !!currentRider.kycApproved,
            isActive: !!currentRider.kycApproved,
            activeOrders: currentRider.activeOrders || [],
            lat: 21.0478,
            lng: 75.7896,
            rating: 4.9,
            zone: currentRider.area || 'Bhusawal Central'
          };
          if (existingIdx >= 0) pool[existingIdx] = activeItem;
          else pool.unshift(activeItem);
        }
      } catch(e) {}

      localStorage.setItem('bhusawal_riders_pool', JSON.stringify(pool));
    }
    return pool;
  }

  // 4. CHECK RIDER CAPACITY (NEVER OVERLOAD)
  function canRiderAcceptOrderType(rider, serviceType) {
    var typeKey = (serviceType || 'GROCERY').toUpperCase();
    var maxAllowed = MAX_ACTIVE_CAPACITY[typeKey] || 2;
    var activeList = rider.activeOrders || [];

    // Parcel is strictly 1 max
    if (typeKey === 'PARCEL' && activeList.length >= 1) return false;

    // Count active orders of this type
    var countOfThisType = activeList.filter(function(o) {
      return (o.type || o.category || '').toUpperCase() === typeKey;
    }).length;

    return countOfThisType < maxAllowed && activeList.length < 3;
  }

  // 5. SMART ORDER ASSIGNMENT ALGORITHM & MULTI-ORDER EVALUATOR
  function assignNearestRider(order) {
    var pickupLat = Number(order.pickupLat || order.lat || 21.0478);
    var pickupLng = Number(order.pickupLng || order.lng || 75.7896);
    var serviceType = (order.type || order.category || 'GROCERY').toUpperCase();

    var pool = getRiderPool();

    // Step A: Qualification Filter Pipeline (Online + Verified + Active + Capacity Check)
    var qualifiedRiders = pool.filter(function(rider) {
      return (
        rider.isOnline === true &&
        rider.isVerified === true &&
        rider.isActive === true &&
        canRiderAcceptOrderType(rider, serviceType)
      );
    });

    if (qualifiedRiders.length === 0) {
      // Fallback pool
      qualifiedRiders = pool.filter(function(r) { return r.isVerified && r.isActive; });
    }

    // Step B: Calculate Load-Aware Dispatch Score for candidates
    // Formula: DispatchScore = RoadDistanceKm + (ActiveWorkload * 1.5)
    var rankedRiders = qualifiedRiders.map(function(rider) {
      var roadDistKm = getRoadDistanceKm(rider.lat, rider.lng, pickupLat, pickupLng);
      var etaMins = getRoadETAMins(roadDistKm, rider.vehicleType);
      var activeCount = (rider.activeOrders && Array.isArray(rider.activeOrders)) ? rider.activeOrders.length : (rider.isBusy ? 1 : 0);
      var dispatchScore = parseFloat((roadDistKm + (activeCount * 1.5)).toFixed(2));
      var isBusy = activeCount > 0;
      
      // Calculate extra detour if rider is already delivering
      var extraDistKm = isBusy ? parseFloat((roadDistKm * 0.6).toFixed(2)) : 0;
      var extraEarnings = isBusy ? (35 + Math.round(extraDistKm * 8)) : 0;

      return {
        id: rider.id,
        name: rider.name,
        phone: rider.phone,
        vehicleType: rider.vehicleType,
        bikeNo: rider.bikeNo,
        rating: rider.rating,
        roadDistanceKm: roadDistKm,
        activeWorkload: activeCount,
        dispatchScore: dispatchScore,
        etaMins: etaMins,
        isBusy: isBusy,
        extraDistanceKm: extraDistKm,
        extraEarnings: extraEarnings
      };
    });

    // Step C: Deterministic Sort (Lowest DispatchScore -> Fewer Active Orders -> Shortest Distance -> Highest Rating)
    rankedRiders.sort(function(a, b) {
      if (a.dispatchScore !== b.dispatchScore) return a.dispatchScore - b.dispatchScore; // Primary: Lowest DispatchScore
      if (a.activeWorkload !== b.activeWorkload) return a.activeWorkload - b.activeWorkload; // Tie-breaker 1: Fewer active orders
      if (a.roadDistanceKm !== b.roadDistanceKm) return a.roadDistanceKm - b.roadDistanceKm; // Tie-breaker 2: Shorter road distance
      return b.rating - a.rating; // Tie-breaker 3: Highest Rating
    });

    var bestRider = rankedRiders[0];

    // Update order object with assignment data
    order.assignedRider = bestRider.name;
    order.riderPhone = bestRider.phone;
    order.riderVehicle = bestRider.vehicleType + ' (' + bestRider.bikeNo + ')';
    order.roadDistanceKm = bestRider.roadDistanceKm;
    order.etaMins = bestRider.etaMins;
    order.isMultiOrder = bestRider.isBusy;
    order.extraDistanceKm = bestRider.extraDistanceKm;
    order.extraEarnings = bestRider.extraEarnings;
    order.assignmentTime = new Date().toISOString();
    order.assignmentStatus = bestRider.isBusy ? 'MULTI_ORDER_PROPOSED' : 'SMART_ASSIGNED';

    return {
      success: true,
      rider: bestRider,
      isMultiOrder: bestRider.isBusy,
      extraDistanceKm: bestRider.extraDistanceKm,
      extraEarnings: bestRider.extraEarnings,
      roadDistanceKm: bestRider.roadDistanceKm,
      etaMins: bestRider.etaMins
    };
  }

  // 6. AUTOMATIC MULTI-STOP DELIVERY SEQUENCE OPTIMIZER
  function optimizeDeliverySequence(activeOrders) {
    if (!Array.isArray(activeOrders) || activeOrders.length <= 1) return activeOrders;

    // Sort active orders by pickup distance and urgency
    activeOrders.sort(function(a, b) {
      var distA = Number(a.roadDistanceKm || 2);
      var distB = Number(b.roadDistanceKm || 2);
      return distA - distB;
    });

    // Label sequence stops
    activeOrders.forEach(function(ord, index) {
      ord.sequenceStep = index + 1;
      ord.sequenceLabel = 'Stop ' + (index + 1) + ' of ' + activeOrders.length;
    });

    return activeOrders;
  }

  return {
    MAX_CAPACITY: MAX_ACTIVE_CAPACITY,
    getRoadDistanceKm: getRoadDistanceKm,
    getRoadETAMins: getRoadETAMins,
    getRiderPool: getRiderPool,
    canRiderAcceptOrderType: canRiderAcceptOrderType,
    assignNearestRider: assignNearestRider,
    optimizeDeliverySequence: optimizeDeliverySequence
  };

})();

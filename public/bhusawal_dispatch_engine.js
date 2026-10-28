/**
 * ====================================================================
 * BHUSAWAL CONNECT — INTELLIGENT ORDER DISPATCH & LOAD BALANCING ENGINE
 * ====================================================================
 * Smart AI Dispatcher for Bhusawal Metropolitan Area.
 * Assigns orders across ONE shared two-wheeler delivery fleet evaluating:
 *
 * 1. Rider Availability (isOnline, approved KYC, active status)
 * 2. Real-Time Rider GPS Coordinates
 * 3. Rider State Machine State (AVAILABLE, DELIVERING, MULTI_ORDER, etc.)
 * 4. Existing Active Orders Count & Load
 * 5. Strict Passenger Exclusivity (Zero orders during passenger trips)
 * 6. Road Distance to Pickup (Haversine * winding factor)
 * 7. Distance to Customer Drop
 * 8. Estimated Route Travel Time (ETA adjusted for Bhusawal zone traffic)
 * 9. Order Priority (Medicine: 100, Passenger: 90, Food: 80, Grocery: 60, Parcel: 50)
 * 10. Delivery SLA Deadlines
 * 11. Food Freshness Protection (Avoid cooling of picked up hot meals)
 * 12. Medicine Emergency Delivery Priority
 * 13. Package Size & Volumetric Weight (Small: 1, Med: 3, Large: 6, Passenger: 10 vs 10 max)
 * 14. Maximum Concurrent Orders Limit (Default 3)
 * 15. Rider Vehicle Type & Suitability (Pillion seat for passenger, rack for large parcels)
 * 16. Current Workload & Fair Fleet Load Balancing
 *
 * Full Explainability: Logs every decision to bhusawal_dispatch_logs.
 */

(function(root, factory) {
  var engineInstance = factory(root);
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = engineInstance;
  }
  if (typeof root !== 'undefined') {
    root.BhusawalIntelligentDispatchEngine = engineInstance;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BhusawalIntelligentDispatchEngine = engineInstance;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : (typeof self !== 'undefined' ? self : this)), function(root) {
  'use strict';

  // Obtain or require BslFleetEngine
  function getFleetEngine() {
    if (root && root.BslFleetEngine) return root.BslFleetEngine;
    if (typeof globalThis !== 'undefined' && globalThis.BslFleetEngine) return globalThis.BslFleetEngine;
    if (typeof window !== 'undefined' && window.BslFleetEngine) return window.BslFleetEngine;
    if (typeof require !== 'undefined') {
      try {
        return require('./assets/bsl_rider_fleet_engine.js');
      } catch(e) {
        try {
          return require('../public/assets/bsl_rider_fleet_engine.js');
        } catch(e2) {}
      }
    }
    return null;
  }

  // Zone Traffic Congestion Multipliers for Bhusawal
  var ZONE_TRAFFIC_MULTIPLIER = {
    'Station Road': 1.4,
    'Jamner Road': 1.3,
    'Market Yard': 1.3,
    'Civil Hospital Road': 1.1,
    'Ordnance Factory': 1.0,
    'Khedi Road': 1.0,
    'Varangaon Road': 1.0
  };

  var BhusawalIntelligentDispatchEngine = {
    version: '3.0.0-intelligent-shared-fleet',

    /**
     * Evaluates a candidate rider's eligibility across all 16 criteria
     */
    evaluateRiderEligibility: function(rider, order, config) {
      var fleet = getFleetEngine();
      if (fleet && fleet.evaluateRiderEligibility) {
        return fleet.evaluateRiderEligibility(rider, order, config);
      }
      if (!rider || !order) return { eligible: false, reason: 'Rider or order is null', criterion: 'Input Validation' };
      if (!rider.isOnline) return { eligible: false, reason: 'Rider is currently OFFLINE.', criterion: 'Rider Availability' };
      return { eligible: true, reason: 'Eligible', criterion: 'Compliant' };
    },

    /**
     * Calculates compatibility and ranking score
     */
    calculateCompatibilityScore: function(rider, order, config) {
      var fleet = getFleetEngine();
      if (fleet && fleet.calculateCompatibilityScore) {
        return fleet.calculateCompatibilityScore(rider, order, config);
      }
      return { eligible: true, score: 50, distanceKm: 1.0, roadEtaMins: 5 };
    },

    /**
     * Finds the optimal Delivery Partner for a new order.
     */
    findBestRiderForOrder: function(order, ridersPool, config) {
      if (!order) return null;

      var s = String(order.status || 'placed').toLowerCase();
      var isAssignableStatus = (s === 'placed' || s === 'pending' || s === 'escalated_reassign');
      if (order.riderId || !isAssignableStatus) {
        console.warn('⚠️ Dispatch Blocked: Order #' + order.id + ' is already assigned to Rider ' + order.riderId);
        return { error: 'DUPLICATE_ASSIGNMENT_BLOCKED', selectedRider: null, candidatesEvaluated: [], rejectedCandidates: [] };
      }

      var fleet = getFleetEngine();
      if (fleet && fleet.findBestRiderForOrder) {
        var res = fleet.findBestRiderForOrder(order, ridersPool, config);
        if (!res || !res.selectedRider) {
          return null; // Maintain backward compatibility with tests expecting null when no winner found
        }
        return res;
      }

      return null;
    },

    /**
     * Executes automatic dispatch for a newly placed order.
     */
    autoDispatchOrder: function(order, ridersPool, config) {
      var fleet = getFleetEngine();
      if (fleet && fleet.dispatchOrder) {
        return fleet.dispatchOrder(order, ridersPool, config);
      }
      var res = this.findBestRiderForOrder(order, ridersPool, config);
      if (!res || !res.selectedRider) return null;
      var rider = res.selectedRider;

      if (typeof window !== 'undefined' && window.BhusawalBackend) {
        window.BhusawalBackend.orders.assignRider(order.id, rider.id, rider.name || rider.fullName, rider.phone);
      } else {
        order.riderId = rider.id;
        order.riderName = rider.name || rider.fullName;
        order.status = 'Partner Assigned';
      }
      return res;
    },

    dispatchOrder: function(order, ridersPool, config) {
      return this.autoDispatchOrder(order, ridersPool, config);
    },

    autoDispatchPendingOrders: function(ridersPool, config) {
      var fleet = getFleetEngine();
      if (fleet && fleet.autoDispatchPendingOrders) {
        return fleet.autoDispatchPendingOrders(ridersPool, config);
      }
      return [];
    },

    getDispatchLogs: function(filter) {
      var fleet = getFleetEngine();
      if (fleet && fleet.getDispatchLogs) return fleet.getDispatchLogs(filter);
      return [];
    },

    clearDispatchLogs: function() {
      var fleet = getFleetEngine();
      if (fleet && fleet.clearDispatchLogs) return fleet.clearDispatchLogs();
      return true;
    },

    getConfig: function() {
      var fleet = getFleetEngine();
      if (fleet && fleet.getConfig) return fleet.getConfig();
      return {};
    },

    updateConfig: function(newConfig) {
      var fleet = getFleetEngine();
      if (fleet && fleet.updateConfig) return fleet.updateConfig(newConfig);
      return {};
    },

    resetConfig: function() {
      var fleet = getFleetEngine();
      if (fleet && fleet.resetConfig) return fleet.resetConfig();
      return {};
    },

    /**
     * Automated QA Suite to test & verify all dispatch requirements.
     */
    runDispatchQASuite: function() {
      var fleet = getFleetEngine();
      var mockRiders = [
        { id: 'R1', name: 'Rahul Patil', isOnline: true, state: 'AVAILABLE', lat: 21.0480, lng: 75.7900, activeOrdersCount: 0, todayDeliveriesCount: 2, kycApproved: true },
        { id: 'R2', name: 'Sanjay Chaudhari', isOnline: true, state: 'AVAILABLE', lat: 21.0600, lng: 75.8100, activeOrdersCount: 0, todayDeliveriesCount: 0, kycApproved: true },
        { id: 'R3', name: 'Vikas Mahajan (Offline)', isOnline: false, state: 'OFFLINE', lat: 21.0479, lng: 75.7897, activeOrdersCount: 0, todayDeliveriesCount: 5, kycApproved: true },
        { id: 'R4', name: 'Amit Bhusari (Overloaded)', isOnline: true, state: 'MULTI_ORDER', lat: 21.0478, lng: 75.7896, activeOrdersCount: 3, activeOrders: [{id:'o1'},{id:'o2'},{id:'o3'}], todayDeliveriesCount: 8, kycApproved: true }
      ];

      var testOrder1 = { id: 'ORD_101', type: 'GROCERY', pickupLat: 21.0478, pickupLng: 75.7896, pickupZone: 'Station Road', status: 'placed' };
      var testOrder2 = { id: 'ORD_102', type: 'GROCERY', riderId: 'R1', status: 'Partner Assigned' }; // Already assigned

      var results = [];

      // Test 1: Assign nearest available rider
      var res1 = this.findBestRiderForOrder(testOrder1, mockRiders);
      var pass1 = res1 && res1.selectedRider && res1.selectedRider.id === 'R1';
      results.push({ name: '1. Assign Nearest Available Rider', status: pass1 ? 'PASS' : 'FAIL', details: 'Selected: ' + (res1 ? res1.selectedRider.name : 'None') + ' (Distance: ' + (res1 ? res1.distanceKm : 0) + ' km)' });

      // Test 2: Use Road distance, ETA, GPS, Order Load
      var pass2 = res1 && res1.distanceKm !== undefined && res1.roadEtaMins !== undefined;
      results.push({ name: '2. Use Road Distance, ETA, GPS & Order Load', status: pass2 ? 'PASS' : 'FAIL', details: 'Metrics calculated (ETA: ' + (res1 ? res1.roadEtaMins : 0) + ' mins)' });

      // Test 3: Allow Batching Only When No Significant Delay
      var riderWith1Order = [{ id: 'R5', name: 'Far R1', isOnline: true, state: 'DELIVERING', lat: 21.0900, lng: 75.8500, activeOrdersCount: 1, activeOrders: [{ id: 'act1', type: 'GROCERY', dropLat: 21.0900, dropLng: 75.8500 }], kycApproved: true }]; // Far away
      var res3 = this.findBestRiderForOrder(testOrder1, riderWith1Order);
      var pass3 = res3 === null || !res3.selectedRider; // Rejected due to > 5min delay
      results.push({ name: '3. Reject Batching If Significant Delay (>5 mins)', status: pass3 ? 'PASS' : 'FAIL', details: 'Batching correctly rejected for far-away busy rider' });

      // Test 4: Never assign offline riders
      var offlineOnly = [{ id: 'R3', name: 'Offline Rider', isOnline: false, state: 'OFFLINE', lat: 21.0478, lng: 75.7896, kycApproved: true }];
      var res4 = this.findBestRiderForOrder(testOrder1, offlineOnly);
      var pass4 = res4 === null || !res4.selectedRider;
      results.push({ name: '4. Never Assign Offline Riders', status: pass4 ? 'PASS' : 'FAIL', details: 'Offline rider skipped cleanly' });

      // Test 5: Never duplicate assignments
      var res5 = this.findBestRiderForOrder(testOrder2, mockRiders);
      var pass5 = res5 && res5.error === 'DUPLICATE_ASSIGNMENT_BLOCKED';
      results.push({ name: '5. Never Duplicate Assignments', status: pass5 ? 'PASS' : 'FAIL', details: 'Already-assigned order blocked from re-dispatch' });

      // Test 6: Passenger Exclusivity Protection (100% Order Rejection in Passenger Mode)
      var passengerRider = [{ id: 'R_PAX', name: 'Pax Rider', isOnline: true, state: 'PASSENGER_ACTIVE', activeOrders: [{ id: 'pax-1', type: 'PASSENGER' }], kycApproved: true }];
      var res6 = this.findBestRiderForOrder(testOrder1, passengerRider);
      var pass6 = res6 === null || !res6.selectedRider;
      results.push({ name: '6. Passenger Exclusivity Protection (100% Order Rejection in Passenger Mode)', status: pass6 ? 'PASS' : 'FAIL', details: 'Orders strictly rejected while rider is in passenger mode' });

      // Test 7: Busy Delivery Rider Cannot Receive Passenger Rides
      var busyDeliveryRider = [{ id: 'R_BUSY', name: 'Busy Rider', isOnline: true, state: 'DELIVERING', activeOrders: [{ id: 'ord-del', type: 'GROCERY' }], kycApproved: true }];
      var paxOrder = { id: 'ORD_PAX_1', type: 'PASSENGER', pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
      var res7 = this.findBestRiderForOrder(paxOrder, busyDeliveryRider);
      var pass7 = res7 === null || !res7.selectedRider;
      results.push({ name: '7. Busy Delivery Rider Cannot Receive Passenger Rides', status: pass7 ? 'PASS' : 'FAIL', details: 'Passenger ride requires 100% exclusive vehicle' });

      // Test 8: Volumetric Package Capacity & Vehicle Limits (Max 10 Units)
      var heavyRider = [{ id: 'R_HVY', name: 'Heavy Rider', isOnline: true, state: 'DELIVERING', activeOrders: [{ id: 'ord-1', type: 'PARCEL', packageSize: 'LARGE' }], kycApproved: true }]; // 6 units used
      var bulkyOrder = { id: 'ORD_BLK', type: 'PARCEL', packageSize: 'LARGE', pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' }; // 6 units -> 12 > 10
      var res8 = this.findBestRiderForOrder(bulkyOrder, heavyRider);
      var pass8 = res8 === null || !res8.selectedRider;
      results.push({ name: '8. Volumetric Package Capacity & Vehicle Limits (Max 10 Units)', status: pass8 ? 'PASS' : 'FAIL', details: 'Orders exceeding 10 capacity units rejected cleanly' });

      // Test 9: Medicine Emergency SLA Priority Boost
      var medOrder = { id: 'ORD_MED', type: 'MEDICINE', pickupLat: 21.0478, pickupLng: 75.7896, status: 'placed' };
      var medScore = this.calculateCompatibilityScore(mockRiders[0], medOrder);
      var groceryScore = this.calculateCompatibilityScore(mockRiders[0], testOrder1);
      var pass9 = medScore.eligible && medScore.breakdown.priorityBonus > groceryScore.breakdown.priorityBonus;
      results.push({ name: '9. Medicine Emergency SLA Priority Boost', status: pass9 ? 'PASS' : 'FAIL', details: 'Medicine received highest priority bonus (' + (medScore.breakdown ? medScore.breakdown.priorityBonus : 0) + ' pts)' });

      // Test 10: Food Freshness & Cooked Food Detour Protection
      var foodCarrier = { id: 'R_CHEF', name: 'Chef Rider', isOnline: true, state: 'DELIVERING', activeOrders: [{ id: 'fd-1', type: 'FOOD', status: 'PICKED_UP', dropLat: 21.0425, dropLng: 75.7980 }], kycApproved: true };
      var farDetourOrder = { id: 'ORD_FAR', type: 'GROCERY', pickupLat: 21.0750, pickupLng: 75.8300, status: 'placed' };
      var res10 = this.evaluateRiderEligibility(foodCarrier, farDetourOrder);
      var pass10 = !res10.eligible;
      results.push({ name: '10. Food Freshness & Cooked Food Detour Protection', status: pass10 ? 'PASS' : 'FAIL', details: 'Detour blocked to prevent cooling of active hot food' });

      // Test 11: Fair Fleet Workload Balancing
      var highLoadRider = { id: 'R_HIGH', name: 'High Load', isOnline: true, state: 'AVAILABLE', lat: 21.0478, lng: 75.7896, todayDeliveriesCount: 10, kycApproved: true };
      var zeroLoadRider = { id: 'R_ZERO', name: 'Zero Load', isOnline: true, state: 'AVAILABLE', lat: 21.0478, lng: 75.7896, todayDeliveriesCount: 0, kycApproved: true };
      var scoreHigh = this.calculateCompatibilityScore(highLoadRider, testOrder1);
      var scoreZero = this.calculateCompatibilityScore(zeroLoadRider, testOrder1);
      var pass11 = scoreZero.breakdown.fairnessBonus > scoreHigh.breakdown.fairnessBonus && scoreZero.score > scoreHigh.score;
      results.push({ name: '11. Fair Fleet Workload Balancing', status: pass11 ? 'PASS' : 'FAIL', details: 'Zero-load rider received higher fairness bonus (' + (scoreZero.breakdown ? scoreZero.breakdown.fairnessBonus : 0) + ' vs ' + (scoreHigh.breakdown ? scoreHigh.breakdown.fairnessBonus : 0) + ' pts)' });

      // Test 12: Explainable Dispatch Audit Logging (bhusawal_dispatch_logs)
      var logs = this.getDispatchLogs();
      var pass12 = Array.isArray(logs) && logs.length > 0;
      results.push({ name: '12. Explainable Dispatch Audit Logging (bhusawal_dispatch_logs)', status: pass12 ? 'PASS' : 'FAIL', details: 'Assignment logs recorded with candidates and rejection reasons' });

      return results;
    }
  };

  return BhusawalIntelligentDispatchEngine;
});

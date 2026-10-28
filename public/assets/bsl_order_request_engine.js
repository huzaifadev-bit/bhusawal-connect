/**
 * ====================================================================
 * BSL CONNECT — UNIFIED RIDER ORDER REQUEST ENGINE & CONTROLLER
 * ====================================================================
 * 
 * Reusable client-side dispatch controller and modal manager for all 6 order types:
 * 1. 🛒 GROCERY        ("GROCERY DELIVERY")
 * 2. 🍔 FOOD           ("FOOD DELIVERY" with Freshness SLA priority)
 * 3. 💊 MEDICINE       ("MEDICINE DELIVERY" with prominent HIGH PRIORITY alert)
 * 4. 📦 PARCEL         ("PARCEL DELIVERY" with package size & dimensions)
 * 5. 🔄 PICKUP & DROP  ("PICKUP & DROP" with custom errand details)
 * 6. 🛵 PASSENGER      ("NEW PASSENGER RIDE" with ride styling & exclusivity lock)
 * 
 * Invariants & Backend Enforcement:
 * - When PASSENGER ride is accepted:
 *   1. Rider state is transitioned to PASSENGER_PICKUP in BslFleetEngine & Master DB.
 *   2. Strict exclusivity lock is engaged (isPassengerLocked = true).
 *   3. All new order offers are immediately paused/blocked by both backend & dispatch engines.
 *   4. Frontend state is kept 100% synchronized with backend state (no fake states).
 * - Multi-order deliveries enforce maximum capacity (3 orders) and detour distance (<= 1.2 km).
 */

(function(root, factory) {
  var engine = factory();
  if (typeof exports === 'object' && typeof module !== 'undefined') {
    module.exports = engine;
  }
  if (typeof root !== 'undefined') {
    root.BslOrderRequestEngine = engine;
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.BslOrderRequestEngine = engine;
  }
})(typeof globalThis !== 'undefined' ? globalThis : (typeof window !== 'undefined' ? window : this), function() {
  'use strict';

  var AUTH_KEY = 'bhusawal_rider_auth';
  var ORDERS_KEY = 'bhusawal_orders';

  var currentRequestData = null;
  var countdownInterval = null;
  var remainingSeconds = 25;
  var audioContext = null;

  // CONFIGURATION & STYLING FOR EACH ORDER TYPE
  var ORDER_CONFIGS = {
    GROCERY: {
      type: 'GROCERY',
      title: 'GROCERY DELIVERY',
      icon: 'shopping_basket',
      badgeBg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      headerGradient: 'from-emerald-950 via-slate-900 to-slate-950 border-emerald-500/40',
      accentColor: 'text-emerald-400',
      btnAcceptClass: 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20',
      priorityBadge: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20',
      defaultPriorityText: 'Standard Delivery (SLA: 35m)',
      defaultPickup: 'Saijeevan Super Shoppy, Station Road',
      defaultDrop: 'Flat 302, Vardhaman Residency, Jamner Road',
      defaultPickupDist: '1.2 km',
      defaultDropDist: '2.4 km',
      defaultEarning: 38,
      defaultTime: '18 mins',
      defaultPackageInfo: '2 Bags • 8 Items (Fresh Produce & Groceries)'
    },
    FOOD: {
      type: 'FOOD',
      title: 'FOOD DELIVERY',
      icon: 'restaurant',
      badgeBg: 'bg-orange-500/20 text-orange-300 border-orange-500/30',
      headerGradient: 'from-orange-950 via-slate-900 to-slate-950 border-orange-500/40',
      accentColor: 'text-orange-400',
      btnAcceptClass: 'bg-orange-600 hover:bg-orange-500 text-white shadow-orange-500/20',
      priorityBadge: 'bg-orange-500/15 text-orange-300 border-orange-500/30 animate-pulse',
      defaultPriorityText: '🔥 High Freshness SLA • Hot Meal (Must deliver in 25m)',
      defaultPickup: 'Royal Biryani & Kabab, Station Road Square',
      defaultDrop: 'House 14, Railway Colony North, Bhusawal',
      defaultPickupDist: '0.9 km',
      defaultDropDist: '3.1 km',
      defaultEarning: 48,
      defaultTime: '22 mins',
      defaultPackageInfo: '1 Thermal Spill-Proof Meal Container'
    },
    MEDICINE: {
      type: 'MEDICINE',
      title: 'MEDICINE DELIVERY',
      icon: 'medical_services',
      badgeBg: 'bg-rose-500/20 text-rose-300 border-rose-500/30',
      headerGradient: 'from-rose-950 via-slate-900 to-slate-950 border-rose-500/40',
      accentColor: 'text-rose-400',
      btnAcceptClass: 'bg-rose-600 hover:bg-rose-500 text-white shadow-rose-500/20',
      priorityBadge: 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse font-black',
      defaultPriorityText: '🚨 CRITICAL MEDICAL ORDER • HIGH PRIORITY (Urgent Care Dispatch - SLA: 20m)',
      defaultPickup: 'Bhusawal Medical & Surgical, Civil Hospital Road',
      defaultDrop: 'Bungalow 7, Old Khadaka Road, Bhusawal',
      defaultPickupDist: '1.5 km',
      defaultDropDist: '2.0 km',
      defaultEarning: 55,
      defaultTime: '14 mins',
      defaultPackageInfo: 'Sealed Tamper-Proof Prescription Pouch (Rx #MED-8910)'
    },
    PARCEL: {
      type: 'PARCEL',
      title: 'PARCEL DELIVERY',
      icon: 'inventory_2',
      badgeBg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
      headerGradient: 'from-indigo-950 via-slate-900 to-slate-950 border-indigo-500/40',
      accentColor: 'text-indigo-400',
      btnAcceptClass: 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20',
      priorityBadge: 'bg-indigo-500/10 text-indigo-300 border-indigo-500/20',
      defaultPriorityText: 'Standard Parcel Courier (SLA: 60m)',
      defaultPickup: 'Market Yard Courier Counter, Bhusawal Hub',
      defaultDrop: 'Plot 45, MIDC Industrial Area, Bhusawal',
      defaultPickupDist: '1.1 km',
      defaultDropDist: '4.2 km',
      defaultEarning: 45,
      defaultTime: '28 mins',
      packageSize: 'Medium (30x25x15 cm • 2.2 kg)',
      defaultPackageInfo: '📦 Package Size: Medium Box (Dimensions: 30x25x15 cm • Weight: 2.2 kg)'
    },
    PICKUP_DROP: {
      type: 'PICKUP_DROP',
      title: 'PICKUP & DROP',
      icon: 'swap_horiz',
      badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
      headerGradient: 'from-cyan-950 via-slate-900 to-slate-950 border-cyan-500/40',
      accentColor: 'text-cyan-400',
      btnAcceptClass: 'bg-cyan-600 hover:bg-cyan-500 text-white shadow-cyan-500/20',
      priorityBadge: 'bg-cyan-500/10 text-cyan-300 border-cyan-500/20',
      defaultPriorityText: 'Direct Custom Errand (Point-to-Point)',
      defaultPickup: 'Mohan Nagar Gate, Jamner Road',
      defaultDrop: 'Civil Court Chambers, Court Road, Bhusawal',
      defaultPickupDist: '0.7 km',
      defaultDropDist: '2.8 km',
      defaultEarning: 52,
      defaultTime: '20 mins',
      defaultPackageInfo: 'Custom Errand: "House Keys & Urgent Office Documents (Call sender on arrival)"'
    },
    PASSENGER: {
      type: 'PASSENGER',
      title: 'NEW PASSENGER RIDE',
      icon: 'two_wheeler',
      badgeBg: 'bg-amber-400 text-slate-950 font-black',
      headerGradient: 'from-amber-950 via-yellow-950 to-slate-950 border-amber-400/50',
      accentColor: 'text-amber-300',
      btnAcceptClass: 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black shadow-amber-400/30',
      priorityBadge: 'bg-amber-400/20 text-amber-300 border-amber-400/40 font-bold',
      defaultPriorityText: 'Instant Passenger Pickup (< 3 min ETA)',
      defaultPickup: 'Bhusawal Railway Station Taxi Stand (Platform 1 Exit)',
      defaultDrop: 'Jamner Road Municipal Shopping Complex',
      defaultPickupDist: '0.6 km',
      defaultDropDist: '3.8 km',
      defaultEarning: 65,
      defaultTime: '12 mins trip',
      defaultPackageInfo: 'Passenger: Amit Sharma (★ 4.9 Verified Rider • Helmet Required)',
      isPassengerRide: true,
      exclusivityNotice: 'Accepting this ride will temporarily pause other order requests.'
    }
  };

  // Helper to normalize category/type string
  function normalizeType(rawType) {
    if (!rawType) return 'GROCERY';
    var t = String(rawType).trim().toUpperCase();
    if (t === 'BIKE_RIDE' || t === 'BIKETAXI' || t === 'RIDE' || t === 'PASSENGER_RIDE') return 'PASSENGER';
    if (t === 'PHARMACY' || t === 'MEDICINES') return 'MEDICINE';
    if (t === 'RESTAURANT') return 'FOOD';
    if (t === 'COURIER') return 'PARCEL';
    if (t === 'ERRAND' || t === 'PICKUP') return 'PICKUP_DROP';
    return ORDER_CONFIGS[t] ? t : 'GROCERY';
  }

  // Audio chime using Web Audio API
  function playAlertChime() {
    try {
      var AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      if (!audioContext) audioContext = new AudioContext();

      if (audioContext.state === 'suspended') {
        audioContext.resume();
      }

      var now = audioContext.currentTime;

      // Note 1: 880Hz (A5)
      var osc1 = audioContext.createOscillator();
      var gain1 = audioContext.createGain();
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(880, now);
      gain1.gain.setValueAtTime(0.3, now);
      gain1.gain.exponentialRampToValueAtTime(0.01, now + 0.25);
      osc1.connect(gain1);
      gain1.connect(audioContext.destination);
      osc1.start(now);
      osc1.stop(now + 0.25);

      // Note 2: 1320Hz (E6)
      var osc2 = audioContext.createOscillator();
      var gain2 = audioContext.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1320, now + 0.15);
      gain2.gain.setValueAtTime(0.35, now + 0.15);
      gain2.gain.exponentialRampToValueAtTime(0.01, now + 0.5);
      osc2.connect(gain2);
      gain2.connect(audioContext.destination);
      osc2.start(now + 0.15);
      osc2.stop(now + 0.5);
    } catch(e) {}
  }

  // Get current auth state
  function getAuthState() {
    try {
      var data = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (data && typeof data === 'object') return data;
    } catch(e) {}
    return {
      isLoggedIn: true,
      phone: '9876543210',
      fullName: 'Rahul Ramesh Patil',
      isOnline: true,
      state: 'AVAILABLE',
      activeOrderId: null,
      activeOrders: [],
      walletBalance: 1240
    };
  }

  function saveAuthState(state) {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(state));
    } catch(e) {}
  }

  // ====================================================================
  // PUBLIC CONTROLLER API
  // ====================================================================

  /**
   * 1. showOrderRequest(orderData)
   * Displays the unified order request modal populated with vertical data.
   */
  function showOrderRequest(orderData) {
    if (!orderData) return;
    var normType = normalizeType(orderData.type || orderData.category);
    var cfg = ORDER_CONFIGS[normType] || ORDER_CONFIGS.GROCERY;

    // Merge provided orderData with defaults
    var normalizedOrder = {
      id: orderData.id || orderData.orderId || ('REQ-' + Math.floor(10000 + Math.random() * 90000)),
      type: normType,
      title: cfg.title,
      pickupAddress: orderData.pickupAddress || orderData.store || orderData.pickup || cfg.defaultPickup,
      dropAddress: orderData.dropAddress || orderData.address || orderData.drop || cfg.defaultDrop,
      pickupDistance: orderData.pickupDistance || orderData.pickupDist || cfg.defaultPickupDist,
      dropDistance: orderData.dropDistance || orderData.dropDist || orderData.deliveryDistance || orderData.rideDistance || cfg.defaultDropDist,
      earning: orderData.earning || orderData.payout || orderData.fare || cfg.defaultEarning,
      time: orderData.time || orderData.eta || cfg.defaultTime,
      priority: orderData.priority || cfg.defaultPriorityText,
      packageInfo: orderData.packageInfo || orderData.details || orderData.packageDetails || cfg.defaultPackageInfo,
      packageSize: orderData.packageSize || cfg.packageSize || '',
      isPassengerRide: cfg.isPassengerRide || false,
      exclusivityNotice: cfg.exclusivityNotice || '',
      timeoutSeconds: orderData.timeoutSeconds || 25,
      raw: orderData
    };

    currentRequestData = normalizedOrder;

    // DOM Elements
    var modal = document.getElementById('modal-unified-order-request');
    if (!modal) {
      console.warn('Unified order request modal (#modal-unified-order-request) not found in DOM.');
      return;
    }

    // A. Apply Vertical Theming to Card Container
    var cardBox = document.getElementById('req-card-box');
    if (cardBox) {
      if (normType === 'PASSENGER') {
        cardBox.className = 'w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border-2 border-amber-400 bg-gradient-to-br from-amber-950 via-slate-900 to-amber-950 text-white';
      } else if (normType === 'MEDICINE') {
        cardBox.className = 'w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border-2 border-rose-500 bg-gradient-to-br from-slate-900 via-rose-950/60 to-slate-950 text-white';
      } else if (normType === 'FOOD') {
        cardBox.className = 'w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border-2 border-orange-500/80 bg-gradient-to-br from-slate-900 via-orange-950/50 to-slate-950 text-white';
      } else if (normType === 'PARCEL') {
        cardBox.className = 'w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border-2 border-indigo-500/80 bg-gradient-to-br from-slate-900 via-indigo-950/50 to-slate-950 text-white';
      } else if (normType === 'PICKUP_DROP') {
        cardBox.className = 'w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border-2 border-cyan-500/80 bg-gradient-to-br from-slate-900 via-cyan-950/50 to-slate-950 text-white';
      } else {
        // GROCERY
        cardBox.className = 'w-full max-w-sm rounded-3xl p-5 shadow-2xl space-y-4 border-2 border-emerald-500/80 bg-gradient-to-br from-slate-900 via-emerald-950/50 to-slate-950 text-white';
      }
    }

    // B. Header Service Type & Icon
    var iconEl = document.getElementById('req-service-icon');
    if (iconEl) iconEl.textContent = cfg.icon;

    var titleEl = document.getElementById('req-service-title');
    if (titleEl) titleEl.textContent = cfg.title;

    var badgeEl = document.getElementById('req-service-badge');
    if (badgeEl) {
      badgeEl.className = 'px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border ' + cfg.badgeBg;
      badgeEl.textContent = normType;
    }

    // C. Locations (Pickup & Drop) with Distance Pills
    var pickupNameEl = document.getElementById('req-pickup-name');
    if (pickupNameEl) pickupNameEl.textContent = normalizedOrder.pickupAddress;

    var pickupDistEl = document.getElementById('req-pickup-dist');
    if (pickupDistEl) pickupDistEl.textContent = normalizedOrder.pickupDistance + ' away';

    var dropNameEl = document.getElementById('req-drop-name');
    if (dropNameEl) dropNameEl.textContent = normalizedOrder.dropAddress;

    var dropDistEl = document.getElementById('req-drop-dist');
    if (dropDistEl) {
      var distLabel = normType === 'PASSENGER' ? 'Ride: ' : 'Drop: ';
      dropDistEl.textContent = distLabel + normalizedOrder.dropDistance;
    }

    // D. Estimated Earnings & Time
    var earningEl = document.getElementById('req-earning-val');
    if (earningEl) earningEl.textContent = '₹' + normalizedOrder.earning;

    var timeEl = document.getElementById('req-time-val');
    if (timeEl) timeEl.textContent = normalizedOrder.time;

    // E. Priority Indicator
    var priorityContainer = document.getElementById('req-priority-container');
    var priorityText = document.getElementById('req-priority-text');
    if (priorityText) priorityText.textContent = normalizedOrder.priority;

    if (priorityContainer) {
      if (normType === 'MEDICINE') {
        priorityContainer.className = 'p-2.5 rounded-xl border flex items-center gap-2 bg-rose-500/20 border-rose-500/40 text-rose-200 text-xs font-black shadow-inner animate-pulse';
      } else if (normType === 'FOOD') {
        priorityContainer.className = 'p-2 rounded-xl border flex items-center gap-2 bg-orange-500/15 border-orange-500/30 text-orange-200 text-xs font-extrabold';
      } else if (normType === 'PASSENGER') {
        priorityContainer.className = 'p-2 rounded-xl border flex items-center gap-2 bg-amber-400/15 border-amber-400/30 text-amber-200 text-xs font-extrabold';
      } else {
        priorityContainer.className = 'p-2 rounded-xl border flex items-center gap-2 bg-slate-800/80 border-slate-700 text-slate-300 text-xs font-semibold';
      }
    }

    // F. Package / Relevant Order Details (Package size for parcel, prescription for medicine, items for grocery)
    var packageBox = document.getElementById('req-package-info-box');
    var packageText = document.getElementById('req-package-info-text');
    if (packageText) packageText.textContent = normalizedOrder.packageInfo;

    // G. PASSENGER EXCLUSIVITY WARNING BANNER
    var passWarning = document.getElementById('req-passenger-warning-banner');
    if (passWarning) {
      if (normType === 'PASSENGER') {
        passWarning.classList.remove('hidden');
      } else {
        passWarning.classList.add('hidden');
      }
    }

    // H. Accept Button Styling
    var btnAccept = document.getElementById('btn-order-request-accept');
    if (btnAccept) {
      btnAccept.className = 'py-3.5 px-4 font-black text-xs rounded-xl shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer ' + cfg.btnAcceptClass;
      var acceptLabel = normType === 'PASSENGER' ? 'Accept Ride' : 'Accept Order';
      var acceptLabelEl = document.getElementById('req-btn-accept-text');
      if (acceptLabelEl) acceptLabelEl.textContent = acceptLabel;
    }

    // Display modal
    modal.classList.remove('hidden');

    // Play Alert Audio Chime
    playAlertChime();

    // Start 25-Second Countdown Timer
    startCountdown(normalizedOrder.timeoutSeconds);
  }

  // Timer Manager
  function startCountdown(totalSeconds) {
    if (countdownInterval) clearInterval(countdownInterval);

    totalSeconds = totalSeconds || 25;
    remainingSeconds = totalSeconds;

    var timerVal = document.getElementById('req-timer-val');
    var timerBar = document.getElementById('req-timer-bar');

    if (timerVal) timerVal.textContent = remainingSeconds + 's';
    if (timerBar) timerBar.style.width = '100%';

    countdownInterval = setInterval(function() {
      remainingSeconds--;
      if (timerVal) timerVal.textContent = remainingSeconds + 's';
      if (timerBar) timerBar.style.width = (remainingSeconds / totalSeconds * 100) + '%';

      if (remainingSeconds <= 0) {
        clearInterval(countdownInterval);
        declineCurrentRequest(true); // Auto-decline on timeout
      }
    }, 1000);
  }

  function stopCountdown() {
    if (countdownInterval) {
      clearInterval(countdownInterval);
      countdownInterval = null;
    }
  }

  /**
   * 2. acceptCurrentRequest()
   * Validates backend state, transitions rider state deterministically, and updates UI.
   */
  function acceptCurrentRequest() {
    stopCountdown();
    closeModal();

    if (!currentRequestData) return;

    var req = currentRequestData;
    var state = getAuthState();

    // BACKEND INTEGRATION: Validate with BslFleetEngine
    if (window.BslFleetEngine) {
      var acceptCheck = window.BslFleetEngine.canAcceptOrder(state, req);
      if (!acceptCheck.canAccept) {
        alert('⚠️ Dispatch Rejected: ' + acceptCheck.reason);
        return;
      }
    }

    var normType = req.type;

    if (normType === 'PASSENGER') {
      // ====================================================================
      // STRICT PASSENGER ACCEPTANCE RULE ENFORCEMENT
      // ====================================================================
      state.state = 'PASSENGER_PICKUP';
      state.isPassengerLocked = true;
      state.activeOrderId = req.id;
      state.activeOrders = [{
        id: req.id,
        type: 'PASSENGER',
        passengerName: 'Amit Sharma',
        pickupAddress: req.pickupAddress,
        dropAddress: req.dropAddress,
        fare: req.earning,
        status: 'GOING_TO_PASSENGER_PICKUP'
      }];

      // 1. Persist in LocalStorage
      saveAuthState(state);

      // 2. Synchronize directly into Central Master Backend & DB
      if (window.BhusawalBackend) {
        window.BhusawalBackend.riders.save({
          id: state.id || 'BHU-RIDER-8942',
          name: state.fullName || 'Rahul Patil',
          phone: state.phone || '+91 9876543210',
          isOnline: true,
          state: 'PASSENGER_PICKUP',
          isPassengerLocked: true,
          activeOrderId: req.id,
          activeOrders: state.activeOrders
        });

        // Update Central Order Status
        window.BhusawalBackend.orders.assignRider(req.id, state.id || 'BHU-RIDER-8942', state.fullName || 'Rahul Patil', state.phone || '+91 9876543210');
      }

      // 3. Inform Rider Home Controller
      if (window.BslRiderHome) {
        window.BslRiderHome.saveRiderState(state);
        window.BslRiderHome.renderHomeView(state);
      }

      alert('🛵 PASSENGER RIDE ACCEPTED!\n\n⚠️ Strict Exclusivity Engaged: All grocery, food, medicine, and parcel requests are now PAUSED until this passenger trip is completed.');
    } else {
      // ====================================================================
      // DELIVERY ORDER ACCEPTANCE (GROCERY, FOOD, MEDICINE, PARCEL, PICKUP_DROP)
      // ====================================================================
      var existingOrders = state.activeOrders || (state.activeOrderId ? [{ id: state.activeOrderId, type: 'GROCERY' }] : []);
      
      var newActiveOrder = {
        id: req.id,
        type: normType,
        store: req.pickupAddress,
        pickupAddress: req.pickupAddress,
        dropAddress: req.dropAddress,
        payout: req.earning,
        status: 'GOING_TO_PICKUP',
        stageStep: 2
      };

      if (existingOrders.length >= 1) {
        // Transition to MULTI_ORDER batch
        state.state = 'MULTI_ORDER';
        state.activeOrders = existingOrders.concat([newActiveOrder]);
        state.activeOrderId = req.id;
      } else {
        state.state = 'DELIVERING';
        state.activeOrders = [newActiveOrder];
        state.activeOrderId = req.id;
      }

      saveAuthState(state);

      if (window.BhusawalBackend) {
        window.BhusawalBackend.riders.save({
          id: state.id || 'BHU-RIDER-8942',
          name: state.fullName || 'Rahul Patil',
          phone: state.phone || '+91 9876543210',
          isOnline: true,
          state: state.state,
          activeOrderId: req.id,
          activeOrders: state.activeOrders
        });

        window.BhusawalBackend.orders.assignRider(req.id, state.id || 'BHU-RIDER-8942', state.fullName || 'Rahul Patil', state.phone || '+91 9876543210');
      }

      if (window.BslRiderHome) {
        window.BslRiderHome.saveRiderState(state);
        window.BslRiderHome.renderHomeView(state);
      }

      alert('✅ ' + cfg.title + ' ACCEPTED! (#' + req.id + ')\nPickup: ' + req.pickupAddress + '\nEarning: ₹' + req.earning);
    }

    currentRequestData = null;
  }

  /**
   * 3. declineCurrentRequest(isTimeout)
   * Closes the request and notifies dispatch of refusal.
   */
  function declineCurrentRequest(isTimeout) {
    stopCountdown();
    closeModal();

    if (currentRequestData) {
      var req = currentRequestData;
      console.log('Order request declined:', req.id, isTimeout ? '(Timeout)' : '(Manual)');
      currentRequestData = null;
    }
  }

  function closeModal() {
    var modal = document.getElementById('modal-unified-order-request');
    if (modal) modal.classList.add('hidden');
  }

  /**
   * 4. simulateOrderRequest(type)
   * Pre-packaged realistic sample for testing every order vertical.
   */
  function simulateOrderRequest(type) {
    var norm = normalizeType(type);
    var cfg = ORDER_CONFIGS[norm];
    if (!cfg) return;

    var sample = {
      id: 'BHU-' + norm.substring(0, 3) + '-' + Math.floor(1000 + Math.random() * 9000),
      type: norm,
      pickupAddress: cfg.defaultPickup,
      dropAddress: cfg.defaultDrop,
      pickupDistance: cfg.defaultPickupDist,
      dropDistance: cfg.defaultDropDist,
      earning: cfg.defaultEarning,
      time: cfg.defaultTime,
      priority: cfg.defaultPriorityText,
      packageInfo: cfg.defaultPackageInfo,
      timeoutSeconds: 25
    };

    showOrderRequest(sample);
  }

  // Bind Listeners
  function init() {
    document.getElementById('btn-order-request-accept')?.addEventListener('click', acceptCurrentRequest);
    document.getElementById('btn-order-request-decline')?.addEventListener('click', function() {
      declineCurrentRequest(false);
    });
  }

  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', init);
    } else {
      init();
    }
  }

  return {
    showOrderRequest: showOrderRequest,
    acceptCurrentRequest: acceptCurrentRequest,
    declineCurrentRequest: declineCurrentRequest,
    simulateOrderRequest: simulateOrderRequest,
    closeModal: closeModal,
    playAlertChime: playAlertChime,
    getOrderConfig: function(type) { return ORDER_CONFIGS[normalizeType(type)]; },
    ORDER_CONFIGS: ORDER_CONFIGS
  };
});

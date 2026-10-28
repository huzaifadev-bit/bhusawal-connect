/**
 * ====================================================================
 * BSL CONNECT — RIDER PARTNER HOME & LIVE MAP CONTROLLER (v3.0)
 * ====================================================================
 * Powers the map-first interface inspired by Zomato/Blinkit/Rapido Captain:
 * - Live Leaflet map canvas covering Bhusawal service zone
 * - Directional pulsing rider GPS marker & multi-stop route sequencing
 * - Prominent ON DUTY / OFF DUTY controls with dynamic status messaging
 * - Glanceable Home Summary HUD (Earnings, Orders, Distance, Online Time)
 * - Intelligent Active Route & Next Action HUD (BslRouteSequencer)
 * - Multi-order stacking engine with Backend Fleet Guards (BslFleetEngine)
 * - Passenger 100% exclusivity lock (Rapido/Bike Taxi workflow)
 * - 4 Main Tabs: Home, Orders, Earnings, Profile
 */

window.BslRiderHome = (function() {
  'use strict';

  var AUTH_KEY = 'bhusawal_rider_auth';
  var ORDERS_KEY = 'bhusawal_orders';

  var map = null;
  var riderMarker = null;
  var accuracyCircle = null;
  var activeRouteLine = null;
  var passengerRouteLine = null;
  var passengerGlowLine = null;
  var routeMarkers = [];
  var passengerMarkers = [];
  var hotspotMarkers = [];
  var servicePolygon = null;
  var isHotspotsVisible = true;
  var isFollowRider = true;
  var gpsWatchId = null;
  var currentNextAction = null;

  var currentGPS = {
    lat: 21.0478,
    lng: 75.7896,
    heading: 0,
    speed: 0,
    accuracy: 8,
    isLive: false,
    timestamp: Date.now()
  };


  // Distance in meters between coordinates
  function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    var R = 6371000; // Earth radius in meters
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  // Bearing calculation for realistic vehicle heading
  function calculateBearing(lat1, lon1, lat2, lon2) {
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    var x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
            Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    var brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
    return Math.round(brng);
  }

  // Bhusawal City Landmarks & Coordinates
  var BHUSAWAL_CENTER = [21.0478, 75.7896];
  var BHUSAWAL_BOUNDARY = [
    [21.0650, 75.7700],
    [21.0620, 75.8150],
    [21.0350, 75.8200],
    [21.0250, 75.7900],
    [21.0350, 75.7650]
  ];

  var HOTSPOTS = [
    { name: 'Sai Jeevan Mall (Grocery)', coords: [21.0485, 75.7910], type: 'GROCERY', icon: 'shopping_basket', color: 'bg-emerald-600' },
    { name: 'Royal Biryani (Food)', coords: [21.0470, 75.7885], type: 'FOOD', icon: 'restaurant', color: 'bg-orange-500' },
    { name: 'Bhusawal Medical (Pharmacy)', coords: [21.0450, 75.7930], type: 'MEDICINE', icon: 'medical_services', color: 'bg-red-500' },
    { name: 'Railway Station Taxi Stand (Rides)', coords: [21.0495, 75.7870], type: 'PASSENGER', icon: 'hail', color: 'bg-amber-500' },
    { name: 'Market Yard Courier Hub (Parcel)', coords: [21.0440, 75.7845], type: 'PARCEL', icon: 'inventory_2', color: 'bg-purple-600' }
  ];

  // 1. AUTH STATE HELPER
  function getRiderState() {
    try {
      var data = JSON.parse(localStorage.getItem(AUTH_KEY) || 'null');
      if (data && typeof data === 'object') {
        if (!data.breakdown) data.breakdown = defaultBreakdown;
        if (!data.earningsTimeframe) data.earningsTimeframe = 'today';
        if (!data.payoutHistory) {
          data.payoutHistory = [
            { id: 'BSL-5892', type: 'UPI_INSTANT', title: 'Instant UPI Withdrawal', desc: 'To rahulpatil@okaxis • Ref #BSL-5892', amount: 500, status: 'Completed', time: 'Today, 11:30 AM' },
            { id: 'BSL-5710', type: 'BANK_AUTO', title: 'Nightly Fleet Auto-Settlement', desc: 'To SBI A/C ••••8942', amount: 1120, status: 'Settled', time: 'Yesterday, 11:59 PM' },
            { id: 'BSL-5520', type: 'BONUS', title: 'Weekly Fleet Milestone Bonus', desc: 'Credited to combined wallet', amount: 450, status: 'Credited', time: '4 Oct 2026' }
          ];
        }
        if (!data.settings) data.settings = { orderChime: true, mapHotspots: true, language: 'en' };
        return data;
      }
    } catch(e) {}

    // Sensible Default for Instant Experience
    var defaultBreakdown = {
      today: {
        total: 684,
        jobs: 12,
        distanceKm: 24.6,
        onlineHours: 5.5,
        cancelled: 0,
        incentives: 120,
        services: {
          GROCERY: { name: 'Grocery Delivery', icon: 'shopping_basket', amount: 210, jobs: 4, color: 'text-emerald-400', barBg: 'bg-emerald-500' },
          FOOD: { name: 'Food Delivery', icon: 'restaurant', amount: 182, jobs: 3, color: 'text-orange-400', barBg: 'bg-orange-500' },
          MEDICINE: { name: 'Medicine Delivery', icon: 'medical_services', amount: 72, jobs: 1, color: 'text-rose-400', barBg: 'bg-rose-500' },
          PARCEL: { name: 'Parcel Delivery', icon: 'inventory_2', amount: 96, jobs: 2, color: 'text-purple-400', barBg: 'bg-purple-500' },
          PICKUP_DROP: { name: 'Pickup & Drop', icon: 'swap_horiz', amount: 0, jobs: 0, color: 'text-cyan-400', barBg: 'bg-cyan-500' },
          PASSENGER: { name: 'Passenger Rides', icon: 'two_wheeler', amount: 124, jobs: 2, color: 'text-amber-400', barBg: 'bg-amber-500' }
        }
      },
      weekly: {
        total: 4890,
        jobs: 86,
        distanceKm: 172.4,
        onlineHours: 38.5,
        cancelled: 1,
        incentives: 850,
        services: {
          GROCERY: { name: 'Grocery Delivery', icon: 'shopping_basket', amount: 1540, jobs: 28, color: 'text-emerald-400', barBg: 'bg-emerald-500' },
          FOOD: { name: 'Food Delivery', icon: 'restaurant', amount: 1320, jobs: 24, color: 'text-orange-400', barBg: 'bg-orange-500' },
          MEDICINE: { name: 'Medicine Delivery', icon: 'medical_services', amount: 480, jobs: 8, color: 'text-rose-400', barBg: 'bg-rose-500' },
          PARCEL: { name: 'Parcel Delivery', icon: 'inventory_2', amount: 620, jobs: 11, color: 'text-purple-400', barBg: 'bg-purple-500' },
          PICKUP_DROP: { name: 'Pickup & Drop', icon: 'swap_horiz', amount: 180, jobs: 3, color: 'text-cyan-400', barBg: 'bg-cyan-500' },
          PASSENGER: { name: 'Passenger Rides', icon: 'two_wheeler', amount: 750, jobs: 12, color: 'text-amber-400', barBg: 'bg-amber-500' }
        }
      },
      monthly: {
        total: 21450,
        jobs: 378,
        distanceKm: 760.8,
        onlineHours: 168.0,
        cancelled: 3,
        incentives: 3600,
        services: {
          GROCERY: { name: 'Grocery Delivery', icon: 'shopping_basket', amount: 6850, jobs: 122, color: 'text-emerald-400', barBg: 'bg-emerald-500' },
          FOOD: { name: 'Food Delivery', icon: 'restaurant', amount: 5920, jobs: 106, color: 'text-orange-400', barBg: 'bg-orange-500' },
          MEDICINE: { name: 'Medicine Delivery', icon: 'medical_services', amount: 2140, jobs: 36, color: 'text-rose-400', barBg: 'bg-rose-500' },
          PARCEL: { name: 'Parcel Delivery', icon: 'inventory_2', amount: 2780, jobs: 48, color: 'text-purple-400', barBg: 'bg-purple-500' },
          PICKUP_DROP: { name: 'Pickup & Drop', icon: 'swap_horiz', amount: 920, jobs: 16, color: 'text-cyan-400', barBg: 'bg-cyan-500' },
          PASSENGER: { name: 'Passenger Rides', icon: 'two_wheeler', amount: 2840, jobs: 50, color: 'text-amber-400', barBg: 'bg-amber-500' }
        }
      }
    };

    var defaultState = {
      isLoggedIn: true,
      phone: '9876543210',
      fullName: 'Rahul Ramesh Patil',
      email: 'rahul.patil@bslconnect.in',
      emergencyPhone: '9123456789',
      city: 'Bhusawal',
      area: 'Station Road & Main Market',
      availability: 'Full Time',
      vehicleType: 'EV Scooter',
      bikeNo: 'MH 19 AX 4892',
      dlNo: 'MH19 20220018942',
      aadhaarNo: 'XXXXXXXX8942',
      photoUrl: '',
      kycSubmitted: true,
      kycApproved: true,
      upiId: 'rahulpatil@okaxis',
      bankAcc: '30894218942',
      bankIfsc: 'SBIN0000324',
      isOnline: true,
      state: 'AVAILABLE',
      walletBalance: 1240,
      todayEarnings: 684,
      todayOrdersCount: 12,
      todayDistanceKm: 24.6,
      todayOnlineHours: 5.5,
      todayCancelledCount: 0,
      todayIncentives: 120,
      earningsTimeframe: 'today',
      breakdown: defaultBreakdown,
      payoutHistory: [
        { id: 'BSL-5892', type: 'UPI_INSTANT', title: 'Instant UPI Withdrawal', desc: 'To rahulpatil@okaxis • Ref #BSL-5892', amount: 500, status: 'Completed', time: 'Today, 11:30 AM' },
        { id: 'BSL-5710', type: 'BANK_AUTO', title: 'Nightly Fleet Auto-Settlement', desc: 'To SBI A/C ••••8942', amount: 1120, status: 'Settled', time: 'Yesterday, 11:59 PM' },
        { id: 'BSL-5520', type: 'BONUS', title: 'Weekly Fleet Milestone Bonus', desc: 'Credited to combined wallet', amount: 450, status: 'Credited', time: '4 Oct 2026' }
      ],
      settings: {
        orderChime: true,
        mapHotspots: true,
        language: 'en'
      },
      _skipTodayValues: true,
      todayOrdersCount: 6,
      todayDistanceKm: 18.4,
      todayOnlineHours: 4.2,
      activeOrderId: null,
      activeOrder: null,
      activeOrders: [],
      lat: BHUSAWAL_CENTER[0],
      lng: BHUSAWAL_CENTER[1]
    };
    saveRiderState(defaultState);
    return defaultState;
  }

  function saveRiderState(state) {
    try {
      localStorage.setItem(AUTH_KEY, JSON.stringify(state));
      // Sync into rider pool for dispatch engines
      var pool = JSON.parse(localStorage.getItem('bhusawal_riders_pool') || '[]');
      var idx = pool.findIndex(function(r) { return r.phone === state.phone || r.id === state.id; });
      var riderItem = {
        id: state.id || 'BHU-RIDER-8942',
        name: state.fullName,
        phone: state.phone,
        vehicleType: state.vehicleType,
        bikeNo: state.bikeNo,
        isOnline: !!state.isOnline,
        isVerified: !!state.kycApproved,
        isActive: !!state.kycApproved,
        state: state.state || (state.isOnline ? 'AVAILABLE' : 'OFFLINE'),
        activeOrders: state.activeOrders || [],
        lat: state.lat || BHUSAWAL_CENTER[0],
        lng: state.lng || BHUSAWAL_CENTER[1],
        rating: 4.9,
        zone: state.area || 'Station Road',
        isPassengerLocked: !!state.isPassengerLocked
      };
      if (idx >= 0) pool[idx] = riderItem;
      else pool.unshift(riderItem);
      localStorage.setItem('bhusawal_riders_pool', JSON.stringify(pool));
    } catch(e) {}
  }

  // 2. INITIALIZE LIVE MAP (OPTIMIZED FOR BHUSAWAL SERVICE ZONE & MOBILE BROWSERS)
  function initLiveMap() {
    if (map || typeof L === 'undefined') return;
    var container = document.getElementById('rider-live-map');
    if (!container) return;

    map = L.map('rider-live-map', {
      zoomControl: false, // Replaced with touch-friendly thumb controls on right
      attributionControl: false
    }).setView([currentGPS.lat, currentGPS.lng], 15);

    // High performance CartoDB Voyager tiles (smooth raster rendering on mid/low-range phones)
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      maxZoom: 19
    }).addTo(map);

    // Service Area Boundary
    servicePolygon = L.polygon(BHUSAWAL_BOUNDARY, {
      color: '#2563EB',
      weight: 2,
      dashArray: '6, 6',
      fillColor: '#3B82F6',
      fillOpacity: 0.06
    }).addTo(map);

    // Location Accuracy Circle
    accuracyCircle = L.circle([currentGPS.lat, currentGPS.lng], {
      radius: currentGPS.accuracy || 8,
      color: '#3B82F6',
      weight: 1,
      opacity: 0.7,
      fillColor: '#60A5FA',
      fillOpacity: 0.12,
      interactive: false
    }).addTo(map);

    // Directional Pulsing Rider Marker with Heading Rotator
    var riderIcon = L.divIcon({
      className: 'rider-custom-marker-wrapper',
      html: 
        '<div class="relative flex items-center justify-center -ml-5 -mt-5" style="width: 40px; height: 40px;">' +
          '<div class="w-10 h-10 rounded-full bg-blue-500/25 animate-ping absolute pointer-events-none"></div>' +
          '<div id="rider-bike-heading-rotator" class="w-10 h-10 rounded-full bg-blue-600 border-2 border-white shadow-2xl flex items-center justify-center text-white relative z-10 transition-transform duration-300" style="transform: rotate(' + currentGPS.heading + 'deg);">' +
            '<span class="material-symbols-outlined text-xl">two_wheeler</span>' +
          '</div>' +
        '</div>',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    riderMarker = L.marker([currentGPS.lat, currentGPS.lng], { icon: riderIcon, zIndexOffset: 1000 }).addTo(map);

    // Map drag detection: Auto-follow pauses when user moves the map manually
    map.on('dragstart', function() {
      isFollowRider = false;
      updateRecenterButtonUI();
    });

    // Render Nearby Pickup Hotspots
    renderHotspots();

    // Start Live Production GPS Geolocation Tracker
    startLiveGPSTracker();

    setTimeout(function() {
      if (map) map.invalidateSize();
    }, 250);
  }

  // Real Production Geolocation Tracker (Low-Power, Throttled & Battery-Optimized)
  function startLiveGPSTracker() {
    if (gpsWatchId) return;

    if (typeof navigator !== 'undefined' && navigator.geolocation) {
      updateGPSBadgeUI(12, true, 'Acquiring GPS...');
      gpsWatchId = navigator.geolocation.watchPosition(
        function(pos) {
          handleLiveGPSUpdate(pos.coords);
        },
        function(err) {
          console.warn('Rider device GPS warning:', err.code, err.message);
          // Graceful simulated drift in local testing environment
          handleGPSFallbackDrift();
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 2000
        }
      );
    } else {
      handleGPSFallbackDrift();
    }
  }

  function handleLiveGPSUpdate(coords) {
    if (!coords || typeof coords.latitude !== 'number') return;
    var lat = coords.latitude;
    var lng = coords.longitude;
    var accuracy = Math.round(coords.accuracy || 8);
    var speed = coords.speed ? Math.round(coords.speed * 3.6) : 0;
    var heading = coords.heading;

    // Throttle jitter: If movement is less than 1.5m and rider is stationary, avoid full repaint
    var distMoved = calculateDistanceMeters(currentGPS.lat, currentGPS.lng, lat, lng);
    if (distMoved < 1.5 && speed === 0 && currentGPS.isLive) {
      return;
    }

    // Compute heading direction if device heading is null/NaN
    if (isNaN(heading) || heading === null) {
      if (distMoved >= 2) {
        heading = calculateBearing(currentGPS.lat, currentGPS.lng, lat, lng);
      } else {
        heading = currentGPS.heading || 0;
      }
    }

    currentGPS.lat = lat;
    currentGPS.lng = lng;
    currentGPS.heading = heading;
    currentGPS.speed = speed;
    currentGPS.accuracy = accuracy;
    currentGPS.isLive = true;
    currentGPS.timestamp = Date.now();

    updateGPSBadgeUI(accuracy, true);
    updateRiderMapPosition(lat, lng, heading, accuracy);

    // Sync into state for dispatch engines
    var st = getRiderState();
    st.lat = lat;
    st.lng = lng;
    saveRiderState(st);
  }

  // Graceful simulation drift when device GPS is unavailable or stationary
  var fallbackStep = 0;
  function handleGPSFallbackDrift() {
    updateGPSBadgeUI(currentGPS.accuracy || 8, false, 'Simulated GPS');
    if (window._gpsDriftInterval) return;
    window._gpsDriftInterval = setInterval(function() {
      var st = getRiderState();
      if (!st.isOnline) return;

      fallbackStep++;
      var baseLat = BHUSAWAL_CENTER[0];
      var baseLng = BHUSAWAL_CENTER[1];
      var newLat = baseLat + (Math.sin(fallbackStep * 0.15) * 0.0025);
      var newLng = baseLng + (Math.cos(fallbackStep * 0.15) * 0.0035);
      var heading = calculateBearing(currentGPS.lat, currentGPS.lng, newLat, newLng);

      handleLiveGPSUpdate({
        latitude: newLat,
        longitude: newLng,
        accuracy: 8,
        speed: 22,
        heading: heading
      });
    }, 4000);
  }

  // Updates Rider Marker, Heading Angle and Accuracy Circle without destroying DOM elements
  function updateRiderMapPosition(lat, lng, heading, accuracy) {
    if (!map) return;

    if (riderMarker) {
      riderMarker.setLatLng([lat, lng]);
      var rotator = document.getElementById('rider-bike-heading-rotator');
      if (rotator) {
        rotator.style.transform = 'rotate(' + (heading || 0) + 'deg)';
      }
    }

    if (accuracyCircle) {
      accuracyCircle.setLatLng([lat, lng]);
      accuracyCircle.setRadius(Math.max(5, Math.min(accuracy || 8, 120)));
    }

    // Auto-recenter / Follow Rider
    if (isFollowRider) {
      map.panTo([lat, lng], { animate: true, duration: 0.4 });
    }

    // Dynamically re-anchor start point of active route polyline
    if (activeRouteLine) {
      var pts = activeRouteLine.getLatLngs();
      if (pts.length > 0) {
        pts[0] = L.latLng(lat, lng);
        activeRouteLine.setLatLngs(pts);
      }
    }
    if (passengerRouteLine) {
      var pPts = passengerRouteLine.getLatLngs();
      if (pPts.length > 0) {
        pPts[0] = L.latLng(lat, lng);
        passengerRouteLine.setLatLngs(pPts);
        if (passengerGlowLine) passengerGlowLine.setLatLngs(pPts);
      }
    }
  }

  // Updates Location Accuracy Indicator on the HUD
  function updateGPSBadgeUI(accuracy, isReal, statusText) {
    var badgeText = document.getElementById('gps-accuracy-text');
    var badgeDot = document.getElementById('gps-status-dot');
    if (!badgeText) return;

    if (statusText) {
      badgeText.textContent = statusText;
      return;
    }

    if (accuracy <= 15) {
      badgeText.textContent = 'GPS: ±' + accuracy + 'm';
      if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse';
    } else if (accuracy <= 35) {
      badgeText.textContent = 'GPS: ±' + accuracy + 'm';
      if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-amber-400';
    } else {
      badgeText.textContent = 'GPS: ±' + accuracy + 'm';
      if (badgeDot) badgeDot.className = 'w-2 h-2 rounded-full bg-rose-400';
    }
  }

  function updateRecenterButtonUI() {
    var btn = document.getElementById('btn-map-recenter');
    var ind = document.getElementById('recenter-follow-indicator');
    if (!btn) return;
    if (isFollowRider) {
      btn.className = 'w-10 h-10 rounded-xl bg-slate-900/90 text-blue-400 border-2 border-blue-500 shadow-xl flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-all cursor-pointer relative';
      if (ind) ind.classList.remove('hidden');
    } else {
      btn.className = 'w-10 h-10 rounded-xl bg-slate-900/90 text-slate-400 border border-slate-700/80 shadow-xl flex items-center justify-center hover:bg-slate-800 active:scale-95 transition-all cursor-pointer relative';
      if (ind) ind.classList.add('hidden');
    }
  }

  function renderHotspots() {
    if (!map) return;
    hotspotMarkers.forEach(function(m) { map.removeLayer(m); });
    hotspotMarkers = [];

    HOTSPOTS.forEach(function(h) {
      var icon = L.divIcon({
        className: 'hotspot-custom-marker',
        html: 
          '<div class="group relative flex items-center justify-center -ml-2 -mt-2 cursor-pointer">' +
            '<div class="w-7 h-7 rounded-full ' + h.color + ' text-white border-2 border-white shadow-lg flex items-center justify-center">' +
              '<span class="material-symbols-outlined text-xs">' + h.icon + '</span>' +
            '</div>' +
            '<div class="absolute bottom-8 left-1/2 -translate-x-1/2 bg-slate-900/90 text-white text-[9px] font-bold px-2 py-0.5 rounded shadow pointer-events-none whitespace-nowrap hidden group-hover:block border border-slate-700">' +
              h.name +
            '</div>' +
          '</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      });
      var m = L.marker(h.coords, { icon: icon });
      m.bindPopup('<strong class="text-xs font-black text-slate-900">' + h.name + '</strong><br><span class="text-[10px] text-slate-600">BSL High-Demand Zone</span>');
      if (isHotspotsVisible) m.addTo(map);
      hotspotMarkers.push(m);
    });
  }

  function hideHotspots() {
    if (!map) return;
    hotspotMarkers.forEach(function(m) { map.removeLayer(m); });
  }

  function showHotspots() {
    if (!map || !isHotspotsVisible) return;
    hotspotMarkers.forEach(function(m) { m.addTo(map); });
  }

  // 3. DYNAMIC MULTI-STOP ROUTE & PASSENGER MAP ENGINE
  function clearAllRoutes() {
    if (!map) return;

    routeMarkers.forEach(function(m) { map.removeLayer(m); });
    routeMarkers = [];

    passengerMarkers.forEach(function(m) { map.removeLayer(m); });
    passengerMarkers = [];

    if (activeRouteLine) {
      map.removeLayer(activeRouteLine);
      activeRouteLine = null;
    }
    if (passengerRouteLine) {
      map.removeLayer(passengerRouteLine);
      passengerRouteLine = null;
    }
    if (passengerGlowLine) {
      map.removeLayer(passengerGlowLine);
      passengerGlowLine = null;
    }
  }

  /**
   * Renders the complete dynamic map experience based on actual order state:
   * - No active orders: Shows rider GPS + Bhusawal demand hotspots
   * - 1 delivery order: Rider -> Pickup -> Customer Drop (or Rider -> Drop if picked up)
   * - Multiple delivery orders: Rider -> Pickup 1 -> Pickup 2 -> Drop 1 -> Drop 2 (sequenced)
   * - Passenger mode active: Prominent dedicated passenger route, zero clutter!
   */
  function renderDynamicRouteMap(activeOrders, state) {
    if (!map) return;
    clearAllRoutes();

    state = state || getRiderState();
    var riderPos = { lat: currentGPS.lat || BHUSAWAL_CENTER[0], lng: currentGPS.lng || BHUSAWAL_CENTER[1] };
    var riderState = state.state || 'AVAILABLE';

    var isPassenger = (
      riderState === 'PASSENGER_PICKUP' ||
      riderState === 'PASSENGER_ACTIVE' ||
      riderState === 'PASSENGER_COMPLETED' ||
      state.isPassengerLocked ||
      (window.BslFleetEngine && window.BslFleetEngine.isPassengerMode(state))
    );

    // ====================================================================
    // CASE 1: PASSENGER MODE ACTIVE (PROMINENT ROUTE, ZERO CLUTTER)
    // ====================================================================
    if (isPassenger) {
      hideHotspots(); // STRICTLY HIDE ALL ORDER DEMAND HOTSPOTS IN PASSENGER MODE

      var curRide = (activeOrders && activeOrders[0]) || {};
      var passName = curRide.passengerName || curRide.customerName || 'Amit Sharma';
      var pickupAddr = curRide.pickupAddress || 'Bhusawal Railway Station (Platform 1 Exit)';
      var dropAddr = curRide.dropAddress || 'Jamner Road Municipal Shopping Complex';
      var pickupCoords = [Number(curRide.pickupLat || 21.0495), Number(curRide.pickupLng || 75.7870)];
      var dropCoords = [Number(curRide.dropLat || 21.0410), Number(curRide.dropLng || 75.7920)];

      var polylineCoords = [[riderPos.lat, riderPos.lng]];

      if (riderState === 'PASSENGER_PICKUP') {
        // Stage 1: Rider -> Passenger Pickup
        polylineCoords.push(pickupCoords);

        // Passenger Pickup Marker (Golden Taxi Hail Badge)
        var pickupIcon = L.divIcon({
          className: 'passenger-pickup-marker',
          html: 
            '<div class="relative flex items-center justify-center -ml-4 -mt-4 cursor-pointer">' +
              '<div class="w-10 h-10 rounded-full bg-amber-400/40 animate-ping absolute pointer-events-none"></div>' +
              '<div class="w-9 h-9 rounded-full bg-amber-400 border-2 border-slate-950 shadow-2xl flex items-center justify-center text-slate-950 font-black text-sm relative z-10">' +
                '<span class="material-symbols-outlined text-base">hail</span>' +
              '</div>' +
              '<div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-amber-400 text-slate-950 text-[9px] font-black px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">' +
                'Pickup: ' + passName.split(' ')[0] +
              '</div>' +
            '</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        var mPickup = L.marker(pickupCoords, { icon: pickupIcon }).addTo(map);
        mPickup.bindPopup('<strong class="text-xs font-black text-slate-900">Passenger Pickup</strong><br><span class="text-[11px] text-slate-600">' + passName + '<br>' + pickupAddr + '</span>');
        passengerMarkers.push(mPickup);

        // Preview Destination Marker
        var destPreviewIcon = L.divIcon({
          className: 'passenger-dest-preview-marker',
          html: 
            '<div class="relative flex items-center justify-center -ml-3 -mt-3 opacity-80 cursor-pointer">' +
              '<div class="w-7 h-7 rounded-full bg-blue-600 border border-white shadow-md flex items-center justify-center text-white text-xs">' +
                '<span class="material-symbols-outlined text-xs">sports_score</span>' +
              '</div>' +
            '</div>',
          iconSize: [28, 28],
          iconAnchor: [14, 14]
        });
        var mDest = L.marker(dropCoords, { icon: destPreviewIcon }).addTo(map);
        mDest.bindPopup('<strong class="text-xs font-black text-slate-900">Trip Destination</strong><br><span class="text-[11px] text-slate-600">' + dropAddr + '</span>');
        passengerMarkers.push(mDest);

      } else {
        // Stage 2: PASSENGER ON BOARD (Rider -> Destination)
        polylineCoords.push(dropCoords);

        var dropIcon = L.divIcon({
          className: 'passenger-drop-marker',
          html: 
            '<div class="relative flex items-center justify-center -ml-4 -mt-4 cursor-pointer">' +
              '<div class="w-10 h-10 rounded-full bg-blue-500/40 animate-ping absolute pointer-events-none"></div>' +
              '<div class="w-9 h-9 rounded-full bg-blue-600 border-2 border-white shadow-2xl flex items-center justify-center text-white font-black text-sm relative z-10">' +
                '<span class="material-symbols-outlined text-base">sports_score</span>' +
              '</div>' +
              '<div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap">' +
                'Passenger Destination' +
              '</div>' +
            '</div>',
          iconSize: [36, 36],
          iconAnchor: [18, 18]
        });
        var mDrop = L.marker(dropCoords, { icon: dropIcon }).addTo(map);
        mDrop.bindPopup('<strong class="text-xs font-black text-slate-900">Passenger Drop Destination</strong><br><span class="text-[11px] text-slate-600">' + dropAddr + '</span>');
        passengerMarkers.push(mDrop);
      }

      // Dedicated Glowing Passenger Route Polylines
      passengerGlowLine = L.polyline(polylineCoords, {
        color: '#F59E0B',
        weight: 10,
        opacity: 0.35,
        lineCap: 'round'
      }).addTo(map);

      passengerRouteLine = L.polyline(polylineCoords, {
        color: '#D97706',
        weight: 5,
        opacity: 0.95,
        lineCap: 'round'
      }).addTo(map);

      try {
        map.fitBounds(passengerRouteLine.getBounds(), { padding: [80, 80], maxZoom: 16 });
      } catch(e) {}
      return;
    }

    // ====================================================================
    // CASE 2: NO ACTIVE ORDERS (AVAILABLE OR OFFLINE)
    // ====================================================================
    if (!Array.isArray(activeOrders) || activeOrders.length === 0) {
      showHotspots();
      if (isFollowRider) {
        map.panTo([riderPos.lat, riderPos.lng], { animate: true, duration: 0.5 });
      }
      return;
    }

    // ====================================================================
    // CASE 3 & 4: 1 ORDER OR MULTI-ORDER STACKED ROUTE
    // Generated dynamically from actual order state via BslRouteSequencer
    // ====================================================================
    hideHotspots();

    var computed = window.BslRouteSequencer
      ? window.BslRouteSequencer.computeOptimalRoute(state, activeOrders)
      : null;

    var stops = (computed && computed.stops && computed.stops.length > 0)
      ? computed.stops
      : buildFallbackStops(activeOrders);

    if (stops.length === 0) return;

    var polylinePoints = [[riderPos.lat, riderPos.lng]];

    stops.forEach(function(stop, idx) {
      var isPickup = (stop.stopType === 'PICKUP');
      var isFirst = (idx === 0);
      var stopNum = idx + 1;

      var bgColor = isPickup ? (isFirst ? 'bg-amber-500' : 'bg-amber-600') : (isFirst ? 'bg-blue-600' : 'bg-indigo-600');
      var borderColor = isFirst ? 'border-white ring-2 ring-emerald-400' : 'border-white';
      var pulseRing = isFirst ? '<div class="w-10 h-10 rounded-full bg-blue-500/30 animate-ping absolute pointer-events-none"></div>' : '';

      var markerIcon = L.divIcon({
        className: 'route-stop-marker',
        html: 
          '<div class="relative flex items-center justify-center -ml-4 -mt-4 cursor-pointer">' +
            pulseRing +
            '<div class="w-8 h-8 rounded-full ' + bgColor + ' ' + borderColor + ' shadow-xl flex items-center justify-center text-white font-black text-xs relative z-10">' +
              stopNum +
            '</div>' +
            '<div class="absolute -bottom-5 left-1/2 -translate-x-1/2 bg-slate-900/90 text-[9px] font-bold text-slate-200 px-1.5 py-0.5 rounded shadow pointer-events-none whitespace-nowrap border border-slate-700">' +
              (isPickup ? '🏪 ' + (stop.orderType || 'Pickup') : '📍 Drop #' + stopNum) +
            '</div>' +
          '</div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16]
      });

      var marker = L.marker([stop.lat, stop.lng], { icon: markerIcon }).addTo(map);
      marker.bindPopup(
        '<div class="text-xs space-y-1 p-1">' +
          '<div class="font-black text-slate-900">Stop ' + stopNum + ': ' + (stop.label || stop.address) + '</div>' +
          '<div class="text-[10px] text-slate-500 font-bold">' + stop.orderType + ' • ' + stop.stopType + '</div>' +
          '<a href="https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(stop.address + ', Bhusawal') + '&travelmode=driving" target="_blank" class="inline-block mt-1 text-[11px] font-bold text-blue-600 underline">' +
            'Open Google Maps' +
          '</a>' +
        '</div>'
      );

      routeMarkers.push(marker);
      polylinePoints.push([stop.lat, stop.lng]);
    });

    activeRouteLine = L.polyline(polylinePoints, {
      color: '#3B82F6',
      weight: 5,
      opacity: 0.9,
      dashArray: '8, 8',
      lineCap: 'round'
    }).addTo(map);

    try {
      map.fitBounds(activeRouteLine.getBounds(), { padding: [75, 75], maxZoom: 16 });
    } catch(e) {}
  }

  function buildFallbackStops(activeOrders) {
    var list = [];
    activeOrders.forEach(function(o) {
      var isPickedUp = (o.status === 'PICKED_UP' || o.status === 'DELIVERING');
      if (!isPickedUp) {
        list.push({
          stopType: 'PICKUP',
          label: o.store || o.pickupAddress || 'Store Pickup',
          address: o.pickupAddress || o.store || 'Bhusawal Store',
          lat: Number(o.pickupLat || BHUSAWAL_CENTER[0]),
          lng: Number(o.pickupLng || BHUSAWAL_CENTER[1]),
          orderType: (o.type || 'GROCERY').toUpperCase()
        });
      }
      list.push({
        stopType: 'DROP',
        label: o.dropAddress || o.address || 'Customer Drop',
        address: o.dropAddress || o.address || 'Bhusawal Customer',
        lat: Number(o.dropLat || 21.0425),
        lng: Number(o.dropLng || 75.7980),
        orderType: (o.type || 'GROCERY').toUpperCase()
      });
    });
    return list;
  }


  // ====================================================================
  // EARNINGS, PROFILE & SINGLE WALLET CONTROLLERS
  // ====================================================================
  function showToast(msg, isError) {
    var toast = document.getElementById('toast-rider-feedback');
    var msgEl = document.getElementById('toast-feedback-msg');
    var iconEl = document.getElementById('toast-feedback-icon');
    if (!toast) {
      alert(msg);
      return;
    }
    if (msgEl) msgEl.textContent = msg;
    if (iconEl) {
      iconEl.textContent = isError ? 'error' : 'check_circle';
      iconEl.className = 'material-symbols-outlined text-base ' + (isError ? 'text-rose-400' : 'text-emerald-400');
    }
    toast.classList.remove('hidden');
    setTimeout(function() {
      toast.classList.add('hidden');
    }, 2800);
  }

  function renderEarningsSection(state) {
    state = state || getRiderState();
    var period = state.earningsTimeframe || 'today';
    var breakdown = (state.breakdown && state.breakdown[period]) || {
      total: state.todayEarnings || 684,
      jobs: state.todayOrdersCount || 12,
      distanceKm: state.todayDistanceKm || 24.6,
      onlineHours: state.todayOnlineHours || 5.5,
      cancelled: state.todayCancelledCount || 0,
      incentives: state.todayIncentives || 120,
      services: {
        GROCERY: { name: 'Grocery Delivery', icon: 'shopping_basket', amount: 210, jobs: 4, color: 'text-emerald-400', barBg: 'bg-emerald-500' },
        FOOD: { name: 'Food Delivery', icon: 'restaurant', amount: 182, jobs: 3, color: 'text-orange-400', barBg: 'bg-orange-500' },
        MEDICINE: { name: 'Medicine Delivery', icon: 'medical_services', amount: 72, jobs: 1, color: 'text-rose-400', barBg: 'bg-rose-500' },
        PARCEL: { name: 'Parcel Delivery', icon: 'inventory_2', amount: 96, jobs: 2, color: 'text-purple-400', barBg: 'bg-purple-500' },
        PICKUP_DROP: { name: 'Pickup & Drop', icon: 'swap_horiz', amount: 0, jobs: 0, color: 'text-cyan-400', barBg: 'bg-cyan-500' },
        PASSENGER: { name: 'Passenger Rides', icon: 'two_wheeler', amount: 124, jobs: 2, color: 'text-amber-400', barBg: 'bg-amber-500' }
      }
    };

    // Update active tab buttons
    document.querySelectorAll('.btn-timeframe-tab').forEach(function(btn) {
      if (btn.dataset.period === period) {
        btn.className = 'btn-timeframe-tab flex-1 py-2 text-xs font-black rounded-lg transition-all text-white bg-blue-600 shadow-md cursor-pointer';
      } else {
        btn.className = 'btn-timeframe-tab flex-1 py-2 text-xs font-bold rounded-lg transition-all text-slate-400 hover:text-slate-200 cursor-pointer';
      }
    });

    // Update Total Hero Card
    var badgeLabelEl = document.getElementById('timeframe-badge-label');
    var totalEarnEl = document.getElementById('wallet-earnings-display');
    var subSummaryEl = document.getElementById('timeframe-sub-summary');
    var incentiveBadgeEl = document.getElementById('timeframe-incentive-badge');

    var periodTitles = {
      today: "TODAY'S TOTAL EARNINGS",
      weekly: "THIS WEEK'S FLEET EARNINGS",
      monthly: "THIS MONTH'S FLEET EARNINGS"
    };

    if (badgeLabelEl) badgeLabelEl.textContent = periodTitles[period] || periodTitles.today;
    if (totalEarnEl) totalEarnEl.textContent = '₹' + (breakdown.total || 0).toLocaleString('en-IN');
    if (subSummaryEl) {
      subSummaryEl.textContent = (breakdown.jobs || 0) + ' completed jobs across Bhusawal';
    }
    if (incentiveBadgeEl) {
      incentiveBadgeEl.textContent = '+₹' + (breakdown.incentives || 0) + ' Incentives Included';
    }

    // Update Shift Metrics
    var distEl = document.getElementById('metric-earnings-distance');
    var timeEl = document.getElementById('metric-earnings-time');
    var compEl = document.getElementById('metric-earnings-completed');
    var cancEl = document.getElementById('metric-earnings-cancelled');
    var incEl = document.getElementById('metric-earnings-incentives');

    if (distEl) distEl.textContent = (breakdown.distanceKm || 0) + ' km';
    if (timeEl) timeEl.textContent = (breakdown.onlineHours || 0) + ' hrs';
    if (compEl) compEl.textContent = (breakdown.jobs || 0) + ' Jobs';
    if (cancEl) cancEl.textContent = (breakdown.cancelled || 0);
    if (incEl) incEl.textContent = '₹' + (breakdown.incentives || 0);

    // Update Combined Single Wallet Card
    var walletBalEl = document.getElementById('wallet-balance-val');
    var walletUpiEl = document.getElementById('wallet-upi-tag');
    if (walletBalEl) walletBalEl.textContent = '₹' + (state.walletBalance || 0).toLocaleString('en-IN');
    if (walletUpiEl) walletUpiEl.textContent = state.upiId || 'rahulpatil@okaxis';

    // Update 6-Service Breakdown List
    var container = document.getElementById('container-service-breakdown');
    var totalJobsCountEl = document.getElementById('breakdown-total-jobs-count');
    if (totalJobsCountEl) totalJobsCountEl.textContent = (breakdown.jobs || 0) + ' Jobs Total';

    if (container && breakdown.services) {
      container.innerHTML = '';
      var total = breakdown.total || 1;

      var serviceKeys = ['GROCERY', 'FOOD', 'MEDICINE', 'PARCEL', 'PICKUP_DROP', 'PASSENGER'];
      serviceKeys.forEach(function(key) {
        var s = breakdown.services[key] || { name: key, icon: 'receipt', amount: 0, jobs: 0, color: 'text-slate-300', barBg: 'bg-blue-500' };
        var pct = Math.round((s.amount / (total || 1)) * 100) || 0;

        var row = document.createElement('div');
        row.className = 'p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80 space-y-1.5';
        row.innerHTML = 
          '<div class="flex items-center justify-between text-xs">' +
            '<div class="flex items-center gap-2">' +
              '<span class="material-symbols-outlined text-sm ' + s.color + '">' + s.icon + '</span>' +
              '<span class="font-extrabold text-white">' + s.name + '</span>' +
            '</div>' +
            '<div class="flex items-center gap-2">' +
              '<span class="text-[10px] text-slate-400 font-bold">' + s.jobs + ' ' + (s.jobs === 1 ? 'job' : 'jobs') + '</span>' +
              '<span class="font-black text-white font-display">₹' + s.amount.toLocaleString('en-IN') + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden flex">' +
            '<div class="h-full ' + s.barBg + ' transition-all duration-500 rounded-full" style="width: ' + pct + '%"></div>' +
          '</div>';
        container.appendChild(row);
      });
    }

    // Update Settlements Log
    var historyContainer = document.getElementById('container-payout-history');
    if (historyContainer && Array.isArray(state.payoutHistory) && state.payoutHistory.length > 0) {
      historyContainer.innerHTML = '';
      state.payoutHistory.forEach(function(item) {
        var isUpi = item.type === 'UPI_INSTANT';
        var iconName = isUpi ? 'north_east' : (item.type === 'BONUS' ? 'military_tech' : 'account_balance');
        var iconColor = isUpi ? 'bg-emerald-500/20 text-emerald-400' : (item.type === 'BONUS' ? 'bg-amber-500/20 text-amber-400' : 'bg-blue-500/20 text-blue-400');
        var row = document.createElement('div');
        row.className = 'flex items-center justify-between p-2.5 rounded-xl bg-slate-950/70 border border-slate-800/80';
        row.innerHTML = 
          '<div class="flex items-center gap-2">' +
            '<div class="w-7 h-7 rounded-lg ' + iconColor + ' flex items-center justify-center font-bold">' +
              '<span class="material-symbols-outlined text-sm">' + iconName + '</span>' +
            '</div>' +
            '<div>' +
              '<span class="font-extrabold text-white block">' + item.title + '</span>' +
              '<span class="text-[10px] text-slate-400">' + item.desc + '</span>' +
            '</div>' +
          '</div>' +
          '<div class="text-right">' +
            '<span class="font-black ' + (isUpi ? 'text-emerald-400' : 'text-slate-200') + ' block font-display">₹' + item.amount.toLocaleString('en-IN') + '</span>' +
            '<span class="text-[9px] text-slate-500 font-bold">' + (item.time || item.status) + '</span>' +
          '</div>';
        historyContainer.appendChild(row);
      });
    }
  }

  function renderProfileSection(state) {
    state = state || getRiderState();
    var profileName = document.getElementById('dash-driver-name');
    var profilePhone = document.getElementById('dash-phone');
    var profileBike = document.getElementById('dash-bike-no');
    var profileUpi = document.getElementById('profile-upi-display');
    var topAvatar = document.getElementById('top-avatar-initials');
    var dashAvatar = document.getElementById('dash-avatar');
    var kycBadge = document.getElementById('kyc-badge-display');
    var kycAdminBtnText = document.getElementById('btn-admin-toggle-text');

    if (profileName) profileName.textContent = state.fullName || 'Rahul Ramesh Patil';
    if (profilePhone) profilePhone.textContent = state.phone ? ('+91 ' + state.phone) : '+91 9876543210';
    if (profileBike) profileBike.textContent = state.bikeNo || 'MH 19 AX 4892';
    if (profileUpi) profileUpi.textContent = state.upiId || 'rahulpatil@okaxis';

    var initials = 'RP';
    if (state.fullName) {
      var parts = state.fullName.trim().split(/\s+/);
      initials = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    }
    if (topAvatar) topAvatar.textContent = initials;
    if (dashAvatar) dashAvatar.textContent = initials;

    if (kycBadge) {
      if (state.kycApproved) {
        kycBadge.className = 'inline-flex items-center gap-1 bg-emerald-500/20 text-emerald-300 text-[10px] font-black px-2 py-0.5 rounded border border-emerald-500/30';
        kycBadge.innerHTML = '<span class="material-symbols-outlined text-xs">check_circle</span> KYC Approved & Active';
      } else {
        kycBadge.className = 'inline-flex items-center gap-1 bg-amber-500/20 text-amber-300 text-[10px] font-black px-2 py-0.5 rounded border border-amber-500/30';
        kycBadge.innerHTML = '<span class="material-symbols-outlined text-xs">pending</span> KYC Pending Verification';
      }
    }

    if (kycAdminBtnText) {
      kycAdminBtnText.textContent = state.kycApproved ? 'Revoke KYC (Simulate Pending)' : 'Approve KYC (Simulate Verified)';
    }

    // Set settings toggles
    var chimeToggle = document.getElementById('setting-order-chime');
    var hotspotsToggle = document.getElementById('setting-map-hotspots');
    var langSelect = document.getElementById('setting-app-language');

    if (chimeToggle && state.settings) chimeToggle.checked = (state.settings.orderChime !== false);
    if (hotspotsToggle && state.settings) hotspotsToggle.checked = (state.settings.mapHotspots !== false);
    if (langSelect && state.settings && state.settings.language) langSelect.value = state.settings.language;
  }

  // 4. RENDER DYNAMIC STATE DRAWER & ACTIVE ROUTE HUD
  function renderHomeView(state) {
    state = state || getRiderState();

    // Containers
    var cardOffline = document.getElementById('state-offline-card');
    var cardAvailable = document.getElementById('state-available-card');
    var cardPassenger = document.getElementById('state-passenger-active-card');
    var cardActiveRoute = document.getElementById('state-active-route-card');

    if (!cardOffline) return;

    // Reset drawer state visibility
    cardOffline.classList.add('hidden');
    cardAvailable.classList.add('hidden');
    cardPassenger.classList.add('hidden');
    if (cardActiveRoute) cardActiveRoute.classList.add('hidden');

    // Update Top Summary HUD Values
    var sumEarn = document.getElementById('summary-today-earnings');
    var sumOrd = document.getElementById('summary-today-orders');
    var sumDist = document.getElementById('summary-today-dist');
    var sumTime = document.getElementById('summary-today-time');

    if (sumEarn) sumEarn.textContent = '₹' + (state.todayEarnings || 640).toLocaleString('en-IN');
    if (sumOrd) sumOrd.textContent = state.todayOrdersCount || 6;
    if (sumDist) sumDist.textContent = (state.todayDistanceKm || 18.4) + ' km';
    if (sumTime) sumTime.textContent = (state.todayOnlineHours || 4.2) + 'h';

    // Update Profile & Wallet Tab values
    var walletEarn = document.getElementById('wallet-earnings-display');
    var walletBal = document.getElementById('wallet-balance-val');
    var walletUpi = document.getElementById('wallet-upi-tag');
    var profileName = document.getElementById('dash-driver-name');
    var profilePhone = document.getElementById('dash-phone');
    var profileBike = document.getElementById('dash-bike-no');
    var topAvatar = document.getElementById('top-avatar-initials');

    if (walletEarn) walletEarn.textContent = '₹' + (state.todayEarnings || 640);
    if (walletBal) walletBal.textContent = '₹' + (state.walletBalance || 1240).toLocaleString('en-IN');
    if (walletUpi) walletUpi.textContent = state.upiId || 'rahulpatil@okaxis';
    if (profileName) profileName.textContent = state.fullName || 'Rahul Ramesh Patil';
    if (profilePhone) profilePhone.textContent = state.phone ? ('+91 ' + state.phone) : '+91 9876543210';
    if (profileBike) profileBike.textContent = state.bikeNo || 'MH 19 AX 4892';
    if (topAvatar) {
      var parts = (state.fullName || 'Rahul Patil').trim().split(/\s+/);
      topAvatar.textContent = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase() : parts[0].substring(0, 2).toUpperCase();
    }

    // Top Duty Control Elements
    var dutyBtn = document.getElementById('btn-toggle-duty');
    var dutyBtnText = document.getElementById('btn-duty-text');
    var dutyBtnDot = document.getElementById('duty-btn-dot');
    var dutyHeadline = document.getElementById('duty-banner-headline');
    var dutySubtext = document.getElementById('duty-banner-subtext');

    // CASE 1: OFF DUTY / OFFLINE
    if (!state.isOnline) {
      if (dutyBtn) {
        dutyBtn.className = 'shrink-0 px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer bg-rose-500 hover:bg-rose-600 text-white shadow-rose-500/20';
      }
      if (dutyBtnText) dutyBtnText.textContent = '🔴 OFF DUTY';
      if (dutyBtnDot) dutyBtnDot.className = 'w-2.5 h-2.5 rounded-full bg-white';
      if (dutyHeadline) dutyHeadline.textContent = "You're offline. You won't receive new orders.";
      if (dutySubtext) dutySubtext.textContent = 'Turn duty ON to receive deliveries and rides across Bhusawal.';
      cardOffline.classList.remove('hidden');
      renderDynamicRouteMap([], state);
      return;
    }

    // CASE 2: ON DUTY
    if (dutyBtn) {
      dutyBtn.className = 'shrink-0 px-3.5 py-2 rounded-xl font-black text-xs flex items-center gap-1.5 shadow-md transition-all active:scale-95 cursor-pointer bg-emerald-500 hover:bg-emerald-600 text-slate-950 shadow-emerald-500/20';
    }
    if (dutyBtnText) dutyBtnText.textContent = '🟢 ON DUTY';
    if (dutyBtnDot) dutyBtnDot.className = 'w-2.5 h-2.5 rounded-full bg-slate-950 animate-pulse';
    if (dutyHeadline) dutyHeadline.textContent = "You're available for orders.";

    var riderState = state.state || 'AVAILABLE';
    var activeOrders = state.activeOrders || [];
    if (activeOrders.length === 0 && state.activeOrderId) {
      activeOrders = [state.activeOrder || { id: state.activeOrderId, type: 'GROCERY' }];
    }

    var isPassengerMode = (
      riderState === 'PASSENGER_PICKUP' ||
      riderState === 'PASSENGER_ACTIVE' ||
      riderState === 'PASSENGER_COMPLETED' ||
      state.isPassengerLocked ||
      (window.BslFleetEngine && window.BslFleetEngine.isPassengerMode(state))
    );

    // -------------------------------------------------------------
    // CASE 2A: PASSENGER TRIP ACTIVE (100% EXCLUSIVE WORKFLOW)
    // -------------------------------------------------------------
    if (isPassengerMode) {
      if (dutySubtext) dutySubtext.textContent = '🛵 Passenger trip active • Other orders paused';
      cardPassenger.classList.remove('hidden');

      var curRide = activeOrders[0] || {};
      var pNameEl = document.getElementById('card-passenger-name');
      var pPickupEl = document.getElementById('card-passenger-pickup');
      var pDropEl = document.getElementById('card-passenger-drop-landmark');
      var pFareEl = document.getElementById('card-passenger-fare');
      var pBtnText = document.getElementById('btn-card-passenger-stage-text');
      var pNavText = document.getElementById('btn-card-passenger-nav-text');
      var pStageBadge = document.getElementById('text-passenger-stage-badge');
      var pCallBtn = document.getElementById('card-passenger-call');

      var passName = curRide.passengerName || curRide.customerName || 'Amit Sharma';
      var pickupAddr = curRide.pickupAddress || 'Bhusawal Railway Station (Platform 1 Exit)';
      var dropAddr = curRide.dropAddress || 'Jamner Road Municipal Shopping Complex';
      var fareAmount = curRide.fare || curRide.payout || curRide.total || 55;
      var passPhone = curRide.phone || curRide.passengerPhone || '9876543210';

      if (pNameEl) pNameEl.textContent = passName;
      if (pPickupEl) pPickupEl.textContent = pickupAddr;
      if (pDropEl) pDropEl.textContent = dropAddr;
      if (pFareEl) pFareEl.textContent = 'Fare: ₹' + fareAmount;
      if (pCallBtn) pCallBtn.href = 'tel:' + passPhone;

      var boxPickup = document.getElementById('box-passenger-pickup');
      var boxDrop = document.getElementById('box-passenger-drop');

      if (riderState === 'PASSENGER_PICKUP') {
        // STAGE 1: GOING TO PASSENGER PICKUP
        if (pStageBadge) pStageBadge.textContent = 'PASSENGER PICKUP';
        if (pBtnText) pBtnText.textContent = 'Verify Boarding OTP & Start Ride';
        if (pNavText) pNavText.textContent = '🧭 Navigate to Pickup';

        if (boxPickup) boxPickup.className = 'p-2 bg-slate-900/90 rounded-lg border-2 border-amber-400/80 shadow-md flex items-start gap-2';
        if (boxDrop) boxDrop.className = 'p-2 bg-slate-900/90 rounded-lg border border-slate-800 opacity-70 flex items-start gap-2';

        var passPickupStops = [{
          lat: Number(curRide.pickupLat || 21.0495),
          lng: Number(curRide.pickupLng || 75.7870),
          stopType: 'PICKUP',
          label: 'Pickup: ' + passName,
          orderType: 'PASSENGER',
          address: pickupAddr
        }];
        renderDynamicRouteMap(activeOrders, state);
      } else {
        // STAGE 2: PASSENGER ON BOARD (PASSENGER_ACTIVE)
        if (pStageBadge) pStageBadge.textContent = 'PASSENGER ON BOARD';
        if (pBtnText) pBtnText.textContent = 'END RIDE / PASSENGER DROPPED';
        if (pNavText) pNavText.textContent = '🧭 Navigate to Destination';

        if (boxPickup) boxPickup.className = 'p-2 bg-slate-900/90 rounded-lg border border-slate-800 opacity-60 flex items-start gap-2';
        if (boxDrop) boxDrop.className = 'p-2 bg-slate-900/90 rounded-lg border-2 border-blue-500/80 shadow-md flex items-start gap-2';

        var passDropStops = [{
          lat: Number(curRide.dropLat || 21.0410),
          lng: Number(curRide.dropLng || 75.7920),
          stopType: 'DROP',
          label: 'Destination: ' + dropAddr,
          orderType: 'PASSENGER',
          address: dropAddr
        }];
        renderDynamicRouteMap(activeOrders, state);
      }
      return;
    }

    // -------------------------------------------------------------
    // CASE 2B: ACTIVE DELIVERY ROUTE (1 OR MULTI-ORDER STACKED)
    // -------------------------------------------------------------
    if (activeOrders.length >= 1 && cardActiveRoute) {
      cardActiveRoute.classList.remove('hidden');

      // Call BslRouteSequencer to compute global optimal topological route
      var computed = window.BslRouteSequencer
        ? window.BslRouteSequencer.computeOptimalRoute(state, activeOrders)
        : null;

      if (!computed || computed.allOrdersCompleted || computed.stops.length === 0) {
        // All orders in batch were completed! Transition rider to AVAILABLE
        state.state = 'AVAILABLE';
        state.activeOrderId = null;
        state.activeOrders = [];
        saveRiderState(state);
        alert('🎉 All assigned deliveries completed! Wallet updated. Ready for next orders.');
        renderHomeView(state);
        return;
      }

      currentNextAction = computed.nextAction;

      // Update Top Duty Subtext
      if (dutySubtext) {
        dutySubtext.textContent = `📦 ${activeOrders.length} active deliver${activeOrders.length > 1 ? 'ies' : 'y'} • Next: ${computed.nextAction ? computed.nextAction.title : 'Proceed'}`;
      }

      // Update Batch Summary Header
      var countTextEl = document.getElementById('route-batch-count-text');
      var metricsEl = document.getElementById('route-batch-metrics');
      var totalEarningsEl = document.getElementById('route-batch-total-earnings');

      if (countTextEl) {
        countTextEl.textContent = `ACTIVE ROUTE (${activeOrders.length} ORDER${activeOrders.length > 1 ? 'S' : ''})`;
      }
      if (metricsEl) {
        metricsEl.textContent = `${computed.totalDistanceKm} km • ~${computed.totalTimeMins} mins`;
      }
      if (totalEarningsEl) {
        totalEarningsEl.textContent = `Total: ₹${computed.totalEarnings}`;
      }

      // Update PROMINENT NEXT ACTION HUD
      var nextTitleEl = document.getElementById('next-action-title');
      var nextSubtextEl = document.getElementById('next-action-subtext');
      var nextPayoutEl = document.getElementById('next-action-payout-pill');
      var nextActionBtnText = document.getElementById('btn-next-action-advance-text');

      if (computed.nextAction) {
        if (nextTitleEl) nextTitleEl.textContent = `NEXT: "${computed.nextAction.title}"`;
        if (nextSubtextEl) nextSubtextEl.textContent = computed.nextAction.subtext;
        if (nextPayoutEl) nextPayoutEl.textContent = `+₹${computed.nextAction.payout || 45}`;
        if (nextActionBtnText) nextActionBtnText.textContent = computed.nextAction.actionLabel || 'Advance';
      }

      // Update ACTIVE ROUTE SEQUENCED STOP LIST
      var stopsContainer = document.getElementById('container-active-route-stops');
      if (stopsContainer) {
        stopsContainer.innerHTML = '';

        var emojiMap = {
          GROCERY: '🛒',
          FOOD: '🍔',
          MEDICINE: '💊',
          PARCEL: '📦',
          PICKUP_DROP: '🔄',
          PASSENGER: '🛵'
        };

        computed.stops.forEach(function(stop, index) {
          var isCurrent = (index === 0);
          var isPickup = (stop.stopType === 'PICKUP');
          var emoji = emojiMap[stop.orderType] || '📦';
          var stopNum = index + 1;

          // Status Badge Determination
          var statusLabel = 'WAITING';
          var statusBadgeClass = 'bg-slate-800 text-slate-400 border border-slate-700';

          if (isCurrent) {
            statusLabel = isPickup ? 'GO TO PICKUP' : 'GO TO DROP';
            statusBadgeClass = isPickup ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30 font-black animate-pulse' : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 font-black animate-pulse';
          } else if (stop.order && (stop.order.status === 'PICKED_UP' || stop.order.status === 'DELIVERING')) {
            statusLabel = 'PICKED UP';
            statusBadgeClass = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-black';
          } else {
            statusLabel = 'WAITING';
          }

          // Priority indicator
          var priorityHtml = '';
          if (stop.orderType === 'MEDICINE') {
            priorityHtml = '<span class="text-[9px] font-black text-rose-300 bg-rose-500/20 px-1 rounded border border-rose-500/30">🚨 CRITICAL SLA</span>';
          } else if (stop.orderType === 'FOOD') {
            priorityHtml = '<span class="text-[9px] font-black text-orange-300 bg-orange-500/20 px-1 rounded border border-orange-500/30">🔥 HOT FOOD</span>';
          }

          var itemHtml = `
            <div class="p-2.5 rounded-xl border ${isCurrent ? 'bg-slate-900 border-blue-500/60 shadow-md ring-1 ring-blue-500/20' : 'bg-slate-950/60 border-slate-800/80 opacity-90'} flex items-center justify-between text-xs transition-all">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div class="w-6 h-6 rounded-full ${isCurrent ? 'bg-blue-600 text-white ring-2 ring-emerald-400' : 'bg-slate-800 text-slate-300'} font-black text-[11px] flex items-center justify-center shrink-0">
                  ${stopNum}
                </div>
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-1.5 flex-wrap">
                    <span class="text-sm">${emoji}</span>
                    <span class="font-black text-white text-[11px] truncate">${stop.orderType} #${stop.orderId}</span>
                    ${priorityHtml}
                  </div>
                  <p class="text-[10px] text-slate-300 truncate mt-0.5">
                    <strong class="text-slate-400">${isPickup ? 'Pickup:' : 'Drop:'}</strong> ${stop.address}
                  </p>
                </div>
              </div>

              <div class="text-right shrink-0 pl-2">
                <span class="px-1.5 py-0.5 rounded text-[9px] uppercase tracking-wider block ${statusBadgeClass}">
                  ${statusLabel}
                </span>
                <span class="text-[10px] font-black text-emerald-400 block mt-1">₹${stop.payout || 45}</span>
              </div>
            </div>
          `;

          stopsContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
      }

      // Draw Multi-Stop Map Polyline & Numbered Markers
      renderDynamicRouteMap(activeOrders, state);
      return;
    }

    // -------------------------------------------------------------
    // CASE 2C: AVAILABLE STATE (LOOKING FOR ORDERS)
    // -------------------------------------------------------------
    if (dutySubtext) dutySubtext.textContent = 'Looking for nearby orders...';
    cardAvailable.classList.remove('hidden');
    renderDynamicRouteMap([], state);

    // Render detailed Earnings & Profile tabs
    renderEarningsSection(state);
    renderProfileSection(state);
  }

  // 5. BIND UI & SIMULATION LISTENERS
  function bindInteractions() {
    // A. Duty Toggle Button (Top Header & Offline CTA)
    function toggleDuty() {
      var st = getRiderState();
      st.isOnline = !st.isOnline;
      st.state = st.isOnline ? 'AVAILABLE' : 'OFFLINE';
      if (!st.isOnline) {
        st.activeOrderId = null;
        st.activeOrders = [];
      }
      saveRiderState(st);
      renderHomeView(st);
    }

    document.getElementById('btn-toggle-duty')?.addEventListener('click', toggleDuty);
    document.getElementById('btn-go-online-cta')?.addEventListener('click', toggleDuty);

    // B. Bottom Navigation Tabs
    document.querySelectorAll('.nav-tab-btn').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var targetTab = btn.dataset.tab;

        // Hide all tabs
        document.querySelectorAll('.tab-page').forEach(function(p) { p.classList.add('hidden'); });

        // Show target tab
        var activePage = document.getElementById('tab-content-' + targetTab);
        if (activePage) activePage.classList.remove('hidden');

        // Style bottom nav buttons
        document.querySelectorAll('.nav-tab-btn').forEach(function(b) {
          if (b === btn) {
            b.className = 'nav-tab-btn flex flex-col items-center gap-0.5 text-blue-400 active:scale-95 transition-all cursor-pointer';
          } else {
            b.className = 'nav-tab-btn flex flex-col items-center gap-0.5 text-slate-400 hover:text-slate-200 active:scale-95 transition-all cursor-pointer';
          }
        });

        // Trigger tab-specific refresh
        if (targetTab === 'home' && map) {
          setTimeout(function() { map.invalidateSize(); }, 150);
        } else if (targetTab === 'earnings') {
          renderEarningsSection(getRiderState());
        } else if (targetTab === 'profile') {
          renderProfileSection(getRiderState());
        }
      });
    });

    // C. Quick Simulator Chips on Available Card (Grocery, Food, Medicine, Parcel, Pickup & Drop, Passenger)
    document.querySelectorAll('.btn-quick-sim').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var simType = btn.dataset.sim;
        var st = getRiderState();
        st.isOnline = true;
        saveRiderState(st);

        // Enforce Passenger Exclusivity: Block new order requests if rider is in passenger mode
        if (window.BslFleetEngine && window.BslFleetEngine.isPassengerMode(st)) {
          alert('⚠️ Request Blocked: You are currently on an active PASSENGER ride. All incoming orders are paused until you complete this trip.');
          return;
        }

        // Trigger the Unified Order Request Experience
        if (window.BslOrderRequestEngine) {
          window.BslOrderRequestEngine.simulateOrderRequest(simType);
        } else {
          console.warn('BslOrderRequestEngine not initialized.');
        }
      });
    });

    // D. 1-TAP NAVIGATION BUTTON (NEXT ACTION)
    document.getElementById('btn-next-action-nav')?.addEventListener('click', function() {
      if (currentNextAction && currentNextAction.navUrl) {
        window.open(currentNextAction.navUrl, '_blank');
      } else {
        alert('Navigation target not available.');
      }
    });

    // E. ADVANCE STOP BUTTON (NEXT ACTION: CONFIRM PICKUP / COMPLETE DELIVERY)
    document.getElementById('btn-next-action-advance')?.addEventListener('click', function() {
      var st = getRiderState();
      var activeOrders = st.activeOrders || [];

      if (!currentNextAction || !currentNextAction.stop) {
        alert('No active stop to advance.');
        return;
      }

      var stop = currentNextAction.stop;
      var wasPickup = (stop.stopType === 'PICKUP');

      if (window.BslRouteSequencer) {
        st.activeOrders = window.BslRouteSequencer.advanceStop(activeOrders, stop);
      } else {
        // Fallback advancement
        if (wasPickup) {
          activeOrders.forEach(function(o) { if (o.id === stop.orderId) o.status = 'PICKED_UP'; });
        } else {
          st.activeOrders = activeOrders.filter(function(o) { return o.id !== stop.orderId; });
        }
      }

      if (wasPickup) {
        alert(`📦 Order #${stop.orderId} picked up from ${stop.address}!\nNext action updated in route sequence.`);
      } else {
        var payout = Number(stop.payout || 45);
        st.todayOrdersCount = (st.todayOrdersCount || 12) + 1;
        st.todayEarnings = (st.todayEarnings || 684) + payout;
        st.walletBalance = (st.walletBalance || 1240) + payout;

        // Dynamic 6-service breakdown sync
        var ordType = (stop.orderType || 'GROCERY').toUpperCase();
        if (st.breakdown && st.breakdown.today && st.breakdown.today.services) {
          if (st.breakdown.today.services[ordType]) {
            st.breakdown.today.services[ordType].amount += payout;
            st.breakdown.today.services[ordType].jobs += 1;
          }
          st.breakdown.today.total += payout;
          st.breakdown.today.jobs += 1;
        }

        alert(`✅ Order #${stop.orderId} successfully delivered to customer!\n₹${payout} credited to your combined wallet.`);
      }

      // Check if all orders completed
      if (st.activeOrders.length === 0) {
        st.state = 'AVAILABLE';
        st.activeOrderId = null;
      } else {
        st.state = (st.activeOrders.length > 1) ? 'MULTI_ORDER' : 'DELIVERING';
        st.activeOrderId = st.activeOrders[0].id;
      }

      saveRiderState(st);
      renderHomeView(st);
    });

    // F. VIEW ALL ACTIVE ORDERS MODAL TRIGGER & CLOSE
    document.getElementById('btn-view-all-active-orders')?.addEventListener('click', function() {
      var st = getRiderState();
      var orders = st.activeOrders || [];
      var modal = document.getElementById('modal-active-orders-detail');
      var list = document.getElementById('modal-active-orders-list');
      var totalPayoutEl = document.getElementById('modal-active-orders-total-payout');
      var countSubEl = document.getElementById('modal-active-orders-count-sub');

      if (!modal || !list) return;

      list.innerHTML = '';
      var totalPayout = 0;

      if (orders.length === 0) {
        list.innerHTML = '<div class="text-center py-6 text-xs text-slate-400">No active orders in batch.</div>';
      } else {
        orders.forEach(function(o) {
          var type = (o.type || 'GROCERY').toUpperCase();
          var payout = Number(o.payout || o.deliveryFee || 45);
          totalPayout += payout;

          var itemHtml = `
            <div class="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div class="flex items-center justify-between border-b border-slate-800 pb-1.5">
                <span class="text-xs font-black text-white flex items-center gap-1.5">
                  <span>${type}</span>
                  <span class="text-blue-400">#${o.id || o.orderId}</span>
                </span>
                <span class="text-xs font-black text-emerald-400">₹${payout}</span>
              </div>
              <div class="text-[11px] space-y-1 text-slate-300">
                <div class="flex items-start justify-between gap-2">
                  <span class="text-slate-400">🏪 Pickup:</span>
                  <span class="font-bold text-white text-right">${o.pickupAddress || o.store || 'Store Location'}</span>
                </div>
                <div class="flex items-start justify-between gap-2">
                  <span class="text-slate-400">📍 Drop:</span>
                  <span class="font-bold text-white text-right">${o.dropAddress || o.address || 'Customer Location'}</span>
                </div>
                <div class="flex items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-800/80">
                  <span>Status: <strong class="text-amber-400">${o.status || 'GOING_TO_PICKUP'}</strong></span>
                  <a href="tel:9876543210" class="text-blue-400 font-extrabold flex items-center gap-0.5 hover:underline">
                    <span class="material-symbols-outlined text-xs">call</span> Call Customer
                  </a>
                </div>
              </div>
            </div>
          `;
          list.insertAdjacentHTML('beforeend', itemHtml);
        });
      }

      if (countSubEl) countSubEl.textContent = `${orders.length} active deliver${orders.length === 1 ? 'y' : 'ies'} assigned to your fleet`;
      if (totalPayoutEl) totalPayoutEl.textContent = `₹${totalPayout}`;

      modal.classList.remove('hidden');
    });

    document.getElementById('btn-close-active-orders-modal')?.addEventListener('click', function() {
      var modal = document.getElementById('modal-active-orders-detail');
      if (modal) modal.classList.add('hidden');
    });

    // G. VIEW OPTIMIZED ROUTE BUTTON (FITS MAP BOUNDS)
    document.getElementById('btn-view-optimized-route')?.addEventListener('click', function() {
      if (!map || routeMarkers.length === 0) {
        alert('No active route stops to display.');
        return;
      }
      var bounds = L.latLngBounds(routeMarkers.map(function(m) { return m.getLatLng(); }));
      if (riderMarker) bounds.extend(riderMarker.getLatLng());
      map.fitBounds(bounds, { padding: [80, 80], animate: true });
    });

    // H. MULTI-ORDER TEST SIMULATION BUTTONS (BACKEND GUARDED WITH BslFleetEngine)
    document.querySelectorAll('.btn-stack-sim').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var stackType = btn.dataset.stack;
        var st = getRiderState();

        // Sample candidate order data
        var sampleOrders = {
          GROCERY: {
            id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
            type: 'GROCERY',
            store: 'Kisan Super Market, Jamner Road',
            pickupAddress: 'Kisan Super Market, Jamner Road',
            dropAddress: 'Bungalow 12, Shanti Nagar, Bhusawal',
            payout: 42,
            pickupLat: 21.0460,
            pickupLng: 21.7890,
            dropLat: 21.0410,
            dropLng: 21.7960,
            packageSize: 'MEDIUM'
          },
          FOOD: {
            id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
            type: 'FOOD',
            store: 'Moonlight Restaurant, Station Road',
            pickupAddress: 'Moonlight Restaurant, Station Road',
            dropAddress: 'Railway Colony East Quarter, Bhusawal',
            payout: 48,
            pickupLat: 21.0470,
            pickupLng: 21.7880,
            dropLat: 21.0430,
            dropLng: 21.7930,
            packageSize: 'MEDIUM'
          },
          MEDICINE: {
            id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
            type: 'MEDICINE',
            store: 'Sanjivani Pharmacy, Civil Hospital Gate',
            pickupAddress: 'Sanjivani Pharmacy, Civil Hospital Gate',
            dropAddress: 'House 5, Old Town, Bhusawal',
            payout: 55,
            pickupLat: 21.0450,
            pickupLng: 21.7910,
            dropLat: 21.0390,
            dropLng: 21.7940,
            packageSize: 'SMALL'
          },
          PARCEL: {
            id: 'ORD-' + Math.floor(1000 + Math.random() * 9000),
            type: 'PARCEL',
            store: 'Local Electronics Shop, Bazaar Peth',
            pickupAddress: 'Local Electronics Shop, Bazaar Peth',
            dropAddress: 'MIDC Office Gate, Bhusawal',
            payout: 50,
            pickupLat: 21.0440,
            pickupLng: 21.7850,
            dropLat: 21.0510,
            dropLng: 21.7990,
            packageSize: 'MEDIUM'
          }
        };

        var candidate = sampleOrders[stackType] || sampleOrders.GROCERY;

        // BACKEND GUARD ENFORCEMENT:
        if (window.BslFleetEngine) {
          var multiCheck = window.BslFleetEngine.canAddToMultiOrder(st, candidate);
          if (!multiCheck.allowed) {
            alert('⚠️ Multi-Order Blocked by Fleet Engine:\n\n' + multiCheck.reason);
            return;
          }
        }

        // Allowed by backend guard: Batch order
        st.activeOrders = (st.activeOrders || []).concat([candidate]);
        st.state = 'MULTI_ORDER';
        st.activeOrderId = candidate.id;
        saveRiderState(st);
        renderHomeView(st);
        alert(`✅ ${stackType} order #${candidate.id} successfully added to active multi-order batch!\nRoute re-sequenced optimally.`);
      });
    });

    // I. PASSENGER RIDE WORKFLOW & ACTIONS (PICKUP -> BOARDING OTP -> PASSENGER ON BOARD -> DROPPED -> AVAILABLE)
    var completedCountdownTimer = null;

    // A. 1-Tap Passenger Navigation
    document.getElementById('btn-card-passenger-nav')?.addEventListener('click', function() {
      var st = getRiderState();
      var curRide = (st.activeOrders && st.activeOrders[0]) || {};
      var target = (st.state === 'PASSENGER_PICKUP')
        ? (curRide.pickupAddress || 'Bhusawal Railway Station, Bhusawal')
        : (curRide.dropAddress || 'Jamner Road Municipal Shopping Complex, Bhusawal');
      var url = 'https://www.google.com/maps/dir/?api=1&destination=' + encodeURIComponent(target) + '&travelmode=driving';
      window.open(url, '_blank');
    });

    // B. Primary CTA Click (Verify OTP vs End Ride)
    document.getElementById('btn-card-advance-passenger')?.addEventListener('click', function() {
      var st = getRiderState();
      var curRide = (st.activeOrders && st.activeOrders[0]) || {};

      if (st.state === 'PASSENGER_PICKUP') {
        // Open Boarding OTP Verification Modal
        var modal = document.getElementById('modal-passenger-otp');
        var nameEl = document.getElementById('otp-passenger-name');
        var errEl = document.getElementById('error-passenger-otp');
        if (nameEl) nameEl.textContent = curRide.passengerName || curRide.customerName || 'Amit Sharma';
        if (errEl) errEl.classList.add('hidden');

        var inputs = document.querySelectorAll('.otp-passenger-input');
        inputs.forEach(function(inp) { inp.value = ''; });
        if (modal) modal.classList.remove('hidden');
        if (inputs[0]) inputs[0].focus();
      } else {
        // STAGE 2: PASSENGER ON BOARD -> END RIDE
        completePassengerRide();
      }
    });

    // C. OTP Input Auto-Advancing
    var otpInputs = document.querySelectorAll('.otp-passenger-input');
    otpInputs.forEach(function(input, idx) {
      input.addEventListener('input', function() {
        if (input.value.length === 1 && idx < otpInputs.length - 1) {
          otpInputs[idx + 1].focus();
        }
      });
      input.addEventListener('keydown', function(e) {
        if (e.key === 'Backspace' && !input.value && idx > 0) {
          otpInputs[idx - 1].focus();
        }
      });
    });

    function submitBoardingOtp() {
      var st = getRiderState();
      var curRide = (st.activeOrders && st.activeOrders[0]) || {};
      var entered = Array.from(otpInputs).map(function(i) { return i.value; }).join('');
      var expectedOtp = curRide.otp || '4892';

      var errEl = document.getElementById('error-passenger-otp');
      // Accept sample OTP 4892, matching OTP, or 4 digits in simulation
      if (entered && (entered === expectedOtp || entered === '4892' || entered.length === 4)) {
        var modal = document.getElementById('modal-passenger-otp');
        if (modal) modal.classList.add('hidden');

        // Transition state from PASSENGER_PICKUP -> PASSENGER_ACTIVE
        st.state = 'PASSENGER_ACTIVE';
        if (curRide) curRide.status = 'PASSENGER_ON_BOARD';
        st.activeOrders = [curRide];
        saveRiderState(st);

        if (window.BhusawalBackend) {
          window.BhusawalBackend.riders.save({
            id: st.id || 'BHU-RIDER-8942',
            state: 'PASSENGER_ACTIVE',
            isPassengerLocked: true,
            activeOrders: st.activeOrders
          });
        }

        renderHomeView(st);
        alert('🛵 Boarding OTP Verified! Passenger is on board.\nStatus: PASSENGER ON BOARD.\nProceed to drop destination.');
      } else {
        if (errEl) errEl.classList.remove('hidden');
      }
    }

    document.getElementById('btn-submit-passenger-otp')?.addEventListener('click', submitBoardingOtp);
    document.getElementById('btn-close-passenger-otp')?.addEventListener('click', function() {
      var modal = document.getElementById('modal-passenger-otp');
      if (modal) modal.classList.add('hidden');
    });
    document.getElementById('btn-cancel-passenger-otp')?.addEventListener('click', function() {
      var modal = document.getElementById('modal-passenger-otp');
      if (modal) modal.classList.add('hidden');
    });

    // D. Complete Ride & Show Summary Modal
    function completePassengerRide() {
      var st = getRiderState();
      var curRide = (st.activeOrders && st.activeOrders[0]) || {};
      var fare = Number(curRide.fare || curRide.payout || curRide.total || 55);
      var distance = 3.8;
      var duration = '12 mins';

      // Update counters
      st.state = 'PASSENGER_COMPLETED';
      st.todayOrdersCount = (st.todayOrdersCount || 12) + 1;
      st.todayEarnings = (st.todayEarnings || 684) + fare;
      st.walletBalance = (st.walletBalance || 1240) + fare;
      st.todayDistanceKm = parseFloat(((st.todayDistanceKm || 24.6) + distance).toFixed(1));

      // Dynamic Passenger service breakdown sync
      if (st.breakdown && st.breakdown.today && st.breakdown.today.services && st.breakdown.today.services.PASSENGER) {
        st.breakdown.today.services.PASSENGER.amount += fare;
        st.breakdown.today.services.PASSENGER.jobs += 1;
        st.breakdown.today.total += fare;
        st.breakdown.today.jobs += 1;
      }
      saveRiderState(st);

      // Open Ride Completed Summary Modal
      var modal = document.getElementById('modal-passenger-completed');
      var fareEl = document.getElementById('completed-ride-fare');
      var distEl = document.getElementById('completed-ride-dist');
      var durEl = document.getElementById('completed-ride-duration');
      var countEl = document.getElementById('completed-countdown-sec');

      if (fareEl) fareEl.textContent = '₹' + fare;
      if (distEl) distEl.textContent = distance + ' km';
      if (durEl) durEl.textContent = duration;
      if (modal) modal.classList.remove('hidden');

      // Countdown to auto-return to AVAILABLE
      var remaining = 3;
      if (countEl) countEl.textContent = remaining;

      if (completedCountdownTimer) clearInterval(completedCountdownTimer);
      completedCountdownTimer = setInterval(function() {
        remaining--;
        if (countEl) countEl.textContent = remaining;
        if (remaining <= 0) {
          clearInterval(completedCountdownTimer);
          completedCountdownTimer = null;
          returnToAvailable();
        }
      }, 1000);
    }

    function returnToAvailable() {
      if (completedCountdownTimer) {
        clearInterval(completedCountdownTimer);
        completedCountdownTimer = null;
      }
      var modal = document.getElementById('modal-passenger-completed');
      if (modal) modal.classList.add('hidden');

      var st = getRiderState();
      st.state = 'AVAILABLE';
      st.isPassengerLocked = false;
      st.activeOrderId = null;
      st.activeOrders = [];
      saveRiderState(st);

      if (window.BhusawalBackend) {
        window.BhusawalBackend.riders.save({
          id: st.id || 'BHU-RIDER-8942',
          isOnline: true,
          state: 'AVAILABLE',
          isPassengerLocked: false,
          activeOrderId: null,
          activeOrders: []
        });
      }

      renderHomeView(st);
      alert('🟢 Returned to AVAILABLE! Normal order matching resumed.');
    }

    document.getElementById('btn-return-available-cta')?.addEventListener('click', returnToAvailable);

    // J. Passenger SOS Button
    document.getElementById('btn-card-passenger-sos')?.addEventListener('click', function() {
      alert('🚨 BSL Fleet Emergency SOS Triggered!\nLocation coordinates and passenger details broadcast to Central Dispatch and Bhusawal Police Helpline.');
    });

    // K. Map Recenter / Auto-Follow Button
    document.getElementById('btn-map-recenter')?.addEventListener('click', function() {
      isFollowRider = true;
      updateRecenterButtonUI();
      if (map) {
        map.flyTo([currentGPS.lat, currentGPS.lng], 16, { animate: true, duration: 0.7 });
      }
      showToast('Map centered • Auto-follow rider ON');
    });

    // L. Map Hotspots Toggle Button
    document.getElementById('btn-map-hotspots')?.addEventListener('click', function() {
      isHotspotsVisible = !isHotspotsVisible;
      var st = getRiderState();
      st.settings = st.settings || {};
      st.settings.mapHotspots = isHotspotsVisible;
      saveRiderState(st);

      if (isHotspotsVisible) {
        showHotspots();
        showToast('Demand hotspots visible');
      } else {
        hideHotspots();
        showToast('Demand hotspots hidden');
      }
    });

    // M. Touch Zoom In / Out Controls
    document.getElementById('btn-map-zoom-in')?.addEventListener('click', function() {
      if (map) map.zoomIn();
    });

    document.getElementById('btn-map-zoom-out')?.addEventListener('click', function() {
      if (map) map.zoomOut();
    });

    // N. GPS Accuracy Pill Refresh
    document.getElementById('btn-gps-accuracy-info')?.addEventListener('click', function() {
      if (navigator.geolocation) {
        showToast('Refreshing GPS fix...');
        navigator.geolocation.getCurrentPosition(
          function(pos) {
            handleLiveGPSUpdate(pos.coords);
            showToast('GPS Updated: ±' + Math.round(pos.coords.accuracy || 8) + 'm precision');
          },
          function(err) {
            showToast('GPS: ' + (err.message || 'Position unavailable'), true);
          },
          { enableHighAccuracy: true, timeout: 5000 }
        );
      } else {
        showToast('Location services active (±' + currentGPS.accuracy + 'm)');
      }
    });

    // M. Top Profile & Notification shortcuts
    document.getElementById('btn-top-profile')?.addEventListener('click', function() {
      var profileBtn = document.querySelector('.nav-tab-btn[data-tab="profile"]');
      if (profileBtn) profileBtn.click();
    });

    document.getElementById('btn-top-notif')?.addEventListener('click', function() {
      alert('🔔 High demand alert: Extra ₹15 surge incentive active around Station Road!');
    });

    // N. TIMEFRAME SELECTOR BUTTONS (TODAY / WEEKLY / MONTHLY)
    document.querySelectorAll('.btn-timeframe-tab').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var period = btn.dataset.period || 'today';
        var st = getRiderState();
        st.earningsTimeframe = period;
        saveRiderState(st);
        renderEarningsSection(st);
      });
    });

    // O. INSTANT CASHOUT MODAL & FLOW
    function openCashoutModal() {
      var st = getRiderState();
      var bal = st.walletBalance || 0;
      var modal = document.getElementById('modal-wallet-cashout');
      var availEl = document.getElementById('modal-cashout-available-val');
      var upiEl = document.getElementById('modal-cashout-upi-display');
      var inputEl = document.getElementById('input-cashout-amount');

      if (availEl) availEl.textContent = '₹' + bal.toLocaleString('en-IN');
      if (upiEl) upiEl.textContent = st.upiId || 'rahulpatil@okaxis';
      if (inputEl) inputEl.value = bal > 0 ? bal : '';

      if (modal) modal.classList.remove('hidden');
    }

    function closeCashoutModal() {
      var modal = document.getElementById('modal-wallet-cashout');
      if (modal) modal.classList.add('hidden');
    }

    document.getElementById('btn-wallet-cashout')?.addEventListener('click', openCashoutModal);
    document.getElementById('btn-close-cashout-modal')?.addEventListener('click', closeCashoutModal);
    document.getElementById('btn-cancel-cashout-modal')?.addEventListener('click', closeCashoutModal);

    // Quick Amount Chips in Cashout Modal
    document.querySelectorAll('.btn-quick-amount').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var st = getRiderState();
        var val = btn.dataset.val;
        var inputEl = document.getElementById('input-cashout-amount');
        if (!inputEl) return;
        if (val === 'all') {
          inputEl.value = st.walletBalance || 0;
        } else {
          inputEl.value = Math.min(Number(val), st.walletBalance || 0);
        }
      });
    });

    // Submit Cashout
    document.getElementById('btn-confirm-cashout-submit')?.addEventListener('click', function() {
      var st = getRiderState();
      var inputEl = document.getElementById('input-cashout-amount');
      var amount = Number(inputEl ? inputEl.value : 0);
      var currentBal = st.walletBalance || 0;

      if (!amount || amount <= 0) {
        showToast('Please enter a valid cashout amount.', true);
        return;
      }
      if (amount > currentBal) {
        showToast('Amount exceeds available wallet balance (₹' + currentBal + ').', true);
        return;
      }

      // Deduct from single combined wallet
      st.walletBalance = currentBal - amount;

      // Add to payout history
      var newPayout = {
        id: 'BSL-' + Math.floor(1000 + Math.random() * 9000),
        type: 'UPI_INSTANT',
        title: 'Instant UPI Withdrawal',
        desc: 'To ' + (st.upiId || 'rahulpatil@okaxis') + ' • Instant Payout',
        amount: amount,
        status: 'Completed',
        time: 'Just now'
      };
      st.payoutHistory = [newPayout].concat(st.payoutHistory || []).slice(0, 10);

      saveRiderState(st);
      closeCashoutModal();
      showToast('₹' + amount.toLocaleString('en-IN') + ' sent to ' + (st.upiId || 'UPI') + '! Credited instantly.');
      renderHomeView(st);
    });

    // P. EDIT BANK & UPI MODAL & FLOW
    function openEditUpiModal() {
      var st = getRiderState();
      var modal = document.getElementById('modal-edit-upi');
      var upiInput = document.getElementById('input-edit-upi');
      var bankNameInput = document.getElementById('input-edit-bank-name');
      var bankAccInput = document.getElementById('input-edit-bank-acc');
      var bankIfscInput = document.getElementById('input-edit-bank-ifsc');

      if (upiInput) upiInput.value = st.upiId || 'rahulpatil@okaxis';
      if (bankNameInput) bankNameInput.value = st.bankName || 'State Bank of India';
      if (bankAccInput) bankAccInput.value = st.bankAcc || '30894218942';
      if (bankIfscInput) bankIfscInput.value = st.bankIfsc || 'SBIN0000324';

      if (modal) modal.classList.remove('hidden');
    }

    function closeEditUpiModal() {
      var modal = document.getElementById('modal-edit-upi');
      if (modal) modal.classList.add('hidden');
    }

    document.getElementById('btn-edit-payout-target')?.addEventListener('click', openEditUpiModal);
    document.getElementById('btn-edit-bank-upi')?.addEventListener('click', openEditUpiModal);
    document.getElementById('btn-close-edit-upi-modal')?.addEventListener('click', closeEditUpiModal);
    document.getElementById('btn-cancel-edit-upi-modal')?.addEventListener('click', closeEditUpiModal);

    document.getElementById('btn-save-edit-upi')?.addEventListener('click', function() {
      var st = getRiderState();
      var upiInput = document.getElementById('input-edit-upi');
      var bankNameInput = document.getElementById('input-edit-bank-name');
      var bankAccInput = document.getElementById('input-edit-bank-acc');
      var bankIfscInput = document.getElementById('input-edit-bank-ifsc');

      var newUpi = upiInput ? upiInput.value.trim() : '';
      if (!newUpi || !newUpi.includes('@')) {
        showToast('Please enter a valid UPI ID (e.g. name@bank).', true);
        return;
      }

      st.upiId = newUpi;
      if (bankNameInput) st.bankName = bankNameInput.value.trim();
      if (bankAccInput) st.bankAcc = bankAccInput.value.trim();
      if (bankIfscInput) st.bankIfsc = bankIfscInput.value.trim();

      saveRiderState(st);
      closeEditUpiModal();
      showToast('Settlement account updated to ' + newUpi + '!');
      renderEarningsSection(st);
      renderProfileSection(st);
    });

    // Q. COPY RIDER ID BUTTON
    document.getElementById('btn-copy-rider-id')?.addEventListener('click', function() {
      var st = getRiderState();
      var riderId = st.id || 'BSL-RIDER-8942';
      var badge = document.getElementById('badge-id-copied');

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(riderId).then(function() {
          if (badge) {
            badge.classList.remove('hidden');
            setTimeout(function() { badge.classList.add('hidden'); }, 2000);
          }
          showToast('Copied ' + riderId + ' to clipboard!');
        }).catch(function() {
          showToast('Copied: ' + riderId);
        });
      } else {
        showToast('Copied: ' + riderId);
      }
    });

    // R. SETTINGS TOGGLES (Chime, Hotspots, Language)
    document.getElementById('setting-order-chime')?.addEventListener('change', function(e) {
      var st = getRiderState();
      st.settings = st.settings || {};
      st.settings.orderChime = e.target.checked;
      saveRiderState(st);
      showToast('Order sound alert ' + (st.settings.orderChime ? 'enabled' : 'muted'));
    });

    document.getElementById('setting-map-hotspots')?.addEventListener('change', function(e) {
      var st = getRiderState();
      st.settings = st.settings || {};
      st.settings.mapHotspots = e.target.checked;
      saveRiderState(st);
      isHotspotsVisible = st.settings.mapHotspots;
      if (map) {
        hotspotMarkers.forEach(function(m) {
          if (isHotspotsVisible) m.addTo(map);
          else map.removeLayer(m);
        });
      }
      showToast('Map demand hotspots ' + (isHotspotsVisible ? 'visible' : 'hidden'));
    });

    document.getElementById('setting-app-language')?.addEventListener('change', function(e) {
      var st = getRiderState();
      st.settings = st.settings || {};
      st.settings.language = e.target.value;
      saveRiderState(st);
      showToast('Language preference saved.');
    });

    // S. ADMIN SIMULATOR: TOGGLE KYC STATUS
    document.getElementById('btn-admin-toggle-approve')?.addEventListener('click', function() {
      var st = getRiderState();
      st.kycApproved = !st.kycApproved;
      saveRiderState(st);
      showToast('Admin: KYC set to ' + (st.kycApproved ? 'APPROVED' : 'PENDING'));
      renderHomeView(st);
    });

    // T. LOGOUT CONFIRMATION MODAL
    document.getElementById('btn-rider-logout')?.addEventListener('click', function() {
      var modal = document.getElementById('modal-rider-logout');
      if (modal) modal.classList.remove('hidden');
    });

    document.getElementById('btn-cancel-logout-modal')?.addEventListener('click', function() {
      var modal = document.getElementById('modal-rider-logout');
      if (modal) modal.classList.add('hidden');
    });

    document.getElementById('btn-confirm-logout-modal')?.addEventListener('click', function() {
      var st = getRiderState();
      st.isLoggedIn = false;
      st.isOnline = false;
      st.state = 'OFFLINE';
      saveRiderState(st);
      window.location.reload();
    });
  }

  // 6. PUBLIC INITIALIZER
  function start() {
    initLiveMap();
    bindInteractions();
    var state = getRiderState();
    renderHomeView(state);
  }

  return {
    start: start,
    renderHomeView: renderHomeView,
    renderEarningsSection: renderEarningsSection,
    renderProfileSection: renderProfileSection,
    renderDynamicRouteMap: renderDynamicRouteMap,
    getRiderState: getRiderState,
    saveRiderState: saveRiderState,
    getLiveGPS: function() { return Object.assign({}, currentGPS); },
    updateLiveGPS: handleLiveGPSUpdate,
    recenterMap: function() {
      isFollowRider = true;
      updateRecenterButtonUI();
      if (map) map.flyTo([currentGPS.lat, currentGPS.lng], 16);
    },
    setFollowRider: function(val) { isFollowRider = !!val; updateRecenterButtonUI(); },
    showToast: showToast
  };
})();

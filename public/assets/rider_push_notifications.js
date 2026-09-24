/**
 * Bhusawal Connect - Rider Push Notification Engine
 * High-Priority Audio/Visual Web Push Notifications for Fleet Drivers
 */
window.BhusawalRiderPush = (function() {
  
  var NOTIF_KEY = 'bhusawal_rider_notifications';

  // 1. Request Browser Web Push Notification Permission
  function requestPermission() {
    if ('Notification' in window && Notification.permission !== 'granted') {
      Notification.requestPermission();
    }
  }

  // 2. Play Web Audio Alert Chime
  function playNotificationChime() {
    try {
      var ctx = new (window.AudioContext || window.webkitAudioContext)();
      var osc = ctx.createOscillator();
      var gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      gain.gain.setValueAtTime(0.3, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.3);
    } catch(e) {}
  }

  // 3. Dispatch Push Notification (Works even if another order is active)
  function sendPushNotification(type, title, message, extraData) {
    playNotificationChime();

    var notifItem = {
      id: 'NOTIF-' + Math.floor(100000 + Math.random() * 900000),
      type: type,
      title: title,
      message: message,
      timestamp: new Date().toISOString(),
      timeFormatted: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      read: false,
      extraData: extraData || {}
    };

    // Save to persistent notification history
    try {
      var history = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
      history.unshift(notifItem);
      if (history.length > 30) history = history.slice(0, 30);
      localStorage.setItem(NOTIF_KEY, JSON.stringify(history));
    } catch(e) {}

    // Trigger System Web Push Notification if permitted
    if ('Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/favicon.ico',
          tag: notifItem.id
        });
      } catch(e) {}
    }

    // Trigger HUD Toast Banner on Rider UI
    showRiderHUDToast(notifItem);

    // Emit event for real-time UI re-rendering
    window.dispatchEvent(new Event('riderNotificationReceived'));
    window.dispatchEvent(new Event('storage'));

    return notifItem;
  }

  // 4. Show Floating HUD Toast Notification on Rider App
  function showRiderHUDToast(notif) {
    var container = document.getElementById('rider-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'rider-toast-container';
      container.className = 'fixed top-16 left-1/2 -translate-x-1/2 z-50 w-[92%] max-w-md space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }

    var toast = document.createElement('div');
    toast.className = 'pointer-events-auto bg-slate-900 text-white p-3.5 rounded-2xl shadow-2xl border-2 border-blue-500 flex items-center justify-between gap-3 animate-in slide-in-from-top duration-300';
    
    var icon = 'notifications';
    if (notif.type === 'NEW_ORDER') icon = 'bolt';
    else if (notif.type === 'NEARBY_ORDER') icon = 'alt_route';
    else if (notif.type === 'ORDER_CANCELLED') icon = 'cancel';
    else if (notif.type === 'CUSTOMER_CALLED') icon = 'call';
    else if (notif.type === 'ADMIN_MESSAGE') icon = 'campaign';
    else if (notif.type === 'LOW_BATTERY') icon = 'battery_alert';
    else if (notif.type === 'NAV_STARTED') icon = 'navigation';
    else if (notif.type === 'NAV_COMPLETED') icon = 'sports_score';

    toast.innerHTML = `
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black shrink-0 shadow-md">
          <span class="material-symbols-outlined text-xl">${icon}</span>
        </div>
        <div class="min-w-0">
          <h4 class="text-xs font-black truncate text-white">${notif.title}</h4>
          <p class="text-[11px] font-semibold text-slate-300 truncate">${notif.message}</p>
        </div>
      </div>
      <span class="text-[10px] font-black text-blue-400 font-mono shrink-0">${notif.timeFormatted}</span>
    `;

    container.appendChild(toast);

    setTimeout(function() {
      toast.classList.add('animate-out', 'fade-out', 'duration-300');
      setTimeout(function() { toast.remove(); }, 300);
    }, 4500);
  }

  // 5. Specialized Helper Notification Dispatchers
  function notifyNewOrder(orderId, storeName) {
    return sendPushNotification(
      'NEW_ORDER',
      '⚡ New Order Assigned #' + orderId,
      'Order #' + orderId + ' is assigned for pickup at ' + (storeName || 'Bhusawal Store') + '.',
      { orderId: orderId }
    );
  }

  function notifyNearbyOrder(orderId, pickupName, extraEarnings) {
    return sendPushNotification(
      'NEARBY_ORDER',
      '⚡ New Nearby Order Available (+₹' + (extraEarnings || 40) + ')',
      'Route detour match! Pickup at ' + (pickupName || 'Nearby Store') + '.',
      { orderId: orderId }
    );
  }

  function notifyOrderCancelled(orderId) {
    return sendPushNotification(
      'ORDER_CANCELLED',
      '❌ Order Cancelled #' + orderId,
      'Customer cancelled Order #' + orderId + '. Return to available dispatch pool.',
      { orderId: orderId }
    );
  }

  function notifyCustomerCalled(customerName, phone) {
    return sendPushNotification(
      'CUSTOMER_CALLED',
      '📞 Incoming Customer Call',
      'Customer ' + (customerName || 'Amit Sharma') + ' is calling regarding delivery.',
      { phone: phone }
    );
  }

  function notifyAdminMessage(message) {
    return sendPushNotification(
      'ADMIN_MESSAGE',
      '📢 Admin Broadcast',
      message || 'High order volume near Station Road. Extra peak incentive active!',
      {}
    );
  }

  function notifyLowBattery(percent) {
    return sendPushNotification(
      'LOW_BATTERY',
      '⚠️ Low Battery Warning (' + (percent || 18) + '%)',
      'Your phone battery is low. Please connect to a charger while riding.',
      { percent: percent }
    );
  }

  function notifyNavStarted(destination) {
    return sendPushNotification(
      'NAV_STARTED',
      '🧭 Navigation Started',
      'Driving route to ' + (destination || 'Pickup Store') + ' started.',
      {}
    );
  }

  function notifyNavCompleted(destination) {
    return sendPushNotification(
      'NAV_COMPLETED',
      '🏁 Navigation Completed',
      'Arrived at ' + (destination || 'Customer Doorstep') + '.',
      {}
    );
  }

  function getNotificationHistory() {
    try {
      var history = JSON.parse(localStorage.getItem(NOTIF_KEY) || '[]');
      return Array.isArray(history) ? history : [];
    } catch(e) { return []; }
  }

  return {
    requestPermission: requestPermission,
    sendPushNotification: sendPushNotification,
    notifyNewOrder: notifyNewOrder,
    notifyNearbyOrder: notifyNearbyOrder,
    notifyOrderCancelled: notifyOrderCancelled,
    notifyCustomerCalled: notifyCustomerCalled,
    notifyAdminMessage: notifyAdminMessage,
    notifyLowBattery: notifyLowBattery,
    notifyNavStarted: notifyNavStarted,
    notifyNavCompleted: notifyNavCompleted,
    getNotificationHistory: getNotificationHistory
  };

})();

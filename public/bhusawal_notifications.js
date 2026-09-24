/**
 * ====================================================================
 * BHUSAWAL CONNECT — UNIFIED REAL-TIME NOTIFICATION SYSTEM (ALL ROLES)
 * ====================================================================
 * Single Unified Real-Time Notification Engine supporting:
 * - Roles: Customer, Delivery Partner (Rider), Admin, Shop/Merchant
 * - Channels: Web Push Notifications (Browser API), In-App Toasts, Audio Chime, History Log
 * - Types: Order Updates, Nearby Orders, Cancelled Orders, Payments, Announcements
 */

(function(window) {
  'use strict';

  var NOTIF_HISTORY_KEY = 'bhusawal_unified_notifications_history';
  var channel = null;

  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel('bhusawal_unified_notif_bus');
    }
  } catch(e) {}

  var listeners = [];

  function loadHistory() {
    try {
      var raw = localStorage.getItem(NOTIF_HISTORY_KEY);
      if (raw) return JSON.parse(raw);
    } catch(e) {}
    return [];
  }

  function saveHistory(list) {
    try {
      localStorage.setItem(NOTIF_HISTORY_KEY, JSON.stringify(list.slice(0, 100)));
    } catch(e) {}
  }

  // Web Push Notification Helper
  function sendWebPush(title, body, iconUrl) {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: body,
          icon: iconUrl || '/favicon.ico',
          badge: '/favicon.ico'
        });
      } catch(e) {}
    }
  }

  // Audio Chime Synthesizer
  function playAudioChime() {
    try {
      if (typeof AudioContext !== 'undefined' || typeof webkitAudioContext !== 'undefined') {
        var ctx = new (window.AudioContext || window.webkitAudioContext)();
        var osc = ctx.createOscillator();
        var gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 note
        osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5 note
        gain.gain.setValueAtTime(0.3, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + 0.3);
      }
    } catch(e) {}
  }

  var BhusawalUnifiedNotificationSystem = {
    version: '1.0.0-unified-notif',

    requestPushPermission: function() {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    },

    /**
     * Broadcasts a notification to target roles.
     * @param {Object} notif - { targetRole: 'customer'|'rider'|'admin'|'shop'|'all', type: 'order'|'nearby'|'cancelled'|'payment'|'announcement', title, message, link }
     */
    send: function(notif) {
      notif.id = 'NOTIF-' + Math.floor(100000 + Math.random() * 900000);
      notif.timestamp = new Date().toISOString();
      notif.timeStr = 'Just now';

      // 1. Save to master history
      var history = loadHistory();
      history.unshift(notif);
      saveHistory(history);

      // 2. Broadcast via BroadcastChannel
      if (channel) {
        try { channel.postMessage(notif); } catch(e) {}
      }

      // 3. Trigger local listeners
      listeners.forEach(function(cb) {
        try { cb(notif); } catch(e) {}
      });

      // 4. Web Push Notification
      sendWebPush('🔔 ' + (notif.title || 'Bhusawal Connect Alert'), notif.message || '');

      // 5. Audio Chime
      playAudioChime();

      return notif;
    },

    getForRole: function(role) {
      var history = loadHistory();
      if (!role || role === 'all') return history;
      return history.filter(function(n) {
        return n.targetRole === 'all' || n.targetRole === role;
      });
    },

    subscribe: function(callback) {
      listeners.push(callback);
    }
  };

  if (channel) {
    channel.onmessage = function(e) {
      if (e.data) {
        listeners.forEach(function(cb) {
          try { cb(e.data); } catch(err) {}
        });
        sendWebPush('🔔 ' + (e.data.title || 'Bhusawal Connect Alert'), e.data.message || '');
        playAudioChime();
      }
    };
  }

  // Expose Global Singleton
  window.BhusawalUnifiedNotificationSystem = BhusawalUnifiedNotificationSystem;

  // Auto-request push permission on interaction
  document.addEventListener('click', function requestOnce() {
    BhusawalUnifiedNotificationSystem.requestPushPermission();
    document.removeEventListener('click', requestOnce);
  });

})(window);

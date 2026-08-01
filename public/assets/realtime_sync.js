// Bhusawal Connect Real-Time Synchronization Bus
(function(window) {
  class RealtimeSyncBus {
    constructor() {
      this.channelName = 'bhusawal_connect_realtime_v1';
      this.listeners = {};
      this.hasBroadcastChannel = typeof BroadcastChannel !== 'undefined';
      
      if (this.hasBroadcastChannel) {
        this.bc = new BroadcastChannel(this.channelName);
        this.bc.onmessage = (event) => {
          const { topic, payload } = event.data || {};
          if (topic && this.listeners[topic]) {
            this.listeners[topic].forEach(cb => cb(payload));
          }
        };
      }
      
      // LocalStorage fallback for older browsers or strict iframe contexts
      window.addEventListener('storage', (e) => {
        if (e.key && e.key.startsWith('bhusawal_event_')) {
          try {
            const data = JSON.parse(e.newValue);
            if (data && data.topic && this.listeners[data.topic]) {
              this.listeners[data.topic].forEach(cb => cb(data.payload));
            }
          } catch(err) {}
        }
      });
    }

    emit(topic, payload) {
      const message = { topic, payload, timestamp: Date.now() };
      if (this.hasBroadcastChannel) {
        this.bc.postMessage(message);
      }
      // Set localStorage key temporarily to trigger storage event in other tabs
      try {
        localStorage.setItem(`bhusawal_event_${topic}`, JSON.stringify(message));
      } catch(e) {}
    }

    on(topic, callback) {
      if (!this.listeners[topic]) {
        this.listeners[topic] = [];
      }
      this.listeners[topic].push(callback);
    }

    off(topic, callback) {
      if (this.listeners[topic]) {
        this.listeners[topic] = this.listeners[topic].filter(cb => cb !== callback);
      }
    }
  }

  window.BhusawalRealtime = new RealtimeSyncBus();
})(window);

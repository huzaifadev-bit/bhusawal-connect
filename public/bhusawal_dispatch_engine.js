// Bhusawal Connect - Central Dispatch Engine for Riders & Orders
(function(window) {
  'use strict';

  const DispatchEngine = {
    RIDERS_KEY: 'bhusawal_fleet_riders',

    getDefaultRiders() {
      return [
        { id: "RIDER-01", name: "Rahul Patil", zone: "Kandari", phone: "+91 98765 00001", bikeNo: "MH 19 BK 1001", lat: 21.0520, lng: 75.7950, rating: 4.9, status: "online", battery: 92, ordersToday: 14, earningsToday: 850 },
        { id: "RIDER-02", name: "Sachin Chaudhari", zone: "Nahata College", phone: "+91 98765 00002", bikeNo: "MH 19 BK 1002", lat: 21.0410, lng: 75.7820, rating: 4.8, status: "online", battery: 84, ordersToday: 11, earningsToday: 680 },
        { id: "RIDER-03", name: "Vikas Mahajan", zone: "Khada Chowk", phone: "+91 98765 00003", bikeNo: "MH 19 BK 1003", lat: 21.0460, lng: 75.7890, rating: 4.9, status: "online", battery: 96, ordersToday: 16, earningsToday: 980 },
        { id: "RIDER-04", name: "Amit Wani", zone: "Railway Station", phone: "+91 98765 00004", bikeNo: "MH 19 BK 1004", lat: 21.0490, lng: 75.7920, rating: 4.95, status: "online", battery: 78, ordersToday: 18, earningsToday: 1120 },
        { id: "RIDER-05", name: "Ganesh Kulkarni", zone: "Main Market", phone: "+91 98765 00005", bikeNo: "MH 19 BK 1005", lat: 21.0440, lng: 75.7860, rating: 4.8, status: "busy", battery: 65, ordersToday: 9, earningsToday: 540 }
      ];
    },

    getRiders() {
      try {
        const stored = localStorage.getItem(this.RIDERS_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      const def = this.getDefaultRiders();
      this.saveRiders(def);
      return def;
    },

    saveRiders(riders) {
      localStorage.setItem(this.RIDERS_KEY, JSON.stringify(riders));
    },

    getRider(riderId) {
      const riders = this.getRiders();
      return riders.find(r => r.id === riderId) || null;
    },

    updateRiderLocation(riderId, lat, lng) {
      const riders = this.getRiders();
      const rider = riders.find(r => r.id === riderId);
      if (rider) {
        rider.lat = lat;
        rider.lng = lng;
        rider.lastActive = new Date().toISOString();
        this.saveRiders(riders);
      }
    },

    toggleRiderStatus(riderId, newStatus) {
      const riders = this.getRiders();
      const rider = riders.find(r => r.id === riderId);
      if (rider) {
        rider.status = newStatus;
        this.saveRiders(riders);
        return rider;
      }
      return null;
    }
  };

  window.BHUSAWAL_DISPATCH = DispatchEngine;
})(window);

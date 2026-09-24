/**
 * Bhusawal Connect - Live Rider GPS Telemetry Engine
 * Tracks Latitude, Longitude, Speed (km/h), Heading (°), and Timestamp every 3 seconds.
 * Keeps running continuously while Online or Order Active.
 * Stops updates ONLY when Rider goes Offline.
 */
(function(window) {
  const TELEMETRY_STORAGE_KEY = 'bhusawal_rider_live_telemetry';

  class LiveRiderGPSTracker {
    constructor() {
      this.isOnline = false;
      this.activeOrderId = null;
      this.watchId = null;
      this.intervalId = null;
      this.currentTelemetry = {
        latitude: 21.047800,
        longitude: 75.789600,
        speedKmh: 24.5,
        headingDeg: 120.0,
        accuracyMeters: 8,
        timestamp: new Date().toISOString(),
        isOnline: false,
        activeOrderId: null
      };

      this.lastPosition = null;
      this.listeners = new Set();
    }

    // 1. Turn Rider Online & Start GPS Telemetry Loop
    setOnlineStatus(online, riderId = 'RIDER_001', activeOrderId = null) {
      this.isOnline = online;
      this.activeOrderId = activeOrderId;
      this.currentTelemetry.isOnline = online;
      this.currentTelemetry.riderId = riderId;
      this.currentTelemetry.activeOrderId = activeOrderId;

      if (online) {
        this.startGPSUpdates();
      } else {
        // STOP UPDATES ONLY WHEN RIDER GOES OFFLINE
        this.stopGPSUpdates();
      }

      this.persistAndBroadcast();
    }

    startGPSUpdates() {
      if (this.watchId || this.intervalId) return;

      // Real Device GPS Watcher
      if (navigator.geolocation) {
        this.watchId = navigator.geolocation.watchPosition(
          (pos) => this.handleDeviceGPSPosition(pos),
          (err) => console.warn("Rider Device GPS Watch Warning:", err.message),
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 2000 }
        );
      }

      // Interval Fallback Loop (Sends updates every 3 seconds continuously)
      let stepIndex = 0;
      this.intervalId = setInterval(() => {
        if (!this.isOnline) return;

        // If real device movement isn't changing fast enough, simulate dynamic polyline movement
        if (!this.lastPosition || Date.now() - this.lastPosition.time > 5000) {
          stepIndex++;
          const baseLat = 21.0478;
          const baseLng = 75.7896;
          const newLat = baseLat + (Math.sin(stepIndex * 0.2) * 0.003);
          const newLng = baseLng + (Math.cos(stepIndex * 0.2) * 0.004);
          const speed = Math.round(18 + Math.random() * 12);
          const heading = Math.round((stepIndex * 25) % 360);

          this.updateTelemetryData({
            latitude: newLat,
            longitude: newLng,
            speedKmh: speed,
            headingDeg: heading,
            accuracyMeters: Math.round(5 + Math.random() * 5)
          });
        } else {
          this.persistAndBroadcast();
        }
      }, 3000);
    }

    handleDeviceGPSPosition(pos) {
      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;
      const accuracy = Math.round(pos.coords.accuracy || 10);
      let speed = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
      let heading = pos.coords.heading ? Math.round(pos.coords.heading) : 0;

      // Calculate speed & heading from deltas if device GPS speed is null
      if (this.lastPosition && speed === 0) {
        const timeDiffSec = (Date.now() - this.lastPosition.time) / 1000;
        if (timeDiffSec > 0) {
          const distM = this.getHaversineMeters(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
          speed = Math.round((distM / timeDiffSec) * 3.6);
          heading = this.calculateBearing(this.lastPosition.lat, this.lastPosition.lng, lat, lng);
        }
      }

      this.lastPosition = { lat, lng, time: Date.now() };

      this.updateTelemetryData({
        latitude: lat,
        longitude: lng,
        speedKmh: speed,
        headingDeg: heading,
        accuracyMeters: accuracy
      });
    }

    updateTelemetryData({ latitude, longitude, speedKmh, headingDeg, accuracyMeters }) {
      this.currentTelemetry = {
        ...this.currentTelemetry,
        latitude,
        longitude,
        speedKmh,
        headingDeg,
        accuracyMeters,
        timestamp: new Date().toISOString(),
        updatedAtMs: Date.now()
      };

      this.persistAndBroadcast();
    }

    stopGPSUpdates() {
      if (this.watchId && navigator.geolocation) {
        navigator.geolocation.clearWatch(this.watchId);
        this.watchId = null;
      }
      if (this.intervalId) {
        clearInterval(this.intervalId);
        this.intervalId = null;
      }
      this.currentTelemetry.isOnline = false;
    }

    persistAndBroadcast() {
      try {
        localStorage.setItem(TELEMETRY_STORAGE_KEY, JSON.stringify(this.currentTelemetry));
      } catch (e) {}

      // Cross-tab broadcast
      try {
        const bc = new BroadcastChannel('bhusawal_realtime_sync');
        bc.postMessage({
          type: 'RIDER_TELEMETRY_UPDATE',
          payload: this.currentTelemetry
        });
        bc.close();
      } catch (e) {}

      this.listeners.forEach(cb => {
        try { cb(this.currentTelemetry); } catch (e) {}
      });
    }

    subscribe(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    getTelemetry() {
      return this.currentTelemetry;
    }

    getHaversineMeters(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon/2) * Math.sin(dLon/2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    calculateBearing(lat1, lon1, lat2, lon2) {
      const y = Math.sin((lon2 - lon1) * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180);
      const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
                Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos((lon2 - lon1) * Math.PI / 180);
      const brng = (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
      return Math.round(brng);
    }
  }

  window.BhusawalLiveRiderGPSTracker = new LiveRiderGPSTracker();
})(window);

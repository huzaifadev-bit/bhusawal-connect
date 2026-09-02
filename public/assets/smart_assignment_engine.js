// Bhusawal Connect - Smart Dispatch & Assignment Engine
(function(window) {
  'use strict';

  const SmartAssignment = {
    findBestRiderForOrder(order, activeRiders = []) {
      if (!activeRiders || activeRiders.length === 0) return null;
      
      const availableRiders = activeRiders.filter(r => r.status === 'online' || r.status === 'idle');
      if (availableRiders.length === 0) return null;

      // Haversine distance calculation
      function getDist(lat1, lon1, lat2, lon2) {
        const R = 6371; // km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                  Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                  Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
      }

      const orderLat = order.storeLat || 21.0450;
      const orderLng = order.storeLng || 75.7900;

      let bestRider = null;
      let minDistance = Infinity;

      for (const rider of availableRiders) {
        const dist = getDist(rider.lat || 21.0450, rider.lng || 75.7900, orderLat, orderLng);
        if (dist < minDistance) {
          minDistance = dist;
          bestRider = rider;
        }
      }

      return {
        rider: bestRider,
        distanceKm: minDistance.toFixed(2),
        etaMins: Math.max(3, Math.round(minDistance * 3.5))
      };
    }
  };

  window.BHUSAWAL_ASSIGNMENT = SmartAssignment;
})(window);

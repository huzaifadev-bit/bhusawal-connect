// Bhusawal Delivery Zone Validator
(function(window) {
  const BHUSAWAL_CENTER = { lat: 21.0478, lng: 75.7896 };
  const MAX_DELIVERY_RADIUS_KM = 12.0; // 12 km radius covers Bhusawal, Varangaon, Deepnagar, Khadka

  function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function isWithinDeliveryZone(lat, lng) {
    if (!lat || !lng) return false;
    const distance = haversineDistance(BHUSAWAL_CENTER.lat, BHUSAWAL_CENTER.lng, parseFloat(lat), parseFloat(lng));
    return distance <= MAX_DELIVERY_RADIUS_KM;
  }

  function getDistanceToBhusawal(lat, lng) {
    if (!lat || !lng) return 0;
    return haversineDistance(BHUSAWAL_CENTER.lat, BHUSAWAL_CENTER.lng, parseFloat(lat), parseFloat(lng));
  }

  window.BhusawalDeliveryZone = {
    BHUSAWAL_CENTER,
    MAX_DELIVERY_RADIUS_KM,
    isWithinDeliveryZone,
    getDistanceToBhusawal,
    haversineDistance
  };
})(window);

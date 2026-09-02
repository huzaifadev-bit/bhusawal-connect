// Bhusawal Connect - Google Maps & Live Turn-by-Turn Navigation Engine
(function(window) {
  'use strict';

  const GoogleNav = {
    openTurnByTurn(lat, lng, label = 'Customer Location') {
      if (!lat || !lng) {
        alert('Invalid GPS coordinates for navigation.');
        return;
      }
      const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
      let url = '';
      if (isMobile) {
        url = `google.navigation:q=${lat},${lng}&mode=d`;
        // Fallback for iOS Apple Maps / Web if intent fails
        window.location.href = url;
        setTimeout(() => {
          window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, '_blank');
        }, 800);
      } else {
        url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
        window.open(url, '_blank');
      }
    },

    openStoreLocation(storeLat, storeLng, storeName = 'Store') {
      this.openTurnByTurn(storeLat, storeLng, storeName);
    },

    getDirectionsUrl(fromLat, fromLng, toLat, toLng) {
      return `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLng}&destination=${toLat},${toLng}&travelmode=driving`;
    }
  };

  window.BHUSAWAL_NAV = GoogleNav;
})(window);

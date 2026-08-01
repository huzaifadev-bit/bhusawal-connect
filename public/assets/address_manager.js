// Bhusawal Connect Address Manager
(function(window) {
  const STORAGE_KEY = 'bhusawal_addresses';
  const DEFAULT_ID_KEY = 'bhusawal_default_address_id';
  const DEFAULT_COORDS = { lat: 21.0478, lng: 75.7896 }; // Bhusawal Station Road

  class AddressManager {
    static getAddresses() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
      // Return default sample address if empty
      const initial = [{
        id: 'addr_default_1',
        flatNo: 'Flat 302',
        building: 'Shivaji Heights',
        street: 'Station Road',
        area: 'Shivaji Nagar',
        landmark: 'Near Railway Station',
        city: 'Bhusawal',
        state: 'Maharashtra',
        pincode: '425201',
        lat: 21.0520,
        lng: 75.7980,
        tag: 'Home',
        isDefault: true,
        fullAddress: 'Flat 302, Shivaji Heights, Station Road, Shivaji Nagar, Bhusawal, MH 425201'
      }];
      localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
      localStorage.setItem(DEFAULT_ID_KEY, 'addr_default_1');
      return initial;
    }

    static getDefaultAddress() {
      const addresses = this.getAddresses();
      const defaultId = localStorage.getItem(DEFAULT_ID_KEY);
      const found = addresses.find(a => a.id === defaultId || a.isDefault);
      return found || addresses[0] || null;
    }

    static saveAddress(addrData) {
      const addresses = this.getAddresses();
      const isNew = !addrData.id;
      const id = addrData.id || 'addr_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
      
      const fullAddress = `${addrData.flatNo || ''}, ${addrData.building || ''}, ${addrData.street || ''}, ${addrData.area || ''}, ${addrData.landmark ? 'Near ' + addrData.landmark + ', ' : ''}${addrData.city || 'Bhusawal'}, ${addrData.state || 'Maharashtra'} ${addrData.pincode || '425201'}`.replace(/,\s*,/g, ',').replace(/^,\s*/, '');

      const normalized = {
        id,
        flatNo: addrData.flatNo || '',
        building: addrData.building || '',
        street: addrData.street || '',
        area: addrData.area || '',
        landmark: addrData.landmark || '',
        city: addrData.city || 'Bhusawal',
        state: addrData.state || 'Maharashtra',
        pincode: addrData.pincode || '425201',
        lat: parseFloat(addrData.lat) || DEFAULT_COORDS.lat,
        lng: parseFloat(addrData.lng) || DEFAULT_COORDS.lng,
        tag: addrData.tag || 'Home',
        isDefault: Boolean(addrData.isDefault),
        fullAddress
      };

      if (normalized.isDefault || addresses.length === 0) {
        addresses.forEach(a => a.isDefault = false);
        normalized.isDefault = true;
        localStorage.setItem(DEFAULT_ID_KEY, id);
      }

      if (isNew) {
        addresses.push(normalized);
      } else {
        const index = addresses.findIndex(a => a.id === id);
        if (index >= 0) addresses[index] = normalized;
        else addresses.push(normalized);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
      
      // Also sync user location localStorage
      localStorage.setItem('bhusawal_user_address', normalized.fullAddress);
      localStorage.setItem('bhusawal_user_lat', normalized.lat);
      localStorage.setItem('bhusawal_user_lng', normalized.lng);

      if (window.BhusawalRealtime) {
        window.BhusawalRealtime.emit('address-updated', normalized);
      }

      return normalized;
    }

    static deleteAddress(id) {
      let addresses = this.getAddresses();
      addresses = addresses.filter(a => a.id !== id);
      if (addresses.length > 0 && !addresses.some(a => a.isDefault)) {
        addresses[0].isDefault = true;
        localStorage.setItem(DEFAULT_ID_KEY, addresses[0].id);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
      return addresses;
    }

    static setDefaultAddress(id) {
      const addresses = this.getAddresses();
      addresses.forEach(a => {
        a.isDefault = (a.id === id);
      });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
      localStorage.setItem(DEFAULT_ID_KEY, id);
      
      const def = addresses.find(a => a.id === id);
      if (def) {
        localStorage.setItem('bhusawal_user_address', def.fullAddress);
        localStorage.setItem('bhusawal_user_lat', def.lat);
        localStorage.setItem('bhusawal_user_lng', def.lng);
      }
      return def;
    }

    static validateAddress(addr) {
      const errors = [];
      if (!addr.flatNo || addr.flatNo.trim().length === 0) errors.push('House / Flat Number is required');
      if (!addr.street || addr.street.trim().length === 0) errors.push('Street name is required');
      if (!addr.area || addr.area.trim().length === 0) errors.push('Area / Locality is required');
      if (!addr.pincode || !/^\d{6}$/.test(addr.pincode.trim())) errors.push('Valid 6-digit PIN Code is required');
      
      if (window.BhusawalDeliveryZone && !window.BhusawalDeliveryZone.isWithinDeliveryZone(addr.lat, addr.lng)) {
        errors.push('Sorry, Bhusawal Connect does not currently deliver to this location.');
      }
      return errors;
    }

    static reverseGeocode(lat, lng, callback) {
      const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`;
      fetch(url, { headers: { 'User-Agent': 'BhusawalConnect/1.0' } })
        .then(res => res.json())
        .then(data => {
          if (data && data.address) {
            const a = data.address;
            const result = {
              street: a.road || a.pedestrian || a.suburb || '',
              area: a.suburb || a.neighbourhood || a.residential || a.village || 'Bhusawal Area',
              city: 'Bhusawal',
              state: a.state || 'Maharashtra',
              pincode: a.postcode || '425201'
            };
            callback(null, result);
          } else {
            callback(new Error('Address not found'), null);
          }
        })
        .catch(err => callback(err, null));
    }
  }

  window.AddressManager = AddressManager;
})(window);

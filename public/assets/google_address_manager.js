// Bhusawal Connect Production Google Address Manager & Location Picker
(function(window) {
  const STORAGE_KEY = 'bhusawal_addresses';
  const DEFAULT_ID_KEY = 'bhusawal_default_address_id';
  const BHUSAWAL_CENTER = { lat: 21.0478, lng: 75.7896 };

  class GoogleAddressManager {
    static getAddresses() {
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) {}
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
      return addresses.find(a => a.id === defaultId || a.isDefault) || addresses[0] || null;
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
        lat: parseFloat(addrData.lat) || BHUSAWAL_CENTER.lat,
        lng: parseFloat(addrData.lng) || BHUSAWAL_CENTER.lng,
        tag: addrData.tag || 'Home',
        isDefault: Boolean(addrData.isDefault),
        fullAddress
      };

      if (normalized.isDefault || addresses.length === 0) {
        addresses.forEach(a => a.isDefault = false);
        normalized.isDefault = true;
        localStorage.setItem(DEFAULT_ID_KEY, id);
      }

      if (isNew) addresses.push(normalized);
      else {
        const idx = addresses.findIndex(a => a.id === id);
        if (idx >= 0) addresses[idx] = normalized;
        else addresses.push(normalized);
      }

      localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
      localStorage.setItem('bhusawal_user_address', normalized.fullAddress);
      localStorage.setItem('bhusawal_user_lat', normalized.lat);
      localStorage.setItem('bhusawal_user_lng', normalized.lng);

      if (window.BhusawalRealtime) {
        window.BhusawalRealtime.emit('address-updated', normalized);
      }
      return normalized;
    }

    static deleteAddress(id) {
      let addresses = this.getAddresses().filter(a => a.id !== id);
      if (addresses.length > 0 && !addresses.some(a => a.isDefault)) {
        addresses[0].isDefault = true;
        localStorage.setItem(DEFAULT_ID_KEY, addresses[0].id);
      }
      localStorage.setItem(STORAGE_KEY, JSON.stringify(addresses));
      return addresses;
    }

    static setDefaultAddress(id) {
      const addresses = this.getAddresses();
      addresses.forEach(a => a.isDefault = (a.id === id));
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

    static reverseGeocodeGoogle(lat, lng, callback) {
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        const geocoder = new google.maps.Geocoder();
        geocoder.geocode({ location: { lat, lng } }, (results, status) => {
          if (status === 'OK' && results[0]) {
            const comp = results[0].address_components;
            let street = '', area = '', pincode = '425201';
            comp.forEach(c => {
              if (c.types.includes('route')) street = c.long_name;
              if (c.types.includes('sublocality') || c.types.includes('neighborhood')) area = c.long_name;
              if (c.types.includes('postal_code')) pincode = c.long_name;
            });
            callback(null, { street, area, city: 'Bhusawal', state: 'Maharashtra', pincode });
          } else {
            callback(new Error('Geocode failed'), null);
          }
        });
      } else {
        // Fallback Nominatim OpenStreetMap reverse geocoder
        window.AddressManager.reverseGeocode(lat, lng, callback);
      }
    }
  }

  window.GoogleAddressManager = GoogleAddressManager;
})(window);

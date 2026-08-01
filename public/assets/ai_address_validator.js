// Bhusawal Connect AI Address Validation Engine
(function(window) {
  class AIAddressValidator {
    static validate(addressObj) {
      const warnings = [];
      const suggestions = [];

      const flat = (addressObj.flatNo || '').trim();
      const street = (addressObj.street || '').trim();
      const area = (addressObj.area || '').trim();
      const pincode = (addressObj.pincode || '').trim();
      const city = (addressObj.city || '').trim();
      const lat = parseFloat(addressObj.lat);
      const lng = parseFloat(addressObj.lng);

      // Check missing House/Flat number
      if (!flat || flat.length === 0) {
        warnings.push('Incomplete Address: House / Flat / Door Number is missing.');
        suggestions.push('Add Flat/House No. (e.g., Flat 302, House No. 45)');
      }

      // Check missing street or area
      if (!street && !area) {
        warnings.push('Incomplete Address: Street name and Locality are missing.');
        suggestions.push('Add Street / Road & Locality name (e.g. Station Road, Shivaji Nagar)');
      }

      // Check PIN Code
      if (!pincode || !/^\d{6}$/.test(pincode)) {
        warnings.push('Incorrect PIN Code format.');
        suggestions.push('Use valid 6-digit PIN Code (e.g., 425201 for Bhusawal)');
      } else if (!pincode.startsWith('425')) {
        warnings.push('PIN Code does not match Bhusawal district region (425xxx).');
        suggestions.push('Bhusawal PIN Code is typically 425201');
      }

      // Check Delivery Zone
      if (window.BhusawalDeliveryZone && !window.BhusawalDeliveryZone.isWithinDeliveryZone(lat, lng)) {
        warnings.push('Out of Delivery Radius: Selected pin location is outside Bhusawal Connect service area.');
        suggestions.push('Drag pin closer to Bhusawal city center or choose a location within 12km');
      }

      // City validation
      if (city.toLowerCase() !== 'bhusawal' && city.toLowerCase() !== 'bhusawal city') {
        warnings.push('City name is set to ' + city + ' instead of Bhusawal.');
        suggestions.push('Change City to Bhusawal');
      }

      return {
        isValid: warnings.length === 0,
        warnings,
        suggestions
      };
    }
  }

  window.AIAddressValidator = AIAddressValidator;
})(window);

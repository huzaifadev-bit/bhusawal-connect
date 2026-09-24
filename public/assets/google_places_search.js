/**
 * Bhusawal Connect - Professional Google Places & Local Landmark Search Engine
 * Real-time autocomplete suggestions for Roads, Colonies, Landmarks, Hospitals,
 * Schools, Shops, Restaurants, Railway Station, Temples & Mosques in Bhusawal.
 */
(function(window) {

  // Local Bhusawal Comprehensive Landmark Database for instant fallback predictions
  const BHUSAWAL_PRESET_LANDMARKS = [
    { name: 'Bhusawal Junction Railway Station', address: 'Station Road, Railway Colony, Bhusawal, Maharashtra 425201', lat: 21.0475, lng: 75.7870, category: 'Railway Station', icon: '🚉' },
    { name: 'Civil Hospital Bhusawal', address: 'Civil Hospital Road, Khadaka Shivar, Bhusawal 425201', lat: 21.0440, lng: 75.7950, category: 'Hospital', icon: '🏥' },
    { name: 'Khandesh Thali & Restaurant', address: 'Station Road, near Subhash Chowk, Bhusawal', lat: 21.0495, lng: 75.7865, category: 'Restaurant', icon: '🍽️' },
    { name: 'Jamner Road Market Yard', address: 'Jamner Road, Municipal Colony, Bhusawal', lat: 21.0430, lng: 75.7885, category: 'Roads & Market', icon: '🛣️' },
    { name: 'Ordnance Factory Bhusawal', address: 'Varangaon Road, Ordnance Factory Colony, Bhusawal', lat: 21.0500, lng: 75.7950, category: 'Landmark', icon: '🏛️' },
    { name: 'Shree Sai Baba Temple Bhusawal', address: 'Station Road, near Railway Overbridge, Bhusawal', lat: 21.0488, lng: 75.7920, category: 'Temple', icon: '🛕' },
    { name: 'Jama Masjid Bhusawal', address: 'Main Market Road, near Old Town, Bhusawal', lat: 21.0445, lng: 75.7850, category: 'Mosque', icon: '🕌' },
    { name: 'St. Aloysius High School', address: 'Convent School Road, Railway Colony, Bhusawal', lat: 21.0460, lng: 75.7890, category: 'School', icon: '🏫' },
    { name: 'Mahafresh Mega Grocery Store', address: 'Station Road, Bhusawal, Maharashtra', lat: 21.0478, lng: 75.7896, category: 'Shops', icon: '🏪' },
    { name: 'Sai Jeevan Super Mart', address: 'Jamner Road, Khadaka Chowk, Bhusawal', lat: 21.0410, lng: 75.7920, category: 'Shops', icon: '🛒' },
    { name: 'Khadaka Colony', address: 'Khadaka Road, Bhusawal 425201', lat: 21.0520, lng: 75.7980, category: 'Colonies', icon: '🏡' },
    { name: 'Railway Colony East', address: 'Near Divisional Railway Office, Bhusawal', lat: 21.0470, lng: 75.7860, category: 'Colonies', icon: '🏡' }
  ];

  class GooglePlacesSearchEngine {
    constructor() {
      this.autocompleteService = null;
      this.placesService = null;
    }

    initService() {
      if (window.google && window.google.maps && window.google.maps.places) {
        if (!this.autocompleteService) {
          this.autocompleteService = new google.maps.places.AutocompleteService();
        }
      }
    }

    /**
     * Attach Google Places Autocomplete to any input field
     */
    attach(inputId, suggestionsContainerId, options = {}) {
      const input = document.getElementById(inputId);
      const suggestionsBox = document.getElementById(suggestionsContainerId);
      if (!input || !suggestionsBox) return;

      const { mapInstance, onSelect } = options;
      this.initService();

      let debounceTimer = null;

      input.addEventListener('input', (e) => {
        const query = e.target.value.trim();
        if (query.length < 2) {
          suggestionsBox.innerHTML = '';
          suggestionsBox.classList.add('hidden');
          return;
        }

        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.fetchPredictions(query, (results) => {
            this.renderPredictions(results, suggestionsBox, (selectedItem) => {
              input.value = selectedItem.name || selectedItem.address;
              suggestionsBox.innerHTML = '';
              suggestionsBox.classList.add('hidden');

              // Move Map, Drop Marker & Store Location
              this.handleLocationSelected(selectedItem, mapInstance);

              if (onSelect) onSelect(selectedItem);
            });
          });
        }, 200);
      });

      // Close box when clicking outside
      document.addEventListener('click', (e) => {
        if (!input.contains(e.target) && !suggestionsBox.contains(e.target)) {
          suggestionsBox.classList.add('hidden');
        }
      });
    }

    fetchPredictions(query, callback) {
      const lowerQuery = query.toLowerCase();

      // 1. Check local preset landmarks first
      const localMatches = BHUSAWAL_PRESET_LANDMARKS.filter(item => 
        item.name.toLowerCase().includes(lowerQuery) || 
        item.address.toLowerCase().includes(lowerQuery) ||
        item.category.toLowerCase().includes(lowerQuery)
      );

      // 2. Query Google Places Autocomplete API if SDK is active
      if (this.autocompleteService) {
        this.autocompleteService.getPlacePredictions({
          input: query,
          componentRestrictions: { country: 'in' },
          bounds: new google.maps.LatLngBounds(
            new google.maps.LatLng(21.0100, 75.7500),
            new google.maps.LatLng(21.0900, 75.8300)
          )
        }, (predictions, status) => {
          let combined = [...localMatches];

          if (status === google.maps.places.PlacesServiceStatus.OK && predictions) {
            predictions.forEach(p => {
              combined.push({
                name: p.structured_formatting ? p.structured_formatting.main_text : p.description,
                address: p.description,
                placeId: p.place_id,
                category: 'Google Place',
                icon: '📍',
                isGooglePlace: true
              });
            });
          }

          callback(combined.slice(0, 8));
        });
      } else {
        callback(localMatches.slice(0, 8));
      }
    }

    renderPredictions(items, containerEl, onSelectCallback) {
      if (!items || items.length === 0) {
        containerEl.innerHTML = '<div style="padding:12px;font-size:12px;color:#94A3B8;text-align:center;">No locations found in Bhusawal</div>';
        containerEl.classList.remove('hidden');
        return;
      }

      containerEl.innerHTML = items.map((item, idx) => `
        <div data-idx="${idx}" class="place-suggestion-item" style="padding:10px 14px;border-bottom:1px solid #1E293B;cursor:pointer;display:flex;align-items:center;gap:10px;transition:background 0.15s;" onmouseover="this.style.background='#1E293B'" onmouseout="this.style.background='transparent'">
          <span style="font-size:18px;">${item.icon || '📍'}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-size:13px;font-weight:700;color:#F8FAFC;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.name}</div>
            <div style="font-size:11px;color:#94A3B8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${item.address}</div>
          </div>
          <span style="font-size:9px;font-weight:800;background:rgba(59,130,246,0.15);color:#3B82F6;padding:2px 8px;border-radius:10px;">${item.category}</span>
        </div>
      `).join('');

      containerEl.classList.remove('hidden');

      const itemEls = containerEl.querySelectorAll('.place-suggestion-item');
      itemEls.forEach(el => {
        el.addEventListener('click', () => {
          const idx = parseInt(el.getAttribute('data-idx'));
          const selected = items[idx];

          if (selected.isGooglePlace && selected.placeId && window.google && window.google.maps) {
            // Resolve Google Place ID details to lat/lng
            const dummyDiv = document.createElement('div');
            const service = new google.maps.places.PlacesService(dummyDiv);
            service.getDetails({ placeId: selected.placeId, fields: ['geometry', 'formatted_address', 'name'] }, (place, status) => {
              if (status === google.maps.places.PlacesServiceStatus.OK && place && place.geometry) {
                const resolved = {
                  name: place.name || selected.name,
                  address: place.formatted_address || selected.address,
                  lat: place.geometry.location.lat(),
                  lng: place.geometry.location.lng(),
                  category: 'Google Place',
                  icon: '📍'
                };
                onSelectCallback(resolved);
              } else {
                onSelectCallback(selected);
              }
            });
          } else {
            onSelectCallback(selected);
          }
        });
      });
    }

    handleLocationSelected(item, mapInstance) {
      const lat = item.lat || 21.0478;
      const lng = item.lng || 75.7896;
      const address = item.address || item.name;

      // 1. Move Map & Drop Marker
      if (mapInstance) {
        if (window.google && window.google.maps && mapInstance instanceof google.maps.Map) {
          mapInstance.panTo({ lat, lng });
          mapInstance.setZoom(16);

          new google.maps.Marker({
            position: { lat, lng },
            map: mapInstance,
            title: item.name,
            animation: google.maps.Animation.DROP
          });
        } else if (typeof L !== 'undefined' && mapInstance.setView) {
          mapInstance.setView([lat, lng], 16);

          L.marker([lat, lng])
            .bindPopup(`<strong>${item.name}</strong><br><span style="font-size:11px;">${address}</span>`)
            .addTo(mapInstance)
            .openPopup();
        }
      }

      // 2. Store in LocalStorage via CustomerLocationManager
      if (window.BhusawalCustomerLocationManager) {
        window.BhusawalCustomerLocationManager.saveLocation({
          latitude: lat,
          longitude: lng,
          formattedAddress: address,
          accuracy: 5,
          isManual: true,
          placeName: item.name,
          category: item.category
        });
      }
    }
  }

  window.BhusawalGooglePlacesSearch = new GooglePlacesSearchEngine();
})(window);

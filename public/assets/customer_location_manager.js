/**
 * Bhusawal Connect - Customer Real-Time Location & Draggable Location Picker Engine
 * High-Accuracy GPS Detection, Draggable Map Pin, Live Drag Reverse Geocoding,
 * Manual Location Picker Modal & LocalStorage Persistence.
 */
(function(window) {
  const STORAGE_KEY = 'bhusawal_customer_gps_location';
  const DEFAULT_BHUSAWAL = {
    latitude: 21.0478,
    longitude: 75.7896,
    formattedAddress: 'Station Road Market, Bhusawal, Maharashtra 425201',
    accuracy: 15,
    timestamp: new Date().toISOString(),
    isManual: false
  };

  class CustomerLocationManager {
    constructor() {
      this.currentLocation = this.loadStoredLocation();
      this.watchId = null;
      this.listeners = new Set();
    }

    loadStoredLocation() {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) return JSON.parse(stored);
      } catch (e) {}
      return { ...DEFAULT_BHUSAWAL };
    }

    saveLocation(locationData) {
      this.currentLocation = {
        ...locationData,
        timestamp: new Date().toISOString(),
        updatedAtMs: Date.now()
      };
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.currentLocation));
      } catch (e) {}
      
      this.notifyListeners();
    }

    getLocation() {
      return this.currentLocation;
    }

    subscribe(callback) {
      this.listeners.add(callback);
      return () => this.listeners.delete(callback);
    }

    notifyListeners() {
      this.listeners.forEach(cb => {
        try { cb(this.currentLocation); } catch (e) {}
      });
      try {
        const bc = new BroadcastChannel('bhusawal_customer_location_sync');
        bc.postMessage(this.currentLocation);
        bc.close();
      } catch (e) {}
    }

    requestLocation(options = {}) {
      const { mapInstance, autoCenter = true, onSuccess, onError } = options;

      if (!navigator.geolocation) {
        if (onError) onError(new Error("Geolocation not supported"));
        this.openDraggableLocationPicker(mapInstance, onSelect => {
          if (onSuccess) onSuccess(onSelect);
        });
        return;
      }

      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const lat = position.coords.latitude;
          const lng = position.coords.longitude;
          const accuracy = Math.round(position.coords.accuracy || 10);
          const formattedAddress = await this.reverseGeocode(lat, lng);

          const locData = {
            latitude: lat,
            longitude: lng,
            formattedAddress: formattedAddress,
            accuracy: accuracy,
            isManual: false
          };

          this.saveLocation(locData);

          if (mapInstance) {
            this.renderCustomerBlueMarker(mapInstance, lat, lng, formattedAddress, autoCenter);
          }

          if (onSuccess) onSuccess(locData);
        },
        (error) => {
          console.warn("GPS Permission Denied or Timeout:", error.message);
          if (onError) onError(error);
          this.openDraggableLocationPicker(mapInstance, (selectedLoc) => {
            if (onSuccess) onSuccess(selectedLoc);
          });
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 5000 }
      );
    }

    async reverseGeocode(lat, lng) {
      if (window.google && window.google.maps && window.google.maps.Geocoder) {
        try {
          const geocoder = new google.maps.Geocoder();
          const response = await geocoder.geocode({ location: { lat, lng } });
          if (response.results && response.results[0]) {
            return response.results[0].formatted_address;
          }
        } catch (e) {}
      }

      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
        const data = await res.json();
        if (data && data.display_name) {
          return data.display_name;
        }
      } catch (e) {}

      return `Near ${lat.toFixed(4)}, ${lng.toFixed(4)}, Bhusawal, Maharashtra`;
    }

    renderCustomerBlueMarker(mapInstance, lat, lng, address, autoCenter = true) {
      if (!mapInstance) return;

      if (window.google && window.google.maps && mapInstance instanceof google.maps.Map) {
        if (autoCenter) {
          mapInstance.setCenter({ lat, lng });
          mapInstance.setZoom(16);
        }

        const marker = new google.maps.Marker({
          position: { lat, lng },
          map: mapInstance,
          title: '📍 Your Delivery Location',
          draggable: true,
          animation: google.maps.Animation.DROP
        });

        // Update address when dragging marker end
        marker.addListener('dragend', async (e) => {
          const newLat = e.latLng.lat();
          const newLng = e.latLng.lng();
          const newAddress = await this.reverseGeocode(newLat, newLng);

          this.saveLocation({
            latitude: newLat,
            longitude: newLng,
            formattedAddress: newAddress,
            accuracy: 5,
            isManual: true
          });
        });

        return marker;
      }

      if (typeof L !== 'undefined' && mapInstance.setView) {
        if (autoCenter) {
          mapInstance.setView([lat, lng], 16);
        }

        const blueIcon = L.divIcon({
          className: 'customer-draggable-pin',
          html: `
            <div style="position:relative;display:flex;align-items:center;justify-content:center;cursor:grab;">
              <div style="position:absolute;width:32px;height:32px;border-radius:50%;background:rgba(59,130,246,0.3);animation:ping 2s infinite;"></div>
              <div style="width:20px;height:20px;border-radius:50%;background:#2563EB;border:3px solid #FFFFFF;box-shadow:0 3px 10px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;color:#fff;font-size:10px;">📍</div>
            </div>
          `,
          iconSize: [32, 32],
          iconAnchor: [16, 16]
        });

        const marker = L.marker([lat, lng], { icon: blueIcon, draggable: true })
          .bindPopup(`<strong>📍 Delivery Location</strong><br><span style="font-size:11px;">${address}</span>`)
          .addTo(mapInstance);

        marker.on('dragend', async (e) => {
          const pos = marker.getLatLng();
          const newAddress = await this.reverseGeocode(pos.lat, pos.lng);

          this.saveLocation({
            latitude: pos.lat,
            longitude: pos.lng,
            formattedAddress: newAddress,
            accuracy: 5,
            isManual: true
          });
          marker.getPopup().setContent(`<strong>📍 Delivery Location</strong><br><span style="font-size:11px;">${newAddress}</span>`).openPopup();
        });

        return marker;
      }
    }

    /**
     * Interactive Draggable Location Picker Modal with Live Address Updates while Dragging
     */
    openDraggableLocationPicker(parentMap, onSelect) {
      const existing = document.getElementById('draggable-location-modal');
      if (existing) existing.remove();

      const loc = this.getLocation();
      const initialLat = loc.latitude || 21.0478;
      const initialLng = loc.longitude || 75.7896;

      const modalHtml = `
        <div id="draggable-location-modal" style="position:fixed;inset:0;background:rgba(15,23,42,0.85);backdrop-filter:blur(8px);z-index:99999;display:flex;align-items:center;justify-content:center;padding:16px;">
          <div style="background:#0F172A;border:1px solid #334155;border-radius:24px;width:100%;max-width:540px;padding:24px;color:#F8FAFC;box-shadow:0 25px 50px -12px rgba(0,0,0,0.6);font-family:sans-serif;" class="space-y-4">
            
            <div style="display:flex;align-items:center;justify-content:space-between;border-bottom:1px solid #1E293B;padding-bottom:12px;">
              <div>
                <h3 style="font-weight:900;font-size:17px;color:#F8FAFC;margin:0;display:flex;align-items:center;gap:6px;">
                  <span>📍 Drag Map & Pin to Set Delivery Location</span>
                </h3>
                <p style="font-size:11px;color:#94A3B8;margin:2px 0 0 0;">Move map or drag pin to your exact building or house doorstep</p>
              </div>
              <button id="btn-close-drag-modal" style="background:transparent;border:0;color:#94A3B8;font-size:22px;cursor:pointer;padding:4px;">✕</button>
            </div>

            <!-- Draggable Map Box -->
            <div style="position:relative;width:100%;height:260px;border-radius:16px;overflow:hidden;border:1px solid #334155;">
              <div id="picker-map-canvas" style="width:100%;height:100%;"></div>
            </div>

            <!-- Live Lat, Lng & Address Card -->
            <div style="background:#1E293B;padding:14px;border-radius:16px;border:1px solid #334155;" class="space-y-2">
              <div style="display:flex;gap:12px;font-family:monospace;font-size:11px;">
                <div><span style="color:#94A3B8;">LAT:</span> <span id="picker-disp-lat" style="color:#38BDF8;font-weight:bold;">${initialLat.toFixed(6)}</span></div>
                <div><span style="color:#94A3B8;">LNG:</span> <span id="picker-disp-lng" style="color:#38BDF8;font-weight:bold;">${initialLng.toFixed(6)}</span></div>
              </div>
              <div style="display:flex;align-items:flex-start;gap:8px;">
                <span style="color:#F59E0B;font-size:16px;">📍</span>
                <div>
                  <div style="font-size:10px;color:#94A3B8;font-weight:bold;text-transform:uppercase;">Live Address Preview</div>
                  <div id="picker-disp-address" style="font-size:12px;font-weight:bold;color:#FFFFFF;">${loc.formattedAddress || 'Dragging to update address...'}</div>
                </div>
              </div>
            </div>

            <!-- Save Action Button -->
            <button id="btn-confirm-drag-loc" style="width:100%;background:#2563EB;color:#FFFFFF;font-weight:900;font-size:14px;padding:14px;border-radius:14px;border:0;cursor:pointer;box-shadow:0 4px 14px rgba(37,99,235,0.4);transition:all;">
              Save This Location
            </button>

          </div>
        </div>
      `;

      document.body.insertAdjacentHTML('beforeend', modalHtml);

      const modalEl = document.getElementById('draggable-location-modal');
      const closeBtn = document.getElementById('btn-close-drag-modal');
      const confirmBtn = document.getElementById('btn-confirm-drag-loc');
      const latEl = document.getElementById('picker-disp-lat');
      const lngEl = document.getElementById('picker-disp-lng');
      const addrEl = document.getElementById('picker-disp-address');

      closeBtn.addEventListener('click', () => modalEl.remove());

      let currentLat = initialLat;
      let currentLng = initialLng;
      let currentAddr = loc.formattedAddress || 'Bhusawal, Maharashtra';

      // Initialize Leaflet Draggable Picker Map inside Modal
      setTimeout(() => {
        if (typeof L !== 'undefined') {
          const pickerMap = L.map('picker-map-canvas').setView([initialLat, initialLng], 16);
          L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '© OpenStreetMap'
          }).addTo(pickerMap);

          const pinIcon = L.divIcon({
            className: 'picker-pin',
            html: '<div style="background:#EF4444;color:#fff;width:34px;height:34px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:18px;box-shadow:0 4px 12px rgba(0,0,0,0.5);border:3px solid #fff;cursor:grab;">📍</div>',
            iconSize: [34, 34],
            iconAnchor: [17, 17]
          });

          const pickerMarker = L.marker([initialLat, initialLng], { icon: pinIcon, draggable: true }).addTo(pickerMap);

          const updateLocation = async (lat, lng) => {
            currentLat = lat;
            currentLng = lng;
            latEl.textContent = lat.toFixed(6);
            lngEl.textContent = lng.toFixed(6);
            addrEl.textContent = 'Updating street address...';

            currentAddr = await this.reverseGeocode(lat, lng);
            addrEl.textContent = currentAddr;
          };

          // Event 1: Marker drag
          pickerMarker.on('dragend', (e) => {
            const pos = pickerMarker.getLatLng();
            updateLocation(pos.lat, pos.lng);
          });

          // Event 2: Map pan move
          pickerMap.on('moveend', () => {
            const center = pickerMap.getCenter();
            pickerMarker.setLatLng(center);
            updateLocation(center.lat, center.lng);
          });
        }
      }, 200);

      confirmBtn.addEventListener('click', () => {
        const savedData = {
          latitude: currentLat,
          longitude: currentLng,
          formattedAddress: currentAddr,
          accuracy: 5,
          isManual: true
        };

        this.saveLocation(savedData);

        if (parentMap) {
          this.renderCustomerBlueMarker(parentMap, currentLat, currentLng, currentAddr, true);
        }

        modalEl.remove();

        if (onSelect) onSelect(savedData);
      });
    }
  }

  window.BhusawalCustomerLocationManager = new CustomerLocationManager();
})(window);

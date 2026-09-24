// Bhusawal Connect Production Google Maps Live Delivery Tracking Engine with Smooth Uber/Zepto Animation
(function(window) {
  class GoogleLiveTracker {
    constructor(containerId, options = {}) {
      this.containerId = containerId;
      this.storePos = options.storePos || { lat: 21.0455, lng: 75.7858 };
      this.custPos = options.custPos || { lat: 21.0520, lng: 75.7980 };
      this.riderPos = { ...this.storePos, heading: 0 };
      
      this.map = null;
      this.riderMarker = null;
      this.storeMarker = null;
      this.custMarker = null;
      this.routePolyline = null;
      this.directionsService = null;
      this.directionsRenderer = null;
      this.animator = null;

      this.lastNotifiedDist = Infinity;
      this.onNotification = options.onNotification || function() {};
      this.onEtaUpdate = options.onEtaUpdate || function() {};
      this.onStatusChange = options.onStatusChange || function() {};
      
      this.initMap();
    }

    initMap() {
      const container = document.getElementById(this.containerId);
      if (!container) return;

      if (window.google && window.google.maps) {
        // Initialize Google Maps JavaScript API instance
        this.map = new google.maps.Map(container, {
          center: { lat: (this.storePos.lat + this.custPos.lat) / 2, lng: (this.storePos.lng + this.custPos.lng) / 2 },
          zoom: 15,
          mapTypeId: google.maps.MapTypeId.ROADMAP,
          mapTypeControl: true,
          streetViewControl: false,
          fullscreenControl: true,
          zoomControl: true
        });

        // Store Marker
        this.storeMarker = new google.maps.Marker({
          position: this.storePos,
          map: this.map,
          title: "Bhusawal Express Store",
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/green-dot.png",
            scaledSize: new google.maps.Size(36, 36)
          }
        });

        // Customer Destination Marker
        this.custMarker = new google.maps.Marker({
          position: this.custPos,
          map: this.map,
          title: "Customer Delivery Spot",
          icon: {
            url: "https://maps.google.com/mapfiles/ms/icons/red-dot.png",
            scaledSize: new google.maps.Size(40, 40)
          }
        });

        // Rider Marker (Scooter SVG)
        const scooterSvg = `
          <svg xmlns="http://www.w3.org/2000/svg" width="44" height="44" viewBox="0 0 24 24" fill="#10B981" stroke="#ffffff" stroke-width="1.5">
            <path d="M19 13h-4l-2-5H8l-1 2H3v3h2a2 2 0 1 0 4 0h6a2 2 0 1 0 4 0h2v-2z"/>
            <circle cx="7" cy="16" r="2"/>
            <circle cx="17" cy="16" r="2"/>
          </svg>
        `;
        this.riderMarker = new google.maps.Marker({
          position: this.riderPos,
          map: this.map,
          title: "Bhusawal Connect Rider",
          icon: {
            url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(scooterSvg),
            anchor: new google.maps.Point(22, 22)
          }
        });

        // Initialize Smooth Uber/Zepto Animator
        if (window.BhusawalSmoothRiderAnimator) {
          this.animator = new window.BhusawalSmoothRiderAnimator(this.riderMarker, {
            initialLat: this.riderPos.lat,
            initialLng: this.riderPos.lng
          });
        }

        // Automatically zoom to fit both markers
        const bounds = new google.maps.LatLngBounds();
        bounds.extend(this.storePos);
        bounds.extend(this.custPos);
        this.map.fitBounds(bounds, 60);

        // Google Directions API Driving Route
        this.directionsService = new google.maps.DirectionsService();
        this.directionsRenderer = new google.maps.DirectionsRenderer({
          map: this.map,
          suppressMarkers: true,
          polylineOptions: { strokeColor: '#3B82F6', strokeWeight: 6, strokeOpacity: 0.85 }
        });

        this.calculateRoute();
      } else {
        // Leaflet fallback with Google Roadmap tiles
        this.initLeafletFallback(container);
      }

      this.subscribeRealtime();
    }

    initLeafletFallback(container) {
      this.map = L.map(container, { zoomControl: false, attributionControl: false }).setView([21.0487, 75.7919], 15);
      L.tileLayer('https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
        maxZoom: 20,
        subdomains: ['mt0', 'mt1', 'mt2', 'mt3']
      }).addTo(this.map);

      L.marker([this.storePos.lat, this.storePos.lng], {
        icon: L.divIcon({ html: '<div class="w-8 h-8 rounded-full bg-purple-600 text-white flex items-center justify-center text-sm shadow-md">🏪</div>', iconSize: [32, 32] })
      }).addTo(this.map);

      L.marker([this.custPos.lat, this.custPos.lng], {
        icon: L.divIcon({ html: '<div class="w-8 h-8 rounded-full bg-rose-600 text-white flex items-center justify-center text-sm shadow-md">📍</div>', iconSize: [32, 32] })
      }).addTo(this.map);

      this.riderMarker = L.marker([this.riderPos.lat, this.riderPos.lng], {
        icon: L.divIcon({
          className: 'uber-style-rider-pin',
          html: '<div class="rider-pin-icon w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center text-xl shadow-2xl border-2 border-white transition-all duration-100" style="transform-origin: center center;">🛵</div>',
          iconSize: [40, 40],
          iconAnchor: [20, 20]
        })
      }).addTo(this.map);

      // Initialize Smooth Uber/Zepto Animator
      if (window.BhusawalSmoothRiderAnimator) {
        this.animator = new window.BhusawalSmoothRiderAnimator(this.riderMarker, {
          initialLat: this.riderPos.lat,
          initialLng: this.riderPos.lng
        });
      }

      const bounds = L.latLngBounds([
        [this.storePos.lat, this.storePos.lng],
        [this.custPos.lat, this.custPos.lng]
      ]);
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }

    calculateRoute() {
      if (!this.directionsService) return;
      this.directionsService.route({
        origin: this.riderPos,
        destination: this.custPos,
        travelMode: google.maps.TravelMode.DRIVING
      }, (result, status) => {
        if (status === google.maps.DirectionsStatus.OK) {
          this.directionsRenderer.setDirections(result);
          const route = result.routes[0].legs[0];
          if (route && route.duration) {
            this.onEtaUpdate(route.duration.text, route.distance.text);
          }
        }
      });
    }

    // Uber / Blinkit / Zepto Smooth Rider Animation Engine (60 FPS Interpolation, Bearing Rotation, Zero Jumping)
    updateRiderLocation(targetLat, targetLng, heading = 0, roadPath = null) {
      if (this.animator) {
        this.animator.animateTo({ lat: targetLat, lng: targetLng }, roadPath, 2800);
      } else {
        if (this.riderMarker && typeof this.riderMarker.setLatLng === 'function') {
          this.riderMarker.setLatLng([targetLat, targetLng]);
        }
      }

      this.riderPos = { lat: targetLat, lng: targetLng, heading: heading };

      // Distance calculation & proximity alerts
      const distMeters = this.getHaversineMeters(targetLat, targetLng, this.custPos.lat, this.custPos.lng);
      
      if (distMeters <= 500 && this.lastNotifiedDist > 500) {
        this.onNotification('500M_NEARBY', 'Rider is approaching your area (< 500m away)');
      }
      if (distMeters <= 300 && this.lastNotifiedDist > 300) {
        this.onNotification('300M_NEARBY', 'Rider is nearby (< 300m away). Please prepare to receive your order!');
      }
      if (distMeters <= 100 && this.lastNotifiedDist > 100) {
        this.onNotification('100M_DOORSTEP', 'Rider is at your doorstep (< 100m)!');
      }
      if (distMeters <= 30) {
        this.onNotification('DELIVERED', 'Order Delivered!');
      }

      this.lastNotifiedDist = distMeters;
    }

    getHaversineMeters(lat1, lon1, lat2, lon2) {
      const R = 6371e3;
      const dLat = (lat2 - lat1) * Math.PI / 180;
      const dLon = (lon2 - lon1) * Math.PI / 180;
      const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
                Math.sin(dLon / 2) * Math.sin(dLon / 2);
      return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    }

    subscribeRealtime() {
      const handleTelemetry = () => {
        if (window.RealtimeGPSTelemetry) {
          const telemetry = window.RealtimeGPSTelemetry.getLatestTelemetry();
          if (telemetry && telemetry.lat && telemetry.lng) {
            this.updateRiderLocation(parseFloat(telemetry.lat), parseFloat(telemetry.lng), telemetry.heading || 0);
            this.onEtaUpdate(telemetry.etaMins, telemetry.distanceRemainingKm, telemetry.currentRoad);
            this.onStatusChange(telemetry.orderStatus);
          }
        }
      };

      window.addEventListener('gpsTelemetryUpdated', handleTelemetry);
      window.addEventListener('storage', handleTelemetry);

      if (window.BhusawalRealtime) {
        window.BhusawalRealtime.on('rider-location', (pos) => {
          if (pos && pos.lat && pos.lng) {
            this.updateRiderLocation(parseFloat(pos.lat), parseFloat(pos.lng), pos.heading || 0);
          }
        });

        window.BhusawalRealtime.on('order-status', (data) => {
          if (data && data.status) {
            this.onStatusChange(data.status);
          }
        });
      }
    }
  }

  window.GoogleLiveTracker = GoogleLiveTracker;
})(window);

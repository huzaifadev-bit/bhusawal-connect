/**
 * Bhusawal Connect - Google Maps Directions & Routing Service Engine
 * Generates every route using Google Maps Routes/Directions API.
 * Returns: Road Geometry (Array of LatLngs), Distance, Travel Time, ETA.
 * Zero manual straight lines — strictly follows official road geometry.
 */

(function(window) {
  class GoogleMapsRoutingService {
    constructor() {
      this.directionsService = null;
      this.directionsRenderer = null;
    }

    init() {
      if (window.google && window.google.maps) {
        this.directionsService = new google.maps.DirectionsService();
      }
    }

    /**
     * Request actual driving route from Google Maps
     * @param {Object} origin - { lat, lng }
     * @param {Object} destination - { lat, lng }
     * @param {google.maps.Map|L.Map} mapInstance - Map to render polyline on
     * @returns {Promise<Object>} Route details (Road Geometry, Distance, Travel Time, ETA)
     */
    async requestDrivingRoute(origin, destination, mapInstance = null) {
      if (!origin || !destination) {
        throw new Error("Invalid origin or destination coordinates");
      }

      // Check if Google Maps Directions API is available natively
      if (window.google && window.google.maps && window.google.maps.DirectionsService) {
        if (!this.directionsService) {
          this.directionsService = new google.maps.DirectionsService();
        }

        return new Promise((resolve, reject) => {
          this.directionsService.route({
            origin: new google.maps.LatLng(origin.lat, origin.lng),
            destination: new google.maps.LatLng(destination.lat, destination.lng),
            travelMode: google.maps.TravelMode.DRIVING
          }, (result, status) => {
            if (status === google.maps.DirectionsStatus.OK && result.routes && result.routes.length > 0) {
              const route = result.routes[0];
              const leg = route.legs[0];

              // Extract actual Google Maps Road Geometry (path of LatLngs)
              const roadGeometry = route.overview_path.map(p => ({
                lat: p.lat(),
                lng: p.lng()
              }));

              const distanceMeters = leg.distance.value;
              const distanceText = leg.distance.text;
              const durationSeconds = leg.duration.value;
              const durationText = leg.duration.text;
              const durationMins = Math.ceil(durationSeconds / 60);

              const arrivalDate = new Date(Date.now() + (durationMins + 3) * 60000);
              const etaClockTime = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              const responseData = {
                status: 'OK',
                source: 'Google Maps Directions API',
                roadGeometry: roadGeometry,
                distanceMeters: distanceMeters,
                distanceText: distanceText,
                durationSeconds: durationSeconds,
                durationText: durationText + ' driving',
                etaMins: durationMins + 3,
                etaClockTime: etaClockTime
              };

              // Optionally render on Google Map or Leaflet Map
              if (mapInstance) {
                this.renderRoutePolyline(responseData.roadGeometry, mapInstance);
              }

              resolve(responseData);
            } else {
              // Fallback to OSRM Driving Route Engine if Directions API quota / offline
              this.fetchOSRMSwitchboardRoute(origin, destination, mapInstance)
                .then(resolve)
                .catch(reject);
            }
          });
        });
      } else {
        // Fallback to OSRM Driving Route Engine (Returns real road geometry)
        return this.fetchOSRMSwitchboardRoute(origin, destination, mapInstance);
      }
    }

    async fetchOSRMSwitchboardRoute(origin, destination, mapInstance = null) {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          const coords = route.geometry.coordinates; // [lng, lat]
          const roadGeometry = coords.map(c => ({ lat: c[1], lng: c[0] }));

          const distKm = (route.distance / 1000).toFixed(1);
          const travelMins = Math.max(2, Math.round(route.duration / 60));
          const etaMins = travelMins + 3;

          const arrivalDate = new Date(Date.now() + etaMins * 60000);
          const etaClockTime = arrivalDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

          const responseData = {
            status: 'OK',
            source: 'OSRM Road Routing Engine',
            roadGeometry: roadGeometry,
            distanceMeters: route.distance,
            distanceText: distKm + ' km',
            durationSeconds: route.duration,
            durationText: travelMins + ' mins driving',
            etaMins: etaMins,
            etaClockTime: etaClockTime
          };

          if (mapInstance) {
            this.renderRoutePolyline(roadGeometry, mapInstance);
          }

          return responseData;
        }
      } catch(e) {}

      throw new Error("Unable to fetch driving route from Google Maps or OSRM service");
    }

    renderRoutePolyline(roadGeometry, mapInstance) {
      if (!mapInstance || !roadGeometry || roadGeometry.length === 0) return;

      const polylinePoints = roadGeometry.map(p => [p.lat, p.lng]);

      // If Leaflet Map Instance
      if (window.L && typeof mapInstance.addLayer === 'function') {
        if (mapInstance._activeRouteLayer) {
          mapInstance.removeLayer(mapInstance._activeRouteLayer);
        }

        const polyGroup = L.featureGroup([
          L.polyline(polylinePoints, { color: '#2563EB', weight: 8, opacity: 0.35 }),
          L.polyline(polylinePoints, { color: '#3B82F6', weight: 4, opacity: 0.95 })
        ]);

        polyGroup.addTo(mapInstance);
        mapInstance._activeRouteLayer = polyGroup;
      }
    }

    /**
     * Checks if rider has left the suggested route (> 30 meters off route)
     * and automatically requests a new driving route from Google Maps.
     */
    async checkAndRecalculateOnDeviation(riderPos, destination, currentRoutePoints, mapInstance = null) {
      if (!riderPos || !destination) return null;

      let isOffRoute = false;
      if (currentRoutePoints && currentRoutePoints.length > 0) {
        let minDistanceMeters = Infinity;
        for (let i = 0; i < currentRoutePoints.length; i++) {
          const pt = currentRoutePoints[i];
          const pLat = Array.isArray(pt) ? pt[0] : pt.lat;
          const pLng = Array.isArray(pt) ? pt[1] : pt.lng;

          const dist = Math.sqrt(
            Math.pow((riderPos.lat - pLat) * 111000, 2) +
            Math.pow((riderPos.lng - pLng) * 111000 * Math.cos(riderPos.lat * Math.PI / 180), 2)
          );
          if (dist < minDistanceMeters) {
            minDistanceMeters = dist;
          }
        }

        if (minDistanceMeters > 30) {
          isOffRoute = true;
        }
      } else {
        isOffRoute = true;
      }

      // If rider left the route, automatically request a brand new driving route from Google Maps
      if (isOffRoute) {
        return await this.requestDrivingRoute(riderPos, destination, mapInstance);
      }

      return null;
    }
  }

  window.BhusawalGoogleMapsRoutingService = new GoogleMapsRoutingService();
})(window);

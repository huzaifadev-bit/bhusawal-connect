/**
 * ====================================================================
 * BHUSAWAL CONNECT — UBER / BLINKIT / ZEPTO SMOOTH RIDER MOVEMENT ENGINE
 * ====================================================================
 * High-Precision 60 FPS Rider Marker Interpolation & Bearing Rotation.
 * Features:
 * 1. Zero Marker Jumping — Smooth requestAnimationFrame lerping.
 * 2. Dynamic Marker Heading Rotation — Smoothly rotates vehicle icon in movement direction.
 * 3. Follows Road Network — Interpolates along road polyline segments.
 * 4. Micro-Interpolation — Fills gaps between 3-second telemetry updates.
 * 5. Handle 360° Rollover — Prevents wild spinning when heading crosses north (0°/360°).
 */

(function(window) {
  'use strict';

  function toRad(deg) { return deg * Math.PI / 180; }
  function toDeg(rad) { return rad * 180 / Math.PI; }

  // Calculates initial bearing between two GPS coordinates
  function calculateBearing(lat1, lon1, lat2, lon2) {
    var dLon = toRad(lon2 - lon1);
    var y = Math.sin(dLon) * Math.cos(toRad(lat2));
    var x = Math.cos(toRad(lat1)) * Math.sin(toRad(lat2)) -
            Math.sin(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.cos(dLon);
    var brng = toDeg(Math.atan2(y, x));
    return (brng + 360) % 360;
  }

  // Smoothly interpolates angles taking the shortest arc
  function interpolateAngle(fromAngle, toAngle, progress) {
    var diff = (toAngle - fromAngle + 180) % 360 - 180;
    return (fromAngle + diff * progress + 360) % 360;
  }

  // Easing function for natural vehicle acceleration/deceleration
  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  class SmoothRiderAnimator {
    constructor(markerElement, options) {
      this.marker = markerElement; // Leaflet or Google Maps Marker instance
      this.options = options || {};
      
      this.currentLat = options.initialLat || 21.0478;
      this.currentLng = options.initialLng || 75.7896;
      this.currentHeading = options.initialHeading || 0;

      this.animFrameId = null;
      this.isAnimating = false;
      this.onPositionUpdate = options.onPositionUpdate || function() {};
    }

    /**
     * Smoothly animates marker to new target position following road route waypoints.
     * @param {Object} targetPos - { lat, lng }
     * @param {Array} roadPath - Array of road coordinate pairs [[lat, lng], ...]
     * @param {Number} durationMs - Animation duration (default 2800ms to span telemetry updates)
     */
    animateTo(targetPos, roadPath, durationMs) {
      durationMs = durationMs || 2800;
      if (!targetPos || (targetPos.lat === this.currentLat && targetPos.lng === this.currentLng)) return;

      var startLat = this.currentLat;
      var startLng = this.currentLng;
      var startHeading = this.currentHeading;

      // Calculate target heading direction
      var targetHeading = calculateBearing(startLat, startLng, targetPos.lat, targetPos.lng);

      // Build route points path for smooth road-following
      var waypoints = (roadPath && roadPath.length > 0) ? roadPath : [
        [startLat, startLng],
        [targetPos.lat, targetPos.lng]
      ];

      var startTime = performance.now();
      var self = this;

      if (this.animFrameId) {
        cancelAnimationFrame(this.animFrameId);
      }

      this.isAnimating = true;

      function step(now) {
        var elapsed = now - startTime;
        var rawProgress = Math.min(1, elapsed / durationMs);
        var easedProgress = easeOutCubic(rawProgress);

        // Interpolate along route waypoints
        var pointCount = waypoints.length;
        var currentLat, currentLng;

        if (pointCount <= 2) {
          currentLat = startLat + (targetPos.lat - startLat) * easedProgress;
          currentLng = startLng + (targetPos.lng - startLng) * easedProgress;
        } else {
          // Multi-segment polyline path interpolation
          var segmentIndex = Math.min(pointCount - 2, Math.floor(easedProgress * (pointCount - 1)));
          var segmentProgress = (easedProgress * (pointCount - 1)) - segmentIndex;
          
          var p1 = waypoints[segmentIndex];
          var p2 = waypoints[segmentIndex + 1];

          currentLat = p1[0] + (p2[0] - p1[0]) * segmentProgress;
          currentLng = p1[1] + (p2[1] - p1[1]) * segmentProgress;

          targetHeading = calculateBearing(p1[0], p1[1], p2[0], p2[1]);
        }

        var animatedHeading = interpolateAngle(startHeading, targetHeading, easedProgress);

        self.currentLat = currentLat;
        self.currentLng = currentLng;
        self.currentHeading = animatedHeading;

        // Apply position & rotation smoothly to marker
        self.applyMarkerTransform(currentLat, currentLng, animatedHeading);

        if (rawProgress < 1) {
          self.animFrameId = requestAnimationFrame(step);
        } else {
          self.isAnimating = false;
        }
      }

      this.animFrameId = requestAnimationFrame(step);
    }

    applyMarkerTransform(lat, lng, heading) {
      if (!this.marker) return;

      // Leaflet Marker Support
      if (typeof this.marker.setLatLng === 'function') {
        this.marker.setLatLng([lat, lng]);
        
        // Rotate Icon Element if available
        var iconEl = this.marker.getElement ? this.marker.getElement() : null;
        if (iconEl) {
          var innerPin = iconEl.querySelector('.rider-pin-icon') || iconEl;
          innerPin.style.transform = 'rotate(' + Math.round(heading) + 'deg)';
          innerPin.style.transition = 'transform 0.1s linear';
        }
      } 
      // Google Maps Marker Support
      else if (window.google && window.google.maps && this.marker instanceof google.maps.Marker) {
        this.marker.setPosition(new google.maps.LatLng(lat, lng));
        var icon = this.marker.getIcon();
        if (icon && typeof icon === 'object') {
          icon.rotation = Math.round(heading);
          this.marker.setIcon(icon);
        }
      }

      this.onPositionUpdate({ lat: lat, lng: lng, heading: heading });
    }
  }

  window.BhusawalSmoothRiderAnimator = SmoothRiderAnimator;
})(window);

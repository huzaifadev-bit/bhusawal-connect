// Bhusawal Connect Google Maps Loader & Key Manager
(function(window) {
  const DEFAULT_KEY_STORAGE = 'bhusawal_google_maps_key';

  class GoogleMapsLoader {
    static getApiKey() {
      if (window.GOOGLE_MAPS_API_KEY) return window.GOOGLE_MAPS_API_KEY;
      try {
        const stored = localStorage.getItem(DEFAULT_KEY_STORAGE);
        if (stored) return stored;
      } catch (e) {}
      const urlParams = new URLSearchParams(window.location.search);
      if (urlParams.get('gkey')) return urlParams.get('gkey');
      return '';
    }

    static setApiKey(key) {
      try {
        localStorage.setItem(DEFAULT_KEY_STORAGE, key);
      } catch (e) {}
      window.GOOGLE_MAPS_API_KEY = key;
    }

    static load(callback) {
      if (window.google && window.google.maps) {
        if (callback) callback(null, window.google.maps);
        return;
      }

      const apiKey = this.getApiKey();
      if (!apiKey) {
        console.warn("Google Maps API Key not provided. Initializing Google Maps Tile engine fallback.");
        if (callback) callback(new Error("MISSING_KEY"), null);
        return;
      }

      if (document.getElementById('google-maps-sdk')) {
        // Already loading script
        let checkInterval = setInterval(() => {
          if (window.google && window.google.maps) {
            clearInterval(checkInterval);
            if (callback) callback(null, window.google.maps);
          }
        }, 100);
        return;
      }

      const script = document.createElement('script');
      script.id = 'google-maps-sdk';
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,geometry,drawing&callback=__onGoogleMapsLoaded`;
      script.async = true;
      script.defer = true;

      window.__onGoogleMapsLoaded = () => {
        if (callback) callback(null, window.google.maps);
      };

      script.onerror = (err) => {
        console.error("Failed to load Google Maps SDK:", err);
        if (callback) callback(err, null);
      };

      document.head.appendChild(script);
    }

    static renderSetupError(containerId, onKeySaved) {
      const el = document.getElementById(containerId);
      if (!el) return;
      el.innerHTML = `
        <div class="bg-slate-900 text-white p-5 rounded-2xl border border-amber-500/40 shadow-xl space-y-3">
          <div class="flex items-center gap-2 text-amber-400 font-black text-xs">
            <span class="material-symbols-outlined">map</span>
            <span>Google Maps API Key Required</span>
          </div>
          <p class="text-xs text-slate-300">Enter your Google Maps JavaScript API Key below to enable satellite view, places search, traffic routing & live GPS tracking:</p>
          <div class="flex gap-2">
            <input type="text" id="gmaps-key-input" placeholder="AIzaSy..." class="flex-1 bg-slate-800 border border-slate-700 text-white text-xs px-3 py-2 rounded-xl outline-none focus:border-amber-400" />
            <button id="btn-save-gmaps-key" class="bg-amber-500 hover:bg-amber-600 text-slate-950 font-black text-xs px-4 py-2 rounded-xl active:scale-95 transition-all">Save Key</button>
          </div>
          <p class="text-[10px] text-slate-400 italic">Fallback engine currently active with Google Maps Roadmap & Satellite Tiles.</p>
        </div>
      `;
      document.getElementById('btn-save-gmaps-key')?.addEventListener('click', () => {
        const val = document.getElementById('gmaps-key-input')?.value.trim();
        if (val) {
          GoogleMapsLoader.setApiKey(val);
          if (onKeySaved) onKeySaved();
          else window.location.reload();
        }
      });
    }
  }

  window.GoogleMapsLoader = GoogleMapsLoader;
})(window);

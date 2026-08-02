/**
 * Bhusawal Connect Universal Instant Search Engine
 * Features: Live suggestions, Recent searches, Trending searches, Popular categories,
 * Brand suggestions, Voice search, Highlighted matches, Fast in-memory search.
 */

(function() {
  let fullCatalog = [];
  let catalogLoaded = false;

  let extractedBrands = [];
  let extractedCategories = [];
  let trendingQueries = [];

  // 1. Load database
  fetch('/grocery_catalog.json')
    .then(res => res.json())
    .then(data => {
      fullCatalog = data;
      catalogLoaded = true;
      extractCatalogMetadata();
      initUniversalSearch();
      checkUrlParams();
    })
    .catch(err => console.error('Error loading catalog for search:', err));

  function extractCatalogMetadata() {
    const brandMap = new Map();
    const catMap = new Map();

    fullCatalog.forEach(p => {
      const b = (p["Brand Name"] || p.brand || '').trim();
      const c = (p.Category || '').trim();

      if (b && b.length > 1) {
        brandMap.set(b.toLowerCase(), b);
      }
      if (c && c.length > 1) {
        catMap.set(c, (catMap.get(c) || 0) + 1);
      }
    });

    extractedBrands = Array.from(brandMap.values()).slice(0, 10);
    extractedCategories = Array.from(catMap.keys()).slice(0, 8);

    // Dynamic Trending Searches from actual catalog
    trendingQueries = fullCatalog
      .slice(0, 12)
      .map(p => (p["Product Name"] || p.name || '').split(' (')[0].split(',')[0].trim())
      .filter((v, i, a) => v && v.length > 3 && a.indexOf(v) === i)
      .slice(0, 6);
  }

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const modalTitle = params.get('openModal');

    if (modalTitle && fullCatalog.length > 0) {
      const item = fullCatalog.find(p => 
        (p["Product Name"] || '').toLowerCase() === modalTitle.toLowerCase() || 
        (p["Product Name"] || '').toLowerCase().includes(modalTitle.toLowerCase())
      );
      if (item && window.openProductModal) {
        setTimeout(() => window.openProductModal(item), 250);
      }
    }
  }

  // 2. Recent Searches (LocalStorage)
  function getRecentSearches() {
    try {
      return JSON.parse(localStorage.getItem('bhusawal_recent_searches') || '[]');
    } catch(e) { return []; }
  }

  function addRecentSearch(query) {
    if (!query || query.trim().length < 2) return;
    const q = query.trim();
    let recent = getRecentSearches().filter(item => item.toLowerCase() !== q.toLowerCase());
    recent.unshift(q);
    recent = recent.slice(0, 5);
    localStorage.setItem('bhusawal_recent_searches', JSON.stringify(recent));
  }

  function removeRecentSearch(query) {
    let recent = getRecentSearches().filter(item => item.toLowerCase() !== query.toLowerCase());
    localStorage.setItem('bhusawal_recent_searches', JSON.stringify(recent));
  }

  function clearAllRecentSearches() {
    localStorage.removeItem('bhusawal_recent_searches');
  }

  // 3. Highlight Matching Text
  function highlightMatch(text, query) {
    if (!query || !text) return text || '';
    const qEsc = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp('(' + qEsc + ')', 'gi');
    return text.replace(regex, '<mark class="bg-purple-100 text-purpleBrand font-extrabold px-0.5 rounded-xs">$1</mark>');
  }

  // 4. Fast Catalog Search
  function searchCatalog(query) {
    if (!query) return { products: [], brands: [], categories: [] };
    const q = query.toLowerCase().trim();

    const matchedProducts = [];
    const matchedBrands = new Set();
    const matchedCategories = new Set();

    for (let i = 0; i < fullCatalog.length; i++) {
      const p = fullCatalog[i];
      const name = (p["Product Name"] || p.name || '').toLowerCase();
      const brand = (p["Brand Name"] || p.brand || '').toLowerCase();
      const cat = (p.Category || '').toLowerCase();
      const subcat = (p.Subcategory || '').toLowerCase();
      const kw = (p["Search Keywords"] || p.kw || '').toLowerCase();

      const isMatch = name.includes(q) || brand.includes(q) || cat.includes(q) || subcat.includes(q) || kw.includes(q);

      if (isMatch) {
        if (matchedProducts.length < 10) {
          matchedProducts.push(p);
        }
        if (brand.includes(q) && brand.length > 1) {
          matchedBrands.add(p["Brand Name"] || p.brand);
        }
        if (cat.includes(q) && cat.length > 1) {
          matchedCategories.add(p.Category);
        }
      }
    }

    return {
      products: matchedProducts,
      brands: Array.from(matchedBrands).slice(0, 4),
      categories: Array.from(matchedCategories).slice(0, 4)
    };
  }

  // 5. Initialize Search Inputs on Current Page
  function initUniversalSearch() {
    const searchInputs = document.querySelectorAll('input[type="text"]');
    
    searchInputs.forEach(input => {
      const placeholder = (input.placeholder || '').toLowerCase();
      const id = (input.id || '').toLowerCase();
      
      if (placeholder.includes('search') || id.includes('search')) {
        bindSearchInput(input);
      }
    });
  }

  function bindSearchInput(input) {
    let container = input.parentElement;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    // Attach Voice Search Mic Icon if not present
    if (!container.querySelector('.voice-search-btn')) {
      const micBtn = document.createElement('button');
      micBtn.type = 'button';
      micBtn.className = 'voice-search-btn absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full flex items-center justify-center text-slate-400 hover:text-purpleBrand hover:bg-purple-50 active:scale-90 transition-all z-10';
      micBtn.title = 'Voice Search';
      micBtn.innerHTML = '<span class="material-symbols-outlined text-lg">mic</span>';
      container.appendChild(micBtn);

      micBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        triggerVoiceSearch(input, dropdown);
      });
    }

    // Create / Get Dropdown
    let dropdown = container.querySelector('.zepto-universal-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'zepto-universal-dropdown absolute left-0 right-0 top-full mt-2 bg-white/98 backdrop-blur-xl rounded-3xl shadow-2xl border border-slate-100 z-[9999] hidden max-h-[85vh] overflow-y-auto divide-y divide-slate-100/80 animate-in fade-in slide-in-from-top-2 duration-200';
      container.appendChild(dropdown);
    }

    let debounceTimeout;

    input.addEventListener('focus', () => {
      const q = input.value.trim();
      renderDropdown(dropdown, input, q);
    });

    input.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      const q = e.target.value.trim();
      debounceTimeout = setTimeout(() => {
        renderDropdown(dropdown, input, q);
      }, 60);
    });

    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        const q = input.value.trim();
        if (q) {
          addRecentSearch(q);
          dropdown.classList.add('hidden');
          window.location.href = '/grocery?search=' + encodeURIComponent(q);
        }
      }
    });

    document.addEventListener('click', (e) => {
      if (!container.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  // 6. Voice Search Simulation & Web Speech API integration
  function triggerVoiceSearch(input, dropdown) {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

    if (SpeechRecognition) {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.start();

        input.placeholder = '🎙️ Listening... Speak product name now...';

        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          input.value = transcript;
          input.placeholder = 'Search 5,000+ items across all categories...';
          addRecentSearch(transcript);
          renderDropdown(dropdown, input, transcript);
        };

        recognition.onerror = () => {
          input.placeholder = 'Search 5,000+ items across all categories...';
        };
      } catch(e) {
        showVoiceModal(input, dropdown);
      }
    } else {
      showVoiceModal(input, dropdown);
    }
  }

  function showVoiceModal(input, dropdown) {
    let voiceModal = document.getElementById('voice-search-modal');
    if (!voiceModal) {
      voiceModal = document.createElement('div');
      voiceModal.id = 'voice-search-modal';
      voiceModal.className = 'fixed inset-0 z-[10000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4';
      voiceModal.innerHTML = `
        <div class="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full text-center space-y-4 shadow-2xl relative">
          <button class="close-voice-modal absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 hover:bg-slate-200">
            <span class="material-symbols-outlined text-sm">close</span>
          </button>
          <div class="w-16 h-16 rounded-full bg-purple-100 text-purpleBrand mx-auto flex items-center justify-center animate-pulse">
            <span class="material-symbols-outlined text-3xl">mic</span>
          </div>
          <div>
            <h3 class="text-base font-black font-display text-slate-900">Voice Search</h3>
            <p class="text-xs text-slate-500 font-medium mt-1">Listening for products in Bhusawal...</p>
          </div>
          <div class="flex flex-wrap justify-center gap-2 pt-2">
            <button class="voice-sample-btn px-3 py-1.5 bg-slate-100 hover:bg-purpleBrand hover:text-white rounded-full text-xs font-bold text-slate-700 transition-all" data-text="Amul Milk">"Amul Milk"</button>
            <button class="voice-sample-btn px-3 py-1.5 bg-slate-100 hover:bg-purpleBrand hover:text-white rounded-full text-xs font-bold text-slate-700 transition-all" data-text="Bhusawal Banana">"Bhusawal Banana"</button>
            <button class="voice-sample-btn px-3 py-1.5 bg-slate-100 hover:bg-purpleBrand hover:text-white rounded-full text-xs font-bold text-slate-700 transition-all" data-text="Fortune Oil">"Fortune Oil"</button>
          </div>
        </div>
      `;
      document.body.appendChild(voiceModal);

      voiceModal.querySelector('.close-voice-modal').onclick = () => {
        voiceModal.classList.add('hidden');
      };

      voiceModal.querySelectorAll('.voice-sample-btn').forEach(btn => {
        btn.onclick = () => {
          const sampleText = btn.dataset.text;
          input.value = sampleText;
          addRecentSearch(sampleText);
          voiceModal.classList.add('hidden');
          renderDropdown(dropdown, input, sampleText);
        };
      });
    }

    voiceModal.classList.remove('hidden');
  }

  // 7. Render Dropdown Interface
  function renderDropdown(dropdown, input, query) {
    if (!query) {
      renderDefaultDropdown(dropdown, input);
      return;
    }

    const searchResults = searchCatalog(query);
    const { products, brands, categories } = searchResults;

    if (products.length === 0 && brands.length === 0 && categories.length === 0) {
      dropdown.innerHTML = `
        <div class="p-8 text-center space-y-2">
          <span class="material-symbols-outlined text-3xl text-slate-300">search_off</span>
          <p class="text-xs font-black text-slate-800">No products found for "${query}"</p>
          <p class="text-[11px] font-bold text-slate-400">Try searching for "Milk", "Atta", "Oil", "Banana", or "Biscuits"</p>
        </div>
      `;
      dropdown.classList.remove('hidden');
      return;
    }

    let html = '';

    // Brand & Category Suggestions Row
    if (brands.length > 0 || categories.length > 0) {
      html += '<div class="p-3 bg-slate-50/80 space-y-2">';
      html += '<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Suggestions & Brands</span>';
      html += '<div class="flex flex-wrap gap-1.5">';
      
      brands.forEach(b => {
        html += `<button class="brand-chip-btn px-3 py-1 rounded-xl bg-purple-50 hover:bg-purpleBrand hover:text-white border border-purple-200/60 text-purpleBrand text-xs font-black transition-all flex items-center gap-1" data-brand="${b}">
          <span>🏷️</span>
          <span>${highlightMatch(b, query)}</span>
        </button>`;
      });

      categories.forEach(c => {
        html += `<button class="cat-chip-btn px-3 py-1 rounded-xl bg-slate-100 hover:bg-purpleBrand hover:text-white text-slate-700 text-xs font-extrabold transition-all flex items-center gap-1" data-category="${c}">
          <span>📁</span>
          <span>${highlightMatch(c, query)}</span>
        </button>`;
      });

      html += '</div></div>';
    }

    // Matching Products List
    html += '<div class="p-2 space-y-1">';
    html += `<div class="px-2 py-1 text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center justify-between">
      <span>Matching Products (${products.length})</span>
      <span class="text-purpleBrand font-extrabold">Instant Search</span>
    </div>`;

    products.forEach(p => {
      const id = p["Product ID"] || p.ProductID || p.id || '';
      const name = p["Product Name"] || p.name || '';
      const brand = p["Brand Name"] || p.brand || 'Bhusawal Fresh';
      const pack = p["Pack Size"] || p.pack || '1 Unit';
      const mrp = parseFloat(p.MRP || p.mrp || 0);
      const price = parseFloat(p["Selling Price"] || p.sp || mrp);
      const img = p["Product Image URL"] || p.img || '/assets/c183e18c0ed9f3d665c77b7c2d692a70.jpg';
      const nameHighlighted = highlightMatch(name, query);

      html += `
        <div class="search-product-row p-2.5 rounded-2xl hover:bg-slate-50 cursor-pointer flex items-center justify-between transition-colors group" data-id="${id}" data-name="${name.replace(/"/g, '&quot;')}" data-price="${price}" data-img="${img}">
          <div class="flex items-center gap-3 min-w-0 flex-1 pr-2">
            <div class="w-10 h-10 rounded-xl bg-white p-1 border border-slate-200/80 flex items-center justify-center flex-shrink-0 shadow-xs">
              <img src="${img}" alt="${name}" class="max-h-full max-w-full object-contain group-hover:scale-105 transition-transform" onerror="this.onerror=null;this.src='/assets/c183e18c0ed9f3d665c77b7c2d692a70.jpg';" />
            </div>
            <div class="min-w-0 flex-1">
              <span class="text-[9px] font-extrabold text-purpleBrand uppercase tracking-wider block">${brand}</span>
              <h4 class="text-xs text-slate-800 font-bold truncate leading-tight">${nameHighlighted}</h4>
              <p class="text-[10px] text-slate-400 font-bold mt-0.5">${pack}</p>
            </div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            <div class="text-right">
              <span class="text-xs font-black text-slate-900 block leading-none">₹${price}</span>
              ${mrp > price ? `<span class="text-[9px] font-bold text-slate-400 line-through">₹${mrp}</span>` : ''}
            </div>
            <button class="px-3 py-1 bg-purple-50 group-hover:bg-purpleBrand text-purpleBrand group-hover:text-white border border-purple-200 text-[10px] font-black rounded-lg transition-all">
              VIEW
            </button>
          </div>
        </div>
      `;
    });
    html += '</div>';

    // Show All Results Footer Row
    html += `
      <div class="search-footer-row p-3 bg-purple-50/50 hover:bg-purple-100/60 transition-colors flex items-center justify-between cursor-pointer text-xs font-black text-purpleBrand">
        <div class="flex items-center gap-2">
          <span class="material-symbols-outlined text-base">search</span>
          <span>View all results for <strong>"${query}"</strong> in Grocery Superstore</span>
        </div>
        <span class="material-symbols-outlined text-sm">arrow_forward</span>
      </div>
    `;

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');

    bindActiveDropdownEvents(dropdown, input, query);
  }

  // 8. Default Focused Dropdown (Recent Searches, Trending, Popular Categories & Brands)
  function renderDefaultDropdown(dropdown, input) {
    const recent = getRecentSearches();
    let html = '';

    // Recent Searches Section
    if (recent.length > 0) {
      html += '<div class="p-3 bg-slate-50/60 space-y-2">';
      html += '<div class="flex items-center justify-between text-[10px] font-black text-slate-400 uppercase tracking-wider">';
      html += '<span class="flex items-center gap-1"><span>🕒</span><span>Recent Searches</span></span>';
      html += '<button id="clear-all-recent-btn" class="hover:text-rose-500 font-extrabold">Clear All</button>';
      html += '</div>';
      html += '<div class="flex flex-wrap gap-1.5">';
      
      recent.forEach(q => {
        html += `<span class="recent-chip-tag inline-flex items-center gap-1.5 px-3 py-1 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-bold shadow-xs">
          <span class="recent-query-text cursor-pointer hover:text-purpleBrand" data-query="${q}">${q}</span>
          <button class="remove-recent-btn text-slate-400 hover:text-rose-500" data-query="${q}">×</button>
        </span>`;
      });

      html += '</div></div>';
    }

    // Trending Searches Section
    if (trendingQueries.length > 0) {
      html += '<div class="p-3 space-y-2">';
      html += '<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><span>🔥</span><span>Trending Searches</span></span>';
      html += '<div class="flex flex-wrap gap-1.5">';
      
      trendingQueries.forEach(t => {
        html += `<button class="trending-chip-btn px-3 py-1 rounded-xl bg-purple-50 hover:bg-purpleBrand hover:text-white border border-purple-200/60 text-purpleBrand text-xs font-black transition-all flex items-center gap-1" data-query="${t}">
          <span>📈</span>
          <span>${t}</span>
        </button>`;
      });

      html += '</div></div>';
    }

    // Popular Categories Section
    if (extractedCategories.length > 0) {
      html += '<div class="p-3 border-t border-slate-100 space-y-2">';
      html += '<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><span>🗂️</span><span>Popular Categories</span></span>';
      html += '<div class="grid grid-cols-2 sm:grid-cols-4 gap-1.5">';
      
      extractedCategories.forEach(c => {
        html += `<button class="cat-chip-btn w-full px-3 py-2 rounded-xl bg-slate-50 hover:bg-purple-50 text-slate-700 hover:text-purpleBrand border border-slate-100 text-xs font-extrabold text-left truncate transition-all" data-category="${c}">
          ${c}
        </button>`;
      });

      html += '</div></div>';
    }

    // Popular Brands Section
    if (extractedBrands.length > 0) {
      html += '<div class="p-3 border-t border-slate-100 space-y-2">';
      html += '<span class="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1"><span>🏷️</span><span>Top Brands</span></span>';
      html += '<div class="flex flex-wrap gap-1.5">';
      
      extractedBrands.forEach(b => {
        html += `<button class="brand-chip-btn px-3 py-1 rounded-xl bg-slate-100 hover:bg-purpleBrand hover:text-white text-slate-700 text-xs font-bold transition-all" data-brand="${b}">
          ${b}
        </button>`;
      });

      html += '</div></div>';
    }

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');

    bindDefaultDropdownEvents(dropdown, input);
  }

  // 9. Event Listeners Binding
  function bindActiveDropdownEvents(dropdown, input, query) {
    dropdown.querySelectorAll('.search-product-row').forEach(row => {
      row.addEventListener('click', () => {
        const title = row.dataset.name;
        addRecentSearch(title);
        dropdown.classList.add('hidden');
        window.location.href = '/product?name=' + encodeURIComponent(title);
      });
    });

    dropdown.querySelectorAll('.brand-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = btn.dataset.brand;
        addRecentSearch(b);
        dropdown.classList.add('hidden');
        window.location.href = '/grocery?search=' + encodeURIComponent(b);
      });
    });

    dropdown.querySelectorAll('.cat-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.category;
        dropdown.classList.add('hidden');
        window.location.href = '/grocery?category=' + encodeURIComponent(c);
      });
    });

    const footerRow = dropdown.querySelector('.search-footer-row');
    if (footerRow) {
      footerRow.addEventListener('click', () => {
        addRecentSearch(query);
        dropdown.classList.add('hidden');
        window.location.href = '/grocery?search=' + encodeURIComponent(query);
      });
    }
  }

  function bindDefaultDropdownEvents(dropdown, input) {
    dropdown.querySelectorAll('.recent-query-text').forEach(el => {
      el.addEventListener('click', () => {
        const q = el.dataset.query;
        input.value = q;
        renderDropdown(dropdown, input, q);
      });
    });

    dropdown.querySelectorAll('.remove-recent-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const q = btn.dataset.query;
        removeRecentSearch(q);
        renderDefaultDropdown(dropdown, input);
      });
    });

    dropdown.querySelector('#clear-all-recent-btn')?.addEventListener('click', (e) => {
      e.stopPropagation();
      clearAllRecentSearches();
      renderDefaultDropdown(dropdown, input);
    });

    dropdown.querySelectorAll('.trending-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const q = btn.dataset.query;
        input.value = q;
        addRecentSearch(q);
        renderDropdown(dropdown, input, q);
      });
    });

    dropdown.querySelectorAll('.cat-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const c = btn.dataset.category;
        dropdown.classList.add('hidden');
        window.location.href = '/grocery?category=' + encodeURIComponent(c);
      });
    });

    dropdown.querySelectorAll('.brand-chip-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const b = btn.dataset.brand;
        addRecentSearch(b);
        dropdown.classList.add('hidden');
        window.location.href = '/grocery?search=' + encodeURIComponent(b);
      });
    });
  }

})();

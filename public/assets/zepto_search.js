
(function() {
  let fullCatalog = [];
  
  fetch('/grocery_catalog.json')
    .then(res => res.json())
    .then(data => {
      fullCatalog = data;
      initUniversalSearch();
      checkUrlParams();
    })
    .catch(err => console.error('Error loading catalog for search:', err));

  function checkUrlParams() {
    const params = new URLSearchParams(window.location.search);
    const modalTitle = params.get('openModal');
    const searchQ = params.get('search');

    if (modalTitle && fullCatalog.length > 0) {
      const item = fullCatalog.find(p => p["Product Name"].toLowerCase() === modalTitle.toLowerCase() || p["Product Name"].toLowerCase().includes(modalTitle.toLowerCase()));
      if (item && window.openProductModal) {
        setTimeout(() => window.openProductModal(item), 200);
      }
    }
  }

  function levenshtein(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = [];
    for (let i = 0; i <= b.length; i++) matrix[i] = [i];
    for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
    for (let i = 1; i <= b.length; i++) {
      for (let j = 1; j <= a.length; j++) {
        if (b.charAt(i - 1) === a.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[b.length][a.length];
  }

  function normalizeWord(word) {
    return (word || '').toLowerCase().trim().replace(/(.)\1+/g, '$1');
  }

  function isFuzzyMatch(w1, w2) {
    const n1 = normalizeWord(w1);
    const n2 = normalizeWord(w2);
    if (!n1 || !n2) return false;
    if (n1 === n2 || n1.includes(n2) || n2.includes(n1)) return true;
    const dist = levenshtein(n1, n2);
    if (n1.length <= 4 || n2.length <= 4) return dist <= 1;
    return dist <= 2;
  }

  function smartSearch(query) {
    const q = query.toLowerCase().trim();
    if (!q) return [];
    
    let results = new Map();

    fullCatalog.forEach(item => {
      const name = (item["Product Name"] || '').toLowerCase();
      const brand = (item["Brand Name"] || item.Brand || '').toLowerCase();
      const cat = (item.Category || '').toLowerCase();
      
      if (name.includes(q) || brand.includes(q) || cat.includes(q) || isFuzzyMatch(q, name) || isFuzzyMatch(q, brand)) {
        const key = (item["Product Name"] || '').split(" (Batch")[0];
        if (!results.has(key)) results.set(key, item);
      }
    });

    return Array.from(results.values());
  }

  function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp('(' + query + ')', 'gi');
    return text.replace(regex, '<strong class="text-emerald-700 font-extrabold">$1</strong>');
  }

  function initUniversalSearch() {
    const searchInputs = document.querySelectorAll('input[type="text"]');
    
    searchInputs.forEach(input => {
      if (input.placeholder.toLowerCase().includes('search') || input.id.includes('search')) {
        bindSearchInput(input);
      }
    });
  }

  function bindSearchInput(input) {
    let container = input.parentElement;
    if (getComputedStyle(container).position === 'static') {
      container.style.position = 'relative';
    }

    let dropdown = container.querySelector('.zepto-universal-dropdown');
    if (!dropdown) {
      dropdown = document.createElement('div');
      dropdown.className = 'zepto-universal-dropdown absolute left-0 right-0 top-full mt-2 bg-white rounded-2xl shadow-2xl border border-neutral-200/90 z-[999] hidden max-h-[80vh] overflow-y-auto divide-y divide-neutral-100';
      container.appendChild(dropdown);
    }

    let searchTimeout;

    input.addEventListener('focus', () => {
      const q = input.value.trim();
      renderDropdown(dropdown, q, smartSearch(q));
    });

    input.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      const q = e.target.value.trim();
      searchTimeout = setTimeout(() => {
        renderDropdown(dropdown, q, smartSearch(q));
      }, 100);
    });

    document.addEventListener('click', (e) => {
      if (!input.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.add('hidden');
      }
    });
  }

  function renderDropdown(dropdown, query, matches) {
    if (!query) {
      const trending = fullCatalog.slice(0, 6);
      let html = '<div class="p-3 bg-neutral-50/80 text-[10px] font-extrabold text-neutral-400 uppercase tracking-wider">Top Recommended Items</div>';
      trending.forEach(item => {
        html += renderDropdownRow(item, query);
      });
      dropdown.innerHTML = html;
      dropdown.classList.remove('hidden');
      bindRowClicks(dropdown, query, trending);
      return;
    }

    if (matches.length === 0) {
      dropdown.innerHTML = '<div class="p-6 text-center text-xs font-bold text-neutral-400">No items found for "' + query + '". Try "Milk", "Atta", "Kurkure".</div>';
      dropdown.classList.remove('hidden');
      return;
    }

    let html = '';
    const topMatches = matches.slice(0, 5);
    const remainingMatches = matches.slice(5, 9);

    topMatches.forEach(item => {
      html += renderDropdownRow(item, query);
    });

    html += '<div class="p-3 my-1 bg-gradient-to-r from-amber-500/10 to-orange-500/10 rounded-xl border border-amber-500/20 mx-2 flex items-center justify-between cursor-pointer hover:bg-amber-500/15 transition-all">' +
      '<div class="flex items-center gap-3">' +
        '<div class="w-9 h-9 rounded-lg bg-amber-500 text-white flex items-center justify-center font-black text-sm">🛒</div>' +
        '<div>' +
          '<h5 class="text-xs font-black text-neutral-900 leading-tight">Bhusawal Fresh Store</h5>' +
          '<p class="text-[10px] text-neutral-500 font-bold">10-Minute Express Doorstep Delivery</p>' +
        '</div>' +
      '</div>' +
      '<a href="/grocery" class="bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-black px-3 py-1.5 rounded-lg transition-all">Shop Now</a>' +
    '</div>';

    remainingMatches.forEach(item => {
      html += renderDropdownRow(item, query);
    });

    html += '<div class="p-3 hover:bg-emerald-50/60 transition-colors flex items-center justify-between cursor-pointer text-xs font-black text-emerald-700 search-footer-row" data-query="' + query + '">' +
      '<div class="flex items-center gap-2">' +
        '<span class="material-symbols-outlined text-base">search</span>' +
        '<span>Show all results for <strong>"' + query + '"</strong></span>' +
      '</div>' +
      '<span class="material-symbols-outlined text-sm">chevron_right</span>' +
    '</div>';

    dropdown.innerHTML = html;
    dropdown.classList.remove('hidden');
    bindRowClicks(dropdown, query, matches);
  }

  function renderDropdownRow(item, query) {
    const highlightedName = highlightMatch(item["Product Name"], query);
    return '<div class="p-3 hover:bg-neutral-50 cursor-pointer flex items-center justify-between transition-colors search-row-item" data-title="' + item["Product Name"] + '">' +
      '<div class="flex items-center gap-3 min-w-0 flex-1 pr-2">' +
        '<img src="' + (item["Product Image URL"] || '/assets/d686bc969706f3bd6cf093f663be9579.jpg') + '" class="w-10 h-10 object-contain rounded-xl bg-white p-1 border border-neutral-200/80 shadow-sm flex-shrink-0" />' +
        '<div class="min-w-0 flex-1">' +
          '<h4 class="text-xs text-neutral-800 font-bold truncate leading-snug">' + highlightedName + '</h4>' +
          '<p class="text-[10px] text-neutral-400 font-bold">' + (item["Pack Size"] || '1 Unit') + ' • ₹' + item.MRP + '</p>' +
        '</div>' +
      '</div>' +
      '<button class="bg-white border border-[#0c831f] text-[#0c831f] text-[10px] px-2.5 py-1 rounded-lg font-extrabold shadow-sm hover:bg-[#0c831f]/5 active:scale-95 btn-open-modal-row">VIEW</button>' +
    '</div>';
  }

  function bindRowClicks(dropdown, query, matchesList) {
    dropdown.querySelectorAll('.search-row-item').forEach(row => {
      row.addEventListener('click', (e) => {
        const title = row.getAttribute('data-title');
        const item = fullCatalog.find(p => p["Product Name"] === title) || matchesList.find(p => p["Product Name"] === title);
        
        dropdown.classList.add('hidden');
        
        if (window.location.pathname.includes('/grocery') && window.openProductModal && item) {
          window.location.href = '/product?name=' + encodeURIComponent(item['Product Name']);
        } else {
          if (window.openProductModal && item) { window.openProductModal(item); } else { window.location.href = '/grocery?openModal=' + encodeURIComponent(title); }
        }
      });
    });

    const footerRow = dropdown.querySelector('.search-footer-row');
    if (footerRow) {
      footerRow.addEventListener('click', () => {
        const q = footerRow.getAttribute('data-query');
        dropdown.classList.add('hidden');
        window.location.href = '/grocery?search=' + encodeURIComponent(q);
      });
    }
  }
})();

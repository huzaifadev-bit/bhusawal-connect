/**
 * BHUSAWAL CONNECT — AGE VERIFICATION ENGINE (COTPA 2003 / 18+ TOBACCO COMPLIANCE)
 * Configurable adult age verification modal & state management.
 */

(function(window) {
  const AGE_KEY = 'bhusawal_age_verified_18';

  function isAgeVerified() {
    try {
      return localStorage.getItem(AGE_KEY) === 'true';
    } catch(e) {
      return false;
    }
  }

  function setAgeVerified(status = true) {
    try {
      localStorage.setItem(AGE_KEY, status ? 'true' : 'false');
    } catch(e) {}
  }

  function isCigaretteItem(item) {
    if (!item) return false;
    if (item.ageRestricted === true || item.requiresAgeVerification === true) return true;
    const cat = (item.category || item.cat || '').toLowerCase();
    const subcat = (item.subcategory || item.subcat || '').toLowerCase();
    const name = (item.displayName || item.name || item.originalName || '').toLowerCase();
    const slug = (item.slug || item.id || '').toLowerCase();

    return (
      cat === 'cigarettes' ||
      subcat.includes('cigarette') ||
      subcat.includes('tobacco') ||
      name.includes('cigarette') ||
      name.includes('gold flake') ||
      name.includes('marlboro') ||
      name.includes('wills classic') ||
      slug.includes('cigarettes') ||
      slug.includes('cig')
    );
  }

  function promptAgeVerification(onSuccess, onCancel) {
    if (isAgeVerified()) {
      if (typeof onSuccess === 'function') onSuccess();
      return true;
    }

    let existingModal = document.getElementById('bhusawal-age-verification-modal');
    if (existingModal) existingModal.remove();

    const modal = document.createElement('div');
    modal.id = 'bhusawal-age-verification-modal';
    modal.className = 'fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200';
    modal.innerHTML = `
      <div class="bg-white rounded-3xl max-w-md w-full p-6 sm:p-7 shadow-2xl border border-slate-100 text-center space-y-4 relative overflow-hidden">
        <div class="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto text-3xl font-black shadow-inner">
          🔞
        </div>

        <div class="space-y-1">
          <span class="px-3 py-1 bg-rose-100 text-rose-800 text-[10px] font-black uppercase tracking-wider rounded-full">STATUTORY COMPLIANCE</span>
          <h3 class="text-xl font-black font-display text-slate-900 leading-tight">Age Verification Required (18+)</h3>
          <p class="text-xs font-semibold text-slate-600 leading-relaxed pt-1">
            Cigarettes and tobacco products are strictly restricted to adults aged 18 years and above under the Cigarettes and Other Tobacco Products Act (COTPA 2003).
          </p>
        </div>

        <div class="bg-slate-50 border border-slate-200/80 p-3.5 rounded-2xl text-left space-y-1">
          <p class="text-[11px] font-bold text-slate-700 flex items-center gap-1.5">
            <span class="text-rose-500 font-extrabold">⚠️ Legal Notice:</span> Sale to minors is illegal.
          </p>
          <p class="text-[10px] font-medium text-slate-500">
            Please confirm your date of birth/age status before adding or purchasing tobacco products.
          </p>
        </div>

        <div class="space-y-2 pt-2">
          <button id="btn-age-verify-confirm" class="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md shadow-rose-600/20 active:scale-98 transition-all flex items-center justify-center gap-2">
            <span>✓ I am 18 Years or Older</span>
          </button>

          <button id="btn-age-verify-cancel" class="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-bold text-xs active:scale-98 transition-all">
            Cancel & Exit
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    document.getElementById('btn-age-verify-confirm').onclick = () => {
      setAgeVerified(true);
      modal.remove();
      if (typeof onSuccess === 'function') onSuccess();
    };

    document.getElementById('btn-age-verify-cancel').onclick = () => {
      modal.remove();
      if (typeof onCancel === 'function') onCancel();
    };

    return false;
  }

  window.BhusawalAgeVerification = {
    isAgeVerified,
    setAgeVerified,
    isCigaretteItem,
    promptAgeVerification
  };
})(window);

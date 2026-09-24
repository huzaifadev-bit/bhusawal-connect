# BHUSAWAL CONNECT — FREEZE VERIFIED CATALOG ARCHITECTURE

> **SYSTEM ARCHITECTURE DIRECTIVE & INVARIANT FREEZE**  
> **Status**: LOCKED & VERIFIED  
> **Last Verification**: 2026-08-11  

---

## 1. Verified Baseline Invariants

| Metric | Verified Value |
| :--- | :--- |
| **Total Active Daily Needs Products** | `2,680` |
| **Total Canonical Categories** | `19` |
| **Wrong Category Products** | `0` |
| **Missing Category Products** | `0` |
| **Duplicate Product Entries** | `0` |
| **Category Filter Failures** | `0` |
| **Product Detail Category Failures** | `0` |
| **Product Detail ID Discrepancies** | `0` |
| **Fallback / Default Product Substitutions** | `0` |

---

## 2. Mandatory Rules & Guidelines

1. **Single Source of Truth**:
   - [`public/grocery_catalog.json`](file:///c:/Users/sahil/OneDrive/Desktop/bhusawal%20connect/public/grocery_catalog.json) (2,680 items) is the **ONLY** canonical Daily Needs catalog.
   - [`public/food_catalog.json`](file:///c:/Users/sahil/OneDrive/Desktop/bhusawal%20connect/public/food_catalog.json) (225 items) is the **ONLY** canonical Food catalog.

2. **No Parallel Catalogs**:
   - Never create backup, draft, secondary, or parallel product catalog files.

3. **No Duplicate Category Systems**:
   - All category listings and filters must derive strictly from canonical category fields (`Category` / `category`, `Subcategory` / `subcategory`).

4. **No Hardcoded Product Displays**:
   - Never hardcode product arrays or individual product cards inside `.astro` templates or client `.js` scripts.

5. **Canonical Routing & Lookup**:
   - Single lookup engine: [`src/utils/productLookup.js`](file:///c:/Users/sahil/OneDrive/Desktop/bhusawal%20connect/src/utils/productLookup.js) using `getProductById(productId)`.
   - Single canonical URL format: `/product/{canonicalProductId}`.
   - Legacy query URLs (`/product?id=...`) issue immediate canonical redirects to `/product/{id}`.

6. **Zero Fallback Product Policy**:
   - Never return `catalog[0]`, random products, or hardcoded fallbacks (*Banana Robusta*, *Maaza*, etc.).
   - Unmatched IDs must render a clean **Product Unavailable** (404) state.

7. **Immutable Data Boundaries**:
   - Product IDs, Product Names, Brands, Quantities, and MRPs are frozen.
   - Orders, customer data, rider dispatch, payments, and admin modules are strictly protected from modification during catalog operations.

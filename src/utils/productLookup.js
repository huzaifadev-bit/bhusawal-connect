import fs from 'fs';
import path from 'path';

// Singleton Map index built ONCE from active canonical Daily Needs catalog (grocery_catalog.json)
let dailyNeedsMap = null;
let activeDailyNeedsCatalog = null;
let foodMap = null;
let activeFoodCatalog = null;

function loadDailyNeedsCatalog() {
  if (dailyNeedsMap && activeDailyNeedsCatalog) {
    return { map: dailyNeedsMap, catalog: activeDailyNeedsCatalog };
  }

  dailyNeedsMap = new Map();
  activeDailyNeedsCatalog = [];

  try {
    const filePath = path.join(process.cwd(), 'public', 'grocery_catalog.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      activeDailyNeedsCatalog = data;

      for (const item of data) {
        if (!item || typeof item !== 'object') continue;

        // Priority order for product ID resolution: Product ID > id > sku > ProductID
        const rawId = item["Product ID"] ?? item.id ?? item.sku ?? item.ProductID ?? '';
        const cleanId = String(rawId).trim();

        if (cleanId && !['undefined', 'null', 'n/a'].includes(cleanId.toLowerCase())) {
          // Index exact case ID and lowercase variant for fast, case-insensitive string lookup
          dailyNeedsMap.set(cleanId, item);
          dailyNeedsMap.set(cleanId.toLowerCase(), item);
        }
      }
    }
  } catch (err) {
    console.error('[productLookup] Failed to read active canonical Daily Needs catalog:', err);
  }

  return { map: dailyNeedsMap, catalog: activeDailyNeedsCatalog };
}

function loadFoodCatalog() {
  if (foodMap && activeFoodCatalog) {
    return { map: foodMap, catalog: activeFoodCatalog };
  }

  foodMap = new Map();
  activeFoodCatalog = [];

  try {
    const filePath = path.join(process.cwd(), 'public', 'food_catalog.json');
    const raw = fs.readFileSync(filePath, 'utf8');
    const data = JSON.parse(raw);

    if (Array.isArray(data)) {
      activeFoodCatalog = data;

      for (const item of data) {
        if (!item || typeof item !== 'object') continue;

        const rawId = item["Product ID"] ?? item.id ?? item.sku ?? item.ProductID ?? '';
        const cleanId = String(rawId).trim();

        if (cleanId && !['undefined', 'null', 'n/a'].includes(cleanId.toLowerCase())) {
          foodMap.set(cleanId, item);
          foodMap.set(cleanId.toLowerCase(), item);
        }
      }
    }
  } catch (err) {
    console.error('[productLookup] Failed to read Food catalog:', err);
  }

  return { map: foodMap, catalog: activeFoodCatalog };
}

/**
 * Single Canonical Product Lookup Engine
 */
export function getProductById(productId) {
  if (productId === undefined || productId === null) return null;

  const cleanId = String(productId).trim();
  if (!cleanId || ['undefined', 'null', 'n/a'].includes(cleanId.toLowerCase())) {
    return null;
  }

  // 1. Search Active Canonical Daily Needs Index (Built Once in Map)
  const { map: groceryIndex } = loadDailyNeedsCatalog();
  const groceryMatch = groceryIndex.get(cleanId) || groceryIndex.get(cleanId.toLowerCase());
  if (groceryMatch) {
    return { ...groceryMatch, isGrocery: true };
  }

  // 2. Search Active Food Catalog Index if not found in Daily Needs
  const { map: foodIndex } = loadFoodCatalog();
  const foodMatch = foodIndex.get(cleanId) || foodIndex.get(cleanId.toLowerCase());
  if (foodMatch) {
    return { ...foodMatch, isGrocery: false };
  }

  // No exact match found -> strictly return null (NO fallbacks!)
  return null;
}

export function getAllCanonicalProducts() {
  const { catalog: grocery } = loadDailyNeedsCatalog();
  const { catalog: food } = loadFoodCatalog();
  return [...grocery, ...food];
}

/**
 * Dynamic Related Products Calculation Engine
 *
 * Requirements:
 * 1. Priority 1: Same category
 * 2. Priority 2: Same subcategory if available
 * 3. Priority 3: Same brand
 * 4. Priority 4: Similar product type / name keywords
 *
 * Excludes currently opened product.
 * Every related product card gets its OWN canonical Product ID.
 * Never hardcoded.
 */
export function getRelatedProducts(product, limit = 12) {
  if (!product || typeof product !== 'object') return [];

  // Resolved current product ID: Product ID > id > sku > ProductID
  const rawCurrentId = product["Product ID"] ?? product.id ?? product.sku ?? product.ProductID ?? '';
  const currentId = String(rawCurrentId).trim().toLowerCase();
  if (!currentId) return [];

  const cat = String(product.Category || product.category || '').trim().toLowerCase();
  const subcat = String(product.Subcategory || product.subcategory || cat).trim().toLowerCase();
  const brand = String(product.brand || product["Brand Name"] || '').trim().toLowerCase();

  const rawName = String(product.displayName || product.name || product["Product Name"] || '').toLowerCase();
  const nameTokens = rawName
    .replace(/[^\w\s]/gi, ' ')
    .split(/\s+/)
    .filter(b => b.length > 2 && !['and', 'with', 'for', 'the', 'pack', 'size', 'free', 'gram', 'litre'].includes(b));

  const isFood = currentId.startsWith('bc_food_');
  const catalog = isFood ? loadFoodCatalog().catalog : loadDailyNeedsCatalog().catalog;

  const scored = [];

  for (const item of catalog) {
    if (!item || typeof item !== 'object') continue;

    // Related item canonical ID resolution order: Product ID > id > sku > ProductID
    const rawItemId = item["Product ID"] ?? item.id ?? item.sku ?? item.ProductID ?? '';
    const itemId = String(rawItemId).trim().toLowerCase();

    // Strictly exclude the currently opened product
    if (!itemId || itemId === currentId) continue;

    const itemCat = String(item.Category || item.category || '').trim().toLowerCase();
    const itemSubcat = String(item.Subcategory || item.subcategory || itemCat).trim().toLowerCase();
    const itemBrand = String(item.brand || item["Brand Name"] || '').trim().toLowerCase();
    const itemName = String(item.displayName || item.name || item["Product Name"] || '').toLowerCase();

    let score = 0;

    // 1. Same category (Priority 1: +1000 points)
    if (itemCat && cat && itemCat === cat) {
      score += 1000;
    }

    // 2. Same subcategory if available (Priority 2: +500 points)
    if (itemSubcat && subcat && itemSubcat === subcat) {
      score += 500;
    }

    // 3. Same brand (Priority 3: +200 points)
    if (itemBrand && brand && itemBrand === brand) {
      score += 200;
    }

    // 4. Similar product type / name keywords (Priority 4: +20 points per token)
    for (const token of nameTokens) {
      if (itemName.includes(token)) {
        score += 20;
      }
    }

    if (score > 0) {
      scored.push({ item, itemId, score });
    }
  }

  // Fallback to other items if no scored matches found
  if (scored.length === 0) {
    for (const item of catalog) {
      const rawItemId = item["Product ID"] ?? item.id ?? item.sku ?? item.ProductID ?? '';
      const itemId = String(rawItemId).trim().toLowerCase();
      if (itemId && itemId !== currentId) {
        scored.push({ item, itemId, score: 1 });
      }
      if (scored.length >= limit) break;
    }
  }

  // Sort by score descending, then by itemId ascending for deterministic tie-breaking
  scored.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.itemId.localeCompare(b.itemId);
  });

  return scored.slice(0, limit).map(s => s.item);
}

import { supabase } from './supabaseClient';
import { getProductById, getAllCanonicalProducts } from '../utils/productLookup';

export interface RecommendedProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  mrp: number;
  sp: number;
  disc: number;
  image: string;
  pack: string;
  isGrocery: boolean;
}

/**
 * Normalizes canonical product object into a clean recommendation shape.
 */
function normalizeProduct(p: any): RecommendedProduct | null {
  if (!p || typeof p !== 'object') return null;

  const rawId = p["Product ID"] ?? p.id ?? p.sku ?? p.ProductID ?? '';
  const cleanId = String(rawId).trim();
  if (!cleanId || ['undefined', 'null', 'n/a'].includes(cleanId.toLowerCase())) {
    return null;
  }

  const name = p.displayName || p.name || p["Product Name"] || 'Product';
  const brand = p.brand || p["Brand Name"] || 'Bhusawal Connect';
  const category = p.Category || p.category || 'Grocery';
  const pack = p.pack || p["Pack Size"] || p.quantity || '1 Unit';

  const mrp = parseFloat(p.mrp || p.MRP || p.price || 0);
  let sp = parseFloat(p.sp || p["Selling Price"] || p.price || mrp);
  if (!sp || sp === 0 || isNaN(sp)) sp = mrp;

  let disc = parseInt(p.disc || p["Discount %"] || 0);
  if ((!disc || disc === 0) && mrp > sp && mrp > 0) {
    disc = Math.round(((mrp - sp) / mrp) * 100);
  }

  const image = p.img || p["Product Image URL"] || p.image || '/assets/c183e18c0ed9f3d665c77b7c2d692a70.jpg';

  return {
    id: cleanId,
    name,
    brand,
    category,
    mrp,
    sp,
    disc,
    image,
    pack,
    isGrocery: p.isGrocery !== false,
  };
}

/**
 * Gets Recently Viewed products for an authenticated customer from customer_events.
 */
export async function getRecentlyViewedProducts(customerId: string, limit: number = 8): Promise<RecommendedProduct[]> {
  if (!customerId) return [];

  try {
    const { data: events, error } = await supabase
      .from('customer_events')
      .select('metadata, created_at')
      .eq('customer_id', customerId)
      .eq('event_type', 'product_viewed')
      .order('created_at', { ascending: false })
      .limit(30);

    if (error || !events) return [];

    const seenIds = new Set<string>();
    const results: RecommendedProduct[] = [];

    for (const ev of events) {
      const pid = ev.metadata?.productId || ev.metadata?.id || '';
      const cleanId = String(pid).trim();
      if (!cleanId || seenIds.has(cleanId.toLowerCase())) continue;

      seenIds.add(cleanId.toLowerCase());

      const product = getProductById(cleanId);
      const normalized = normalizeProduct(product);
      if (normalized) {
        results.push(normalized);
      }

      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.warn('Error fetching recently viewed products:', err);
    return [];
  }
}

/**
 * Gets Buy Again products for an authenticated customer from order history.
 */
export async function getBuyAgainProducts(customerId: string, limit: number = 8): Promise<RecommendedProduct[]> {
  if (!customerId) return [];

  try {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('order_data, created_at')
      .eq('customer_id', customerId)
      .order('created_at', { ascending: false })
      .limit(20);

    if (error || !orders) return [];

    const productCounts = new Map<string, number>();

    for (const ord of orders) {
      const items = ord.order_data?.items || [];
      if (Array.isArray(items)) {
        for (const item of items) {
          const pid = item.id || item.productId || '';
          const cleanId = String(pid).trim();
          if (cleanId) {
            const current = productCounts.get(cleanId) || 0;
            productCounts.set(cleanId, current + 1);
          }
        }
      }
    }

    const sortedIds = Array.from(productCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(entry => entry[0]);

    const results: RecommendedProduct[] = [];

    for (const pid of sortedIds) {
      const product = getProductById(pid);
      const normalized = normalizeProduct(product);
      if (normalized) {
        results.push(normalized);
      }
      if (results.length >= limit) break;
    }

    return results;
  } catch (err) {
    console.warn('Error fetching buy again products:', err);
    return [];
  }
}

/**
 * Gets general popular products from the canonical catalog (Cold Start & Fallback).
 */
export function getPopularProducts(limit: number = 8): RecommendedProduct[] {
  const all = getAllCanonicalProducts();

  // Curated popular indices or items with discounts/high popularity
  const popularCandidates = all.filter(p => {
    const mrp = parseFloat(p.mrp || p.MRP || 0);
    const sp = parseFloat(p.sp || p["Selling Price"] || mrp);
    return mrp > sp || p.isPopular || (p.brand && p.brand.length > 3);
  });

  const selected = popularCandidates.length >= limit ? popularCandidates.slice(0, limit) : all.slice(0, limit);

  return selected
    .map(p => normalizeProduct(p))
    .filter((p): p is RecommendedProduct => p !== null);
}

/**
 * Conservative, explainable personalized recommendations engine.
 * Cold start returns general popular products.
 */
export async function getRecommendedProducts(customerId?: string, limit: number = 8): Promise<RecommendedProduct[]> {
  if (!customerId) {
    // Cold Start for unauthenticated / guest users
    return getPopularProducts(limit);
  }

  try {
    const buyAgain = await getBuyAgainProducts(customerId, 4);
    const recentlyViewed = await getRecentlyViewedProducts(customerId, 4);

    const combinedMap = new Map<string, RecommendedProduct>();

    for (const p of buyAgain) {
      combinedMap.set(p.id.toLowerCase(), p);
    }
    for (const p of recentlyViewed) {
      if (!combinedMap.has(p.id.toLowerCase())) {
        combinedMap.set(p.id.toLowerCase(), p);
      }
    }

    const results = Array.from(combinedMap.values());

    if (results.length < limit) {
      const popular = getPopularProducts(limit - results.length);
      for (const p of popular) {
        if (!combinedMap.has(p.id.toLowerCase())) {
          combinedMap.set(p.id.toLowerCase(), p);
          results.push(p);
        }
        if (results.length >= limit) break;
      }
    }

    return results.slice(0, limit);
  } catch (err) {
    console.warn('Error fetching recommended products:', err);
    return getPopularProducts(limit);
  }
}

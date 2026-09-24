import { supabase } from './supabaseClient';

export interface CustomerProfile {
  id: string;
  auth_user_id: string | null;
  phone: string | null;
  name: string | null;
  email: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
}

export interface CustomerAddress {
  id: string;
  customer_id: string;
  label?: string | null;
  address_line: string;
  area?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_default: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface SupabaseOrder {
  id: string;
  customer_id: string | null;
  legacy_order_id: string;
  status: string;
  payment_status: string;
  payment_method: string | null;
  total_amount: number | null;
  order_data: Record<string, any>;
  created_at: string;
  updated_at: string;
}

/**
 * Controlled allowlist of supported analytics event types.
 */
export const ALLOWED_EVENT_TYPES = new Set([
  'product_viewed',
  'product_searched',
  'category_viewed',
  'product_added_to_cart',
  'product_removed_from_cart',
  'checkout_started',
  'order_completed',
  'order_cancelled',
  'product_reordered',
  'login_success',
  'profile_created',
  'profile_updated',
  'address_added',
  'address_updated',
  'address_deleted',
  'default_address_changed',
  'order_ownership_attached',
]);

// Memory deduplication buffer (5 second window)
const recentEventsCache = new Map<string, number>();

/**
 * Safe, asynchronous, non-blocking customer behavior analytics logger.
 * Only logs events for authenticated customers against allowed event types.
 */
export async function trackAnalyticsEvent(eventType: string, metadata: Record<string, any> = {}) {
  if (!eventType || !ALLOWED_EVENT_TYPES.has(eventType)) {
    return;
  }

  try {
    const sessionInfo = await getCurrentCustomer();
    if (!sessionInfo || !sessionInfo.profile) {
      // Authenticated customers only (guest events are not tracked to preserve privacy)
      return;
    }

    const customerId = sessionInfo.profile.id;

    // Deduplication check (5-second window)
    const keyPayload = metadata.productId || metadata.searchTerm || metadata.category || metadata.orderId || '';
    const cacheKey = `${customerId}:${eventType}:${keyPayload}`;
    const now = Date.now();
    const lastTimestamp = recentEventsCache.get(cacheKey);

    if (lastTimestamp && now - lastTimestamp < 5000) {
      return; // Skip duplicate event within 5 seconds
    }
    recentEventsCache.set(cacheKey, now);

    // Sanitize metadata - strip sensitive fields
    const safeMetadata = { ...metadata };
    delete safeMetadata.password;
    delete safeMetadata.token;
    delete safeMetadata.otp;
    delete safeMetadata.card;
    delete safeMetadata.cvv;
    delete safeMetadata.upi;

    await supabase.from('customer_events').insert({
      customer_id: customerId,
      event_type: eventType,
      metadata: safeMetadata,
    });
  } catch (err) {
    // Non-blocking catch — analytics failures must NEVER break user actions
    console.warn('Analytics event tracking error:', err);
  }
}

/**
 * Normalizes Indian phone numbers into canonical E.164 format (+91XXXXXXXXXX)
 */
export function normalizeIndianPhone(input: string): string | null {
  if (!input || typeof input !== 'string') return null;

  let cleaned = input.trim().replace(/[\s\-\(\)]/g, '');

  if (/[^0-9+]/.test(cleaned)) return null;

  if (cleaned.startsWith('+91')) {
    cleaned = cleaned.substring(3);
  } else if (cleaned.startsWith('91') && cleaned.length === 12) {
    cleaned = cleaned.substring(2);
  } else if (cleaned.startsWith('0') && cleaned.length === 11) {
    cleaned = cleaned.substring(1);
  }

  if (/^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }

  return null;
}

/**
 * Logs customer activity events into public.customer_events without sensitive data.
 */
export async function logCustomerEvent(customerId: string, eventType: string, metadata: Record<string, any> = {}) {
  if (!customerId || !eventType) return;

  const safeMetadata = { ...metadata };
  delete safeMetadata.password;
  delete safeMetadata.token;
  delete safeMetadata.otp;

  try {
    await supabase.from('customer_events').insert({
      customer_id: customerId,
      event_type: eventType,
      metadata: safeMetadata,
    });
  } catch (err) {
    console.warn('Could not log customer event:', err);
  }
}

/**
 * Subscribes to Supabase auth state changes cleanly for real-time auth synchronization across tabs.
 */
export function subscribeToAuthState(callback: (event: string, session: any) => void) {
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_OUT' && typeof window !== 'undefined') {
      localStorage.removeItem('bhusawal_user_profile');
    }
    callback(event, session);
  });
  return subscription;
}

/**
 * Guard helper for protected customer routes. Redirects to /login if unauthenticated.
 */
export async function requireCustomerAuth(): Promise<{ user: any; profile: CustomerProfile } | null> {
  const sessionInfo = await getCurrentCustomer();
  if (!sessionInfo || !sessionInfo.profile) {
    if (typeof window !== 'undefined') {
      window.location.href = '/login';
    }
    return null;
  }
  return { user: sessionInfo.user, profile: sessionInfo.profile };
}

/**
 * Sends a real OTP via Supabase Auth to the specified phone number.
 */
export async function sendCustomerOtp(phoneInput: string) {
  const normalizedPhone = normalizeIndianPhone(phoneInput);
  if (!normalizedPhone) {
    return {
      success: false,
      message: 'Please enter a valid 10-digit Indian mobile number (e.g. 9876543210).',
    };
  }

  try {
    const { data, error } = await supabase.auth.signInWithOtp({
      phone: normalizedPhone,
    });

    if (error) {
      if (error.message?.includes('phone_provider_disabled') || error.status === 400) {
        return {
          success: false,
          errorCode: 'PHONE_PROVIDER_DISABLED',
          message: 'Phone authentication provider is disabled in Supabase project configuration.',
        };
      }
      return {
        success: false,
        errorCode: error.code || 'OTP_SEND_ERROR',
        message: error.message || 'Failed to send OTP.',
      };
    }

    return {
      success: true,
      phone: normalizedPhone,
      message: `OTP sent to ${normalizedPhone.replace(/(\+91)(\d{2})\d{4}(\d{4})/, '$1 $2****$3')}`,
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred while requesting OTP.',
    };
  }
}

/**
 * Verifies the OTP entered by the customer and creates/updates customer profile.
 */
export async function verifyCustomerOtp(phoneInput: string, token: string) {
  const normalizedPhone = normalizeIndianPhone(phoneInput);
  if (!normalizedPhone) {
    return { success: false, message: 'Invalid phone number format.' };
  }

  if (!token || token.trim().length < 6) {
    return { success: false, message: 'Please enter a valid 6-digit OTP.' };
  }

  try {
    const { data, error } = await supabase.auth.verifyOtp({
      phone: normalizedPhone,
      token: token.trim(),
      type: 'sms',
    });

    if (error || !data.session || !data.user) {
      return {
        success: false,
        message: error?.message || 'Invalid or expired OTP. Please try again.',
      };
    }

    const authUser = data.user;
    const profile = await syncCustomerProfile(authUser.id, normalizedPhone);

    if (profile) {
      await logCustomerEvent(profile.id, 'login_success', { phone: normalizedPhone });
      await migrateLegacyCustomerData(profile);
    }

    syncLocalStorageProfile(profile);

    return {
      success: true,
      user: authUser,
      profile,
      message: 'Phone OTP verified successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: err?.message || 'An unexpected error occurred during OTP verification.',
    };
  }
}

/**
 * Upserts customer profile in public.customers without duplicating records.
 */
export async function syncCustomerProfile(authUserId: string, phone: string): Promise<CustomerProfile | null> {
  const now = new Date().toISOString();

  // 1. Check by auth_user_id
  const { data: existing } = await supabase
    .from('customers')
    .select('*')
    .eq('auth_user_id', authUserId)
    .single();

  if (existing) {
    const { data: updated } = await supabase
      .from('customers')
      .update({
        last_login_at: now,
        updated_at: now,
      })
      .eq('id', existing.id)
      .select('*')
      .single();

    return updated || existing;
  }

  // 2. Check by phone number
  const { data: existingPhone } = await supabase
    .from('customers')
    .select('*')
    .eq('phone', phone)
    .single();

  if (existingPhone) {
    const { data: updated } = await supabase
      .from('customers')
      .update({
        auth_user_id: authUserId,
        last_login_at: now,
        updated_at: now,
      })
      .eq('id', existingPhone.id)
      .select('*')
      .single();

    return updated || existingPhone;
  }

  // 3. Create new profile
  const { data: created, error } = await supabase
    .from('customers')
    .insert({
      auth_user_id: authUserId,
      phone,
      is_active: true,
      last_login_at: now,
    })
    .select('*')
    .single();

  if (error) {
    console.error('Error creating customer profile:', error);
    return null;
  }

  if (created) {
    await logCustomerEvent(created.id, 'profile_created', { phone });
  }

  return created;
}

/**
 * Updates customer profile information in Supabase.
 */
export async function updateCustomerProfile(customerId: string, updates: Partial<CustomerProfile>) {
  const { data, error } = await supabase
    .from('customers')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId)
    .select('*')
    .single();

  if (!error && data) {
    await logCustomerEvent(customerId, 'profile_updated', { updatedFields: Object.keys(updates) });
    syncLocalStorageProfile(data);
  }

  return { data, error };
}

/**
 * Gets customer addresses from Supabase.
 */
export async function getCustomerAddresses(customerId: string): Promise<CustomerAddress[]> {
  const { data, error } = await supabase
    .from('customer_addresses')
    .select('*')
    .eq('customer_id', customerId)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer addresses:', error);
    return [];
  }

  return data || [];
}

/**
 * Adds a new address for a customer in Supabase. Enforces max 1 default address.
 */
export async function addCustomerAddress(customerId: string, address: Partial<CustomerAddress>) {
  if (address.is_default) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .insert({
      customer_id: customerId,
      label: address.label || 'Home',
      address_line: address.address_line || '',
      area: address.area || 'Bhusawal City',
      city: address.city || 'Bhusawal',
      state: address.state || 'Maharashtra',
      pincode: address.pincode || '425201',
      latitude: address.latitude || null,
      longitude: address.longitude || null,
      is_default: address.is_default || false,
    })
    .select('*')
    .single();

  if (!error && data) {
    await logCustomerEvent(customerId, 'address_added', { addressId: data.id, label: data.label });
  }

  return { data, error };
}

/**
 * Updates an existing address in Supabase.
 */
export async function updateCustomerAddress(addressId: string, customerId: string, updates: Partial<CustomerAddress>) {
  if (updates.is_default) {
    await supabase
      .from('customer_addresses')
      .update({ is_default: false })
      .eq('customer_id', customerId);
  }

  const { data, error } = await supabase
    .from('customer_addresses')
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .select('*')
    .single();

  if (!error && data) {
    await logCustomerEvent(customerId, updates.is_default ? 'default_address_changed' : 'address_updated', { addressId });
  }

  return { data, error };
}

/**
 * Deletes an address from Supabase.
 */
export async function deleteCustomerAddress(addressId: string, customerId: string) {
  const { error } = await supabase
    .from('customer_addresses')
    .delete()
    .eq('id', addressId)
    .eq('customer_id', customerId);

  if (!error) {
    await logCustomerEvent(customerId, 'address_deleted', { addressId });
  }

  return { success: !error, error };
}

/**
 * Sets an address as default for a customer. Unsets previous defaults.
 */
export async function setDefaultCustomerAddress(addressId: string, customerId: string) {
  await supabase
    .from('customer_addresses')
    .update({ is_default: false })
    .eq('customer_id', customerId);

  const { data, error } = await supabase
    .from('customer_addresses')
    .update({ is_default: true, updated_at: new Date().toISOString() })
    .eq('id', addressId)
    .eq('customer_id', customerId)
    .select('*')
    .single();

  if (!error && data) {
    await logCustomerEvent(customerId, 'default_address_changed', { addressId });
  }

  return { data, error };
}

/**
 * Controlled one-time migration marker & migration runner for profile and addresses.
 */
export async function migrateLegacyCustomerData(profile: CustomerProfile) {
  if (typeof window === 'undefined') return;

  const MIGRATION_MARKER = 'bhusawal_customer_supabase_migration_v1';
  if (localStorage.getItem(MIGRATION_MARKER) === 'completed') {
    return;
  }

  try {
    const rawLegacyProfile = localStorage.getItem('bhusawal_user_profile');
    if (rawLegacyProfile) {
      const parsed = JSON.parse(rawLegacyProfile);
      const updatesToMake: Partial<CustomerProfile> = {};

      if (parsed.name && !profile.name) updatesToMake.name = parsed.name;
      if (parsed.email && !profile.email) updatesToMake.email = parsed.email;

      if (Object.keys(updatesToMake).length > 0) {
        await updateCustomerProfile(profile.id, updatesToMake);
      }
    }

    const legacyAddresses = JSON.parse(
      localStorage.getItem('bhusawal_customer_addresses_v1') ||
      localStorage.getItem('bhusawal_addresses') ||
      localStorage.getItem('bhusawal_user_addresses') ||
      '[]'
    );

    if (Array.isArray(legacyAddresses) && legacyAddresses.length > 0) {
      const existingDbAddresses = await getCustomerAddresses(profile.id);

      for (const addr of legacyAddresses) {
        const addressLine = addr.fullAddress || addr.address_line || addr.address || '';
        if (!addressLine) continue;

        const isDuplicate = existingDbAddresses.some(
          existing => existing.address_line.toLowerCase() === addressLine.toLowerCase()
        );

        if (!isDuplicate) {
          await addCustomerAddress(profile.id, {
            label: addr.label || 'Saved Address',
            address_line: addressLine,
            area: addr.area || 'Bhusawal City',
            city: addr.city || 'Bhusawal',
            state: addr.state || 'Maharashtra',
            pincode: addr.pincode || '425201',
            latitude: addr.lat || addr.latitude || null,
            longitude: addr.lng || addr.longitude || null,
            is_default: addr.isDefault || addr.is_default || false,
          });
        }
      }
    }

    localStorage.setItem(MIGRATION_MARKER, 'completed');
    console.log('Customer data migration to Supabase completed successfully.');
  } catch (err) {
    console.error('Error during customer data migration to Supabase:', err);
  }
}

/**
 * Registers order ownership in public.orders for authenticated customers safely.
 * Prevents duplicate insertion using legacy_order_id uniqueness.
 */
export async function syncCustomerOrder(legacyOrder: any, customerId: string | null = null) {
  if (!legacyOrder || (!legacyOrder.id && !legacyOrder.orderId)) {
    return { success: false, message: 'Invalid order object.' };
  }

  const legacyOrderId = String(legacyOrder.id || legacyOrder.orderId);

  try {
    const { data: existing } = await supabase
      .from('orders')
      .select('*')
      .eq('legacy_order_id', legacyOrderId)
      .single();

    if (existing) {
      return { success: true, order: existing, isDuplicate: true };
    }

    const { data: created, error } = await supabase
      .from('orders')
      .insert({
        customer_id: customerId || null,
        legacy_order_id: legacyOrderId,
        status: legacyOrder.status || legacyOrder.orderStatus || 'PLACED',
        payment_status: legacyOrder.paymentStatus || 'PENDING',
        payment_method: legacyOrder.paymentMethod || legacyOrder.payment_method || 'UPI',
        total_amount: parseFloat(legacyOrder.total || legacyOrder.amount || 0),
        order_data: {
          items: legacyOrder.items || [],
          deliveryFee: legacyOrder.deliveryFee || 30,
          address: legacyOrder.address || null,
          rider: legacyOrder.rider || null,
          createdAt: legacyOrder.createdAt || new Date().toISOString(),
        },
      })
      .select('*')
      .single();

    if (error) {
      console.error('Error registering customer order ownership:', error);
      return { success: false, error };
    }

    if (created && Array.isArray(legacyOrder.items) && legacyOrder.items.length > 0) {
      const itemRows = legacyOrder.items.map((item: any) => ({
        order_id: created.id,
        product_id: String(item.id || item.productId || ''),
        product_name_snapshot: String(item.name || item.title || 'Product'),
        quantity: parseInt(item.quantity || item.qty || 1, 10),
        unit_price: parseFloat(item.price || item.mrp || 0),
        subtotal: parseFloat(item.price || item.mrp || 0) * parseInt(item.quantity || item.qty || 1, 10),
      }));

      await supabase.from('order_items').insert(itemRows);
    }

    if (customerId) {
      await logCustomerEvent(customerId, 'order_ownership_attached', { legacyOrderId });
      await trackAnalyticsEvent('order_completed', { orderId: created.id, legacyOrderId, total: created.total_amount });

      // Trigger Transactional ORDER_PLACED SMS (Non-blocking failure isolation & idempotency)
      try {
        const { sendOrderTransactionalSms } = await import('./orderNotificationService');
        await sendOrderTransactionalSms({
          customerId,
          orderId: created.id,
          eventType: 'ORDER_PLACED',
          customerName: legacyOrder.customerName || legacyOrder.name || 'Customer',
          shortOrderId: legacyOrderId,
        });
      } catch (smsErr) {
        console.warn('[syncCustomerOrder] Isolated SMS notification warning:', smsErr);
      }
    }

    return { success: true, order: created, isDuplicate: false };
  } catch (err: any) {
    console.error('Error during order ownership sync:', err);
    return { success: false, error: err?.message };
  }
}

/**
 * Fetches order ownership history for an authenticated customer from Supabase.
 */
export async function getCustomerOrders(customerId: string): Promise<SupabaseOrder[]> {
  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_id', customerId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching customer orders:', error);
    return [];
  }

  return data || [];
}

/**
 * Gets the current active Supabase Auth session.
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) return null;
  return session;
}

/**
 * Canonical helper resolving the currently authenticated customer profile.
 */
export async function getCurrentCustomer(): Promise<{ user: any; profile: CustomerProfile | null } | null> {
  const session = await getCurrentSession();
  if (!session || !session.user) {
    return null;
  }

  const authUser = session.user;
  const { data: profile } = await supabase
    .from('customers')
    .select('*')
    .eq('auth_user_id', authUser.id)
    .single();

  return {
    user: authUser,
    profile: profile || null,
  };
}

/**
 * Performs customer sign-out, clearing Supabase session while preserving non-auth state.
 */
export async function logoutCustomer() {
  await supabase.auth.signOut();
  if (typeof window !== 'undefined') {
    localStorage.removeItem('bhusawal_user_profile');
    localStorage.removeItem('bhusawal_active_order');
    localStorage.removeItem('bhusawal_uploaded_prescription');
    localStorage.removeItem('bhusawal_customer_addresses_v1');
  }
}


/**
 * Alias export for logoutCustomer
 */
export const signOutCustomer = logoutCustomer;

/**
 * Controlled local storage compatibility helper.
 */
function syncLocalStorageProfile(profile: CustomerProfile | null) {
  if (typeof window === 'undefined' || !profile) return;
  const legacyProfile = {
    id: profile.id,
    auth_user_id: profile.auth_user_id,
    phone: profile.phone,
    name: profile.name || 'Customer',
    email: profile.email || '',
    isLoggedIn: true,
  };
  localStorage.setItem('bhusawal_user_profile', JSON.stringify(legacyProfile));
}

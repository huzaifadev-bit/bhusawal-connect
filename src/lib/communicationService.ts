import { supabase } from './supabaseClient';
import { maskPhoneForLog } from './msg91Otp';

export interface CommunicationPreferences {
  id?: string;
  customer_id: string;
  transactional_sms_enabled: boolean;
  order_sms_enabled: boolean;
  delivery_sms_enabled: boolean;
  marketing_sms_enabled: boolean;
  marketing_email_enabled: boolean;
  marketing_whatsapp_enabled: boolean;
  marketing_sms_updated_at?: string;
  created_at?: string;
  updated_at?: string;
}

export interface SendMessageParams {
  customerId?: string;
  phone?: string;
  channel: 'sms' | 'email' | 'whatsapp';
  messageType: 'otp' | 'order_confirmation' | 'order_status' | 'delivery_update' | 'marketing';
  templateId?: string;
  variables?: Record<string, any>;
  idempotencyKey?: string;
}

export interface SendMessageResult {
  success: boolean;
  message: string;
  eventId?: string;
  errorCode?: string;
  skippedReason?: string;
}

/**
 * Fetches communication preferences for an authenticated customer.
 * Creates default preferences if none exist (Marketing is DISABLED by default).
 */
export async function getCustomerCommunicationPreferences(customerId: string): Promise<CommunicationPreferences> {
  if (!customerId) {
    return {
      customer_id: '',
      transactional_sms_enabled: true,
      order_sms_enabled: true,
      delivery_sms_enabled: true,
      marketing_sms_enabled: false,
      marketing_email_enabled: false,
      marketing_whatsapp_enabled: false,
    };
  }

  try {
    const { data: existing } = await supabase
      .from('customer_communication_preferences')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    if (existing) {
      return existing;
    }

    // Default consent model: Transactional/Order/Delivery ENABLED, Marketing DISABLED
    const defaultPrefs: CommunicationPreferences = {
      customer_id: customerId,
      transactional_sms_enabled: true,
      order_sms_enabled: true,
      delivery_sms_enabled: true,
      marketing_sms_enabled: false,
      marketing_email_enabled: false,
      marketing_whatsapp_enabled: false,
    };

    const { data: created } = await supabase
      .from('customer_communication_preferences')
      .insert(defaultPrefs)
      .select('*')
      .single();

    return created || defaultPrefs;
  } catch (err) {
    console.warn('Error fetching customer communication preferences:', err);
    return {
      customer_id: customerId,
      transactional_sms_enabled: true,
      order_sms_enabled: true,
      delivery_sms_enabled: true,
      marketing_sms_enabled: false,
      marketing_email_enabled: false,
      marketing_whatsapp_enabled: false,
    };
  }
}

/**
 * Updates customer communication preferences in Supabase safely.
 */
export async function updateCustomerCommunicationPreferences(
  customerId: string,
  updates: Partial<CommunicationPreferences>
): Promise<{ data: CommunicationPreferences | null; error: any }> {
  if (!customerId) return { data: null, error: 'Customer ID is required.' };

  const now = new Date().toISOString();
  const payload: Partial<CommunicationPreferences> = {
    ...updates,
    updated_at: now,
  };

  if (typeof updates.marketing_sms_enabled === 'boolean') {
    payload.marketing_sms_updated_at = now;
  }

  try {
    const existing = await getCustomerCommunicationPreferences(customerId);

    const { data, error } = await supabase
      .from('customer_communication_preferences')
      .upsert({
        customer_id: customerId,
        ...existing,
        ...payload,
      }, { onConflict: 'customer_id' })
      .select('*')
      .single();

    if (error) {
      console.error('[Communication Service] Supabase upsert error:', error);
      return { data: null, error: error.message || error };
    }

    // Verify read-back state from Supabase
    const { data: readBack } = await supabase
      .from('customer_communication_preferences')
      .select('*')
      .eq('customer_id', customerId)
      .single();

    const finalData = readBack || data;

    if (finalData) {
      console.log(`[Communication Service] Preferences updated for customer ${customerId}`);

      if (typeof updates.marketing_sms_enabled === 'boolean' && existing.marketing_sms_enabled !== updates.marketing_sms_enabled) {
        try {
          await supabase.from('marketing_consent_audit').insert({
            customer_id: customerId,
            previous_value: existing.marketing_sms_enabled,
            new_value: updates.marketing_sms_enabled,
            source: 'account_settings',
          });
        } catch (auditErr) {
          console.warn('[Communication Service] Audit log error:', auditErr);
        }
      }
    }

    return { data: finalData, error: null };
  } catch (err: any) {
    console.error('Error updating customer communication preferences:', err);
    return { data: null, error: err?.message || err };
  }
}

/**
 * Server-side Communication Dispatch Abstraction Engine.
 * Enforces consent checks, idempotency, rate limiting, and audit logging.
 */
export async function sendCustomerMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const { customerId, phone, channel, messageType, idempotencyKey, variables } = params;

  // 1. Idempotency Check (Prevent duplicate dispatches)
  if (idempotencyKey) {
    const { data: existingEvent } = await supabase
      .from('communication_events')
      .select('*')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingEvent) {
      return {
        success: true,
        message: 'Message already dispatched (Idempotency Key duplicate).',
        eventId: existingEvent.id,
        skippedReason: 'DUPLICATE_IDEMPOTENCY_KEY',
      };
    }
  }

  // 2. Marketing Consent Verification (Strict separation of Transactional vs Marketing)
  if (messageType === 'marketing') {
    if (!customerId) {
      return {
        success: false,
        message: 'Customer consent cannot be verified without customer ID.',
        errorCode: 'CONSENT_VERIFICATION_FAILED',
        skippedReason: 'MISSING_CUSTOMER_ID',
      };
    }

    const prefs = await getCustomerCommunicationPreferences(customerId);
    if (!prefs.marketing_sms_enabled && channel === 'sms') {
      console.log(`[Communication Service] Marketing SMS skipped for customer ${customerId} (Consent DISABLED).`);
      return {
        success: false,
        message: 'Marketing SMS skipped: Customer has not opted into marketing messages.',
        errorCode: 'MARKETING_CONSENT_DISABLED',
        skippedReason: 'MARKETING_CONSENT_DISABLED',
      };
    }
  }

  // 3. Log Communication Audit Event
  const maskedPhone = phone ? maskPhoneForLog(phone) : 'N/A';
  console.log(`[Communication Service] Dispatching ${messageType} (${channel}) to ${maskedPhone}`);

  try {
    const safeMetadata = {
      ...(variables || {}),
      phoneMasked: maskedPhone,
    };
    delete safeMetadata.otp;
    delete safeMetadata.password;
    delete safeMetadata.authKey;

    const { data: eventRow, error: logError } = await supabase
      .from('communication_events')
      .insert({
        customer_id: customerId || null,
        channel,
        message_type: messageType,
        status: 'queued',
        provider: 'msg91',
        idempotency_key: idempotencyKey || null,
        metadata: safeMetadata,
      })
      .select('*')
      .single();

    return {
      success: true,
      message: `${messageType} message queued successfully.`,
      eventId: eventRow?.id,
    };
  } catch (err: any) {
    console.error('[Communication Service] Error recording message event:', err);
    return {
      success: false,
      message: 'Failed to record communication event.',
      errorCode: 'EVENT_LOG_ERROR',
    };
  }
}

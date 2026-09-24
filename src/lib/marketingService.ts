import { supabase } from './supabaseClient';
import { getCustomerCommunicationPreferences } from './communicationService';
import { maskPhoneForLog } from './msg91Otp';
import { normalizeIndianPhone } from './customerAuth';

export type MarketingSegment =
  | 'ALL_CUSTOMERS'
  | 'ACTIVE_CUSTOMER'
  | 'INACTIVE_CUSTOMER'
  | 'FOOD_CUSTOMER'
  | 'DAILY_NEEDS_CUSTOMER'
  | 'REORDER_CUSTOMER';

export interface MarketingCampaign {
  id: string;
  name: string;
  description?: string;
  message_template: string;
  channel: string;
  target_segment: MarketingSegment;
  status: 'DRAFT' | 'SCHEDULED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED';
  scheduled_at?: string;
  created_by?: string;
  created_at?: string;
  updated_at?: string;
}

export interface DispatchMarketingParams {
  campaignId: string;
  customerId: string;
  customerName?: string;
  phone?: string;
  offerMessage?: string;
  isTestMode?: boolean;
}

export interface DispatchMarketingResult {
  success: boolean;
  message: string;
  eventId?: string;
  skippedReason?: string;
  errorCode?: string;
}

/**
 * Checks whether the current local time in Bhusawal (IST / UTC+5:30) falls within allowed marketing hours (09:00 - 21:00 IST).
 */
export function isWithinMarketingQuietHours(): boolean {
  const now = new Date();
  // Convert current UTC time to IST (UTC + 5 hours 30 mins)
  const istOffsetMs = (5 * 60 + 30) * 60 * 1000;
  const istTime = new Date(now.getTime() + istOffsetMs);
  const hours = istTime.getUTCHours();

  // Allowed window: 9 AM to 9 PM IST (9 <= hours < 21)
  return hours >= 9 && hours < 21;
}

/**
 * Validates frequency limits for a customer (Max 1 marketing SMS per 24 hours, Max 2 per 7 days).
 */
export async function checkMarketingFrequencyLimit(customerId: string): Promise<{ passed: boolean; reason?: string }> {
  if (!customerId) return { passed: false, reason: 'MISSING_CUSTOMER_ID' };

  const now = new Date();
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // Check 24-hour limit
  const { count: count24h } = await supabase
    .from('communication_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('message_type', 'marketing')
    .gte('created_at', twentyFourHoursAgo);

  if ((count24h || 0) >= 1) {
    return { passed: false, reason: 'LIMIT_24H_EXCEEDED (Max 1 marketing SMS per 24h)' };
  }

  // Check 7-day limit
  const { count: count7d } = await supabase
    .from('communication_events')
    .select('id', { count: 'exact', head: true })
    .eq('customer_id', customerId)
    .eq('message_type', 'marketing')
    .gte('created_at', sevenDaysAgo);

  if ((count7d || 0) >= 2) {
    return { passed: false, reason: 'LIMIT_7D_EXCEEDED (Max 2 marketing SMS per 7 days)' };
  }

  return { passed: true };
}

/**
 * Formats a clean, natural, privacy-preserving marketing SMS message without exposing tracking details.
 */
export function formatPersonalizedMarketingMessage(
  template: string,
  customerName: string = 'Valued Customer',
  offerMessage: string = 'Check out exclusive local deals today!'
): string {
  const cleanName = customerName && customerName !== 'Bhusawal Customer' ? customerName : 'Customer';

  let result = template || `Hi {{name}}, {{offer_message}} Explore Bhusawal Connect today. To stop promotional messages, update your communication preferences.`;

  result = result.replace(/\{\{\s*name\s*\}\}/g, cleanName);
  result = result.replace(/\{\{\s*offer_message\s*\}\}/g, offerMessage);

  return result;
}

/**
 * Canonical Marketing SMS Dispatch Engine.
 * Enforces explicit opt-in marketing consent, quiet hours, 24h/7d frequency limits, idempotency, and failure isolation.
 */
export async function sendCustomerMarketingSms(
  params: DispatchMarketingParams
): Promise<DispatchMarketingResult> {
  const { campaignId, customerId, customerName, phone: rawPhone, offerMessage, isTestMode } = params;

  if (!campaignId || !customerId) {
    return {
      success: false,
      message: 'Missing required campaign parameters (campaignId, customerId).',
      errorCode: 'INVALID_PARAMS',
    };
  }

  const idempotencyKey = `marketing_sms:${campaignId}:${customerId}`;

  try {
    // 1. Idempotency Check: Prevent duplicate campaign dispatches to the same customer
    const { data: existingEvent } = await supabase
      .from('communication_events')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingEvent) {
      console.log(`[Marketing SMS] Idempotency duplicate skipped for ${idempotencyKey}`);
      return {
        success: true,
        message: 'Marketing message skipped: Duplicate campaign event already processed.',
        eventId: existingEvent.id,
        skippedReason: 'DUPLICATE_IDEMPOTENCY_KEY',
      };
    }

    // 2. Explicit Opt-In Marketing Consent Check (DISABLED BY DEFAULT!)
    const prefs = await getCustomerCommunicationPreferences(customerId);
    if (!prefs.marketing_sms_enabled) {
      return {
        success: false,
        message: 'Marketing SMS skipped: Customer has not opted into promotional messages.',
        skippedReason: 'MARKETING_CONSENT_DISABLED',
      };
    }

    // 3. Quiet Hours Check (09:00 - 21:00 IST)
    if (!isWithinMarketingQuietHours() && !isTestMode) {
      return {
        success: false,
        message: 'Marketing SMS skipped: Outside permitted marketing hours (09:00 - 21:00 IST).',
        skippedReason: 'QUIET_HOURS_RESTRICTION',
      };
    }

    // 4. Frequency Limit Check (Max 1 per 24h, Max 2 per 7d)
    const freqCheck = await checkMarketingFrequencyLimit(customerId);
    if (!freqCheck.passed && !isTestMode) {
      return {
        success: false,
        message: `Marketing SMS skipped: ${freqCheck.reason}`,
        skippedReason: freqCheck.reason,
      };
    }

    // 5. Resolve Customer Phone Number
    let targetPhone = rawPhone ? normalizeIndianPhone(rawPhone) : null;
    if (!targetPhone) {
      const { data: custData } = await supabase
        .from('customers')
        .select('phone')
        .eq('id', customerId)
        .single();

      if (custData?.phone) {
        targetPhone = normalizeIndianPhone(custData.phone);
      }
    }

    if (!targetPhone) {
      return {
        success: false,
        message: 'Unable to send Marketing SMS: Verified customer phone number missing.',
        errorCode: 'MISSING_CUSTOMER_PHONE',
      };
    }

    const maskedPhone = maskPhoneForLog(targetPhone);
    const smsMessage = formatPersonalizedMarketingMessage(
      'Hi {{name}}, {{offer_message}} Explore Bhusawal Connect today. To stop promotional messages, update your communication preferences.',
      customerName,
      offerMessage || 'Discover today\'s top deals in Bhusawal!'
    );

    console.log(`[Marketing SMS] Dispatching campaign ${campaignId} to ${maskedPhone}`);

    // Read server-side MSG91 credentials safely
    const authKey = process.env.MSG91_AUTH_KEY || import.meta.env.MSG91_AUTH_KEY || '';
    const isConfigured = authKey && authKey !== 'YOUR_MSG91_AUTH_KEY' && !isTestMode;

    let dispatchStatus: 'sent' | 'queued' | 'failed' = 'queued';
    let providerMsgId: string | null = null;

    if (isConfigured) {
      // MSG91 API Call for Marketing SMS
      const apiUrl = process.env.MSG91_OTP_API_URL || import.meta.env.MSG91_OTP_API_URL || 'https://control.msg91.com/api/v5/otp';
      const templateId = process.env.MSG91_TEMPLATE_ID || import.meta.env.MSG91_TEMPLATE_ID || '';
      const msg91Mobile = targetPhone.replace('+', '');

      try {
        const queryParams = new URLSearchParams({
          template_id: templateId,
          mobile: msg91Mobile,
        });

        const response = await fetch(`${apiUrl}?${queryParams.toString()}`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'authkey': authKey,
          },
        });

        const respData = await response.json().catch(() => ({}));
        if (response.ok && respData.type !== 'error') {
          dispatchStatus = 'sent';
          providerMsgId = respData.message || respData.request_id || null;
        } else {
          dispatchStatus = 'failed';
        }
      } catch (err: any) {
        dispatchStatus = 'failed';
        console.error('[Marketing SMS] MSG91 network error:', err?.message || err);
      }
    }

    // 6. Record Audit Event in communication_events Table
    const safeMetadata = {
      campaignId,
      customerName: customerName || 'Customer',
      phoneMasked: maskedPhone,
      messageText: smsMessage,
      isTestMode: !!isTestMode,
    };

    const { data: eventRow } = await supabase
      .from('communication_events')
      .insert({
        customer_id: customerId,
        channel: 'sms',
        message_type: 'marketing',
        status: dispatchStatus,
        provider: 'msg91',
        provider_message_id: providerMsgId,
        idempotency_key: idempotencyKey,
        metadata: safeMetadata,
      })
      .select('*')
      .single();

    return {
      success: true,
      message: `Marketing campaign message processed successfully (${dispatchStatus}).`,
      eventId: eventRow?.id,
    };
  } catch (err: any) {
    // Non-blocking error isolation — marketing errors must NEVER affect orders or checkout
    console.error(`[Marketing SMS] Isolated error processing campaign ${campaignId} for customer ${customerId}:`, err?.message || err);
    return {
      success: false,
      message: 'Marketing dispatch error (isolated from app operations).',
      errorCode: 'SERVICE_ERROR',
    };
  }
}

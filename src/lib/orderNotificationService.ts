import { supabase } from './supabaseClient';
import { getCustomerCommunicationPreferences } from './communicationService';
import { maskPhoneForLog } from './msg91Otp';
import { normalizeIndianPhone } from './customerAuth';

export type OrderNotificationEventType =
  | 'ORDER_PLACED'
  | 'ORDER_CONFIRMED'
  | 'ORDER_PREPARING'
  | 'RIDER_ASSIGNED'
  | 'OUT_FOR_DELIVERY'
  | 'ORDER_DELIVERED'
  | 'ORDER_CANCELLED'
  | 'PAYMENT_SUCCESS'
  | 'PAYMENT_FAILED';

export interface OrderNotificationParams {
  customerId: string;
  orderId: string;
  eventType: OrderNotificationEventType;
  customerName?: string;
  phone?: string;
  shortOrderId?: string;
  metadata?: Record<string, any>;
}

export interface OrderNotificationResult {
  success: boolean;
  message: string;
  eventId?: string;
  skippedReason?: string;
  errorCode?: string;
}

/**
 * Formats clean, non-promotional transactional SMS message text for order & delivery events.
 */
export function formatOrderSmsMessage(
  eventType: OrderNotificationEventType,
  shortOrderId: string,
  customerName: string = 'Customer'
): string {
  const cleanShortId = shortOrderId.replace('#', '');

  switch (eventType) {
    case 'ORDER_PLACED':
      return `Hi ${customerName}, your Bhusawal Connect order #${cleanShortId} has been placed successfully. We'll keep you updated. - Bhusawal Connect`;
    case 'ORDER_CONFIRMED':
      return `Your Bhusawal Connect order #${cleanShortId} has been confirmed and is being processed.`;
    case 'ORDER_PREPARING':
      return `Your Bhusawal Connect order #${cleanShortId} is being prepared.`;
    case 'RIDER_ASSIGNED':
      return `Your Bhusawal Connect order #${cleanShortId} has been assigned to a delivery partner.`;
    case 'OUT_FOR_DELIVERY':
      return `Your Bhusawal Connect order #${cleanShortId} is out for delivery.`;
    case 'ORDER_DELIVERED':
      return `Your Bhusawal Connect order #${cleanShortId} has been delivered. Thank you for ordering!`;
    case 'ORDER_CANCELLED':
      return `Your Bhusawal Connect order #${cleanShortId} has been cancelled. Please check your Bhusawal Connect account for details.`;
    case 'PAYMENT_SUCCESS':
      return `Payment received successfully for Bhusawal Connect order #${cleanShortId}.`;
    case 'PAYMENT_FAILED':
      return `Payment for Bhusawal Connect order #${cleanShortId} could not be completed. Please check your payment method.`;
    default:
      return `Update regarding your Bhusawal Connect order #${cleanShortId}.`;
  }
}

/**
 * Canonical Transactional Order & Delivery SMS Dispatch Engine.
 * Features idempotency, customer consent checks, masked logging, and isolated failure handling.
 */
export async function sendOrderTransactionalSms(
  params: OrderNotificationParams
): Promise<OrderNotificationResult> {
  const { customerId, orderId, eventType, customerName, phone: rawPhone, shortOrderId, metadata } = params;

  if (!customerId || !orderId || !eventType) {
    return {
      success: false,
      message: 'Missing required notification parameters (customerId, orderId, eventType).',
      errorCode: 'INVALID_PARAMS',
    };
  }

  const cleanShortId = shortOrderId || orderId.slice(-6).toUpperCase();
  const idempotencyKey = `order_sms:${customerId}:${orderId}:${eventType}`;

  try {
    // 1. Idempotency Check: Prevent duplicate SMS sending for the exact same event
    const { data: existingEvent } = await supabase
      .from('communication_events')
      .select('id, status')
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (existingEvent) {
      console.log(`[Transactional SMS] Duplicate event skipped for ${idempotencyKey}`);
      return {
        success: true,
        message: 'Notification skipped: Duplicate event already processed.',
        eventId: existingEvent.id,
        skippedReason: 'DUPLICATE_IDEMPOTENCY_KEY',
      };
    }

    // 2. Transactional Preferences Verification
    const prefs = await getCustomerCommunicationPreferences(customerId);
    const isDeliveryEvent = eventType === 'RIDER_ASSIGNED' || eventType === 'OUT_FOR_DELIVERY' || eventType === 'ORDER_DELIVERED';

    if (!prefs.transactional_sms_enabled) {
      return {
        success: false,
        message: 'Transactional SMS skipped: Customer has disabled transactional notifications.',
        skippedReason: 'TRANSACTIONAL_DISABLED',
      };
    }

    if (isDeliveryEvent && !prefs.delivery_sms_enabled) {
      return {
        success: false,
        message: 'Delivery SMS skipped: Customer has disabled delivery notifications.',
        skippedReason: 'DELIVERY_PREFERENCE_DISABLED',
      };
    }

    if (!isDeliveryEvent && !prefs.order_sms_enabled) {
      return {
        success: false,
        message: 'Order SMS skipped: Customer has disabled order notifications.',
        skippedReason: 'ORDER_PREFERENCE_DISABLED',
      };
    }

    // 3. Resolve and Normalize Customer Phone Number
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
        message: 'Unable to send SMS: Customer phone number missing or invalid.',
        errorCode: 'MISSING_CUSTOMER_PHONE',
      };
    }

    const maskedPhone = maskPhoneForLog(targetPhone);
    const smsMessage = formatOrderSmsMessage(eventType, cleanShortId, customerName || 'Customer');

    console.log(`[Transactional SMS] Dispatching ${eventType} for order #${cleanShortId} to ${maskedPhone}`);

    // Read server-side MSG91 credentials safely
    const authKey = process.env.MSG91_AUTH_KEY || import.meta.env.MSG91_AUTH_KEY || '';
    const isConfigured = authKey && authKey !== 'YOUR_MSG91_AUTH_KEY';

    let dispatchStatus: 'sent' | 'queued' | 'failed' = 'queued';
    let providerMsgId: string | null = null;

    if (isConfigured) {
      // MSG91 API Dispatch Call
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
          console.warn(`[Transactional SMS] MSG91 Provider error for order #${cleanShortId}:`, respData.message || response.statusText);
        }
      } catch (err: any) {
        dispatchStatus = 'failed';
        console.error(`[Transactional SMS] Network error sending MSG91 SMS for order #${cleanShortId}:`, err?.message || err);
      }
    }

    // 4. Record Audit Event in communication_events Table
    const safeMetadata = {
      orderId,
      shortOrderId: cleanShortId,
      eventType,
      customerName: customerName || 'Customer',
      phoneMasked: maskedPhone,
      messageText: smsMessage,
      ...(metadata || {}),
    };

    const { data: eventRow } = await supabase
      .from('communication_events')
      .insert({
        customer_id: customerId,
        channel: 'sms',
        message_type: isDeliveryEvent ? 'delivery_update' : 'order_status',
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
      message: `Transactional SMS for ${eventType} processed successfully.`,
      eventId: eventRow?.id,
    };
  } catch (err: any) {
    // Non-blocking error isolation — SMS failures must NEVER crash order operations
    console.error(`[Transactional SMS] Isolated error processing ${eventType} for order ${orderId}:`, err?.message || err);
    return {
      success: false,
      message: 'SMS dispatch error (isolated from order workflow).',
      errorCode: 'SERVICE_ERROR',
    };
  }
}

import type { APIRoute } from 'astro';
import { sendOrderTransactionalSms, type OrderNotificationEventType } from '../../../lib/orderNotificationService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { customerId, orderId, eventType, customerName, phone, shortOrderId } = body;

    if (!customerId || !orderId || !eventType) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: customerId, orderId, and eventType are mandatory.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validEventTypes: OrderNotificationEventType[] = [
      'ORDER_PLACED',
      'ORDER_CONFIRMED',
      'ORDER_PREPARING',
      'RIDER_ASSIGNED',
      'OUT_FOR_DELIVERY',
      'ORDER_DELIVERED',
      'ORDER_CANCELLED',
      'PAYMENT_SUCCESS',
      'PAYMENT_FAILED',
    ];

    if (!validEventTypes.includes(eventType as OrderNotificationEventType)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: `Invalid eventType '${eventType}'. Valid event types are: ${validEventTypes.join(', ')}`,
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await sendOrderTransactionalSms({
      customerId,
      orderId,
      eventType: eventType as OrderNotificationEventType,
      customerName,
      phone,
      shortOrderId,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[API notify] Server error processing notification:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error while processing transactional notification.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'active',
      service: 'Bhusawal Connect Transactional Order SMS API',
      supportedEvents: [
        'ORDER_PLACED',
        'ORDER_CONFIRMED',
        'ORDER_PREPARING',
        'RIDER_ASSIGNED',
        'OUT_FOR_DELIVERY',
        'ORDER_DELIVERED',
        'ORDER_CANCELLED',
        'PAYMENT_SUCCESS',
        'PAYMENT_FAILED',
      ],
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

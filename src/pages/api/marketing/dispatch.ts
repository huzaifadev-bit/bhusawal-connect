import type { APIRoute } from 'astro';
import { sendCustomerMarketingSms } from '../../../lib/marketingService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { campaignId, customerId, customerName, phone, offerMessage, isTestMode } = body;

    if (!campaignId || !customerId) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing required parameters: campaignId and customerId are mandatory.',
        }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await sendCustomerMarketingSms({
      campaignId,
      customerId,
      customerName,
      phone,
      offerMessage,
      isTestMode: typeof isTestMode === 'boolean' ? isTestMode : false,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (err: any) {
    console.error('[API marketing/dispatch] Error:', err);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error while processing marketing dispatch.',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      status: 'active',
      service: 'Bhusawal Connect Consent-Based Customer Marketing API',
      quietHours: '09:00 - 21:00 IST',
      frequencyLimits: 'Max 1 SMS per 24h, Max 2 SMS per 7 days',
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
};

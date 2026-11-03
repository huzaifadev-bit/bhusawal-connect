import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';

export const prerender = false;

// POST /api/rider/order-action
export const POST: APIRoute = async ({ request }) => {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON request body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { riderId = 'BSL-RIDER-8942', orderId, action } = body;

    if (!orderId || !action) {
      return new Response(
        JSON.stringify({ success: false, message: 'orderId and action are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const validActions = ['ACCEPT', 'REJECT', 'PICKUP', 'DELIVER', 'PASSENGER_START', 'PASSENGER_COMPLETE', 'CANCEL'];
    if (!validActions.includes(action)) {
      return new Response(
        JSON.stringify({ success: false, message: `Invalid action. Supported actions: ${validActions.join(', ')}` }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = ServerFleetEngine.handleAction(riderId, orderId, action);

    if (!result.success) {
      return new Response(
        JSON.stringify({
          success: false,
          message: result.message,
          rider: result.rider,
          order: result.order
        }),
        { status: result.code || 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const activeOrders = ServerFleetEngine.getActiveOrders(riderId);

    return new Response(
      JSON.stringify({
        success: true,
        message: result.message,
        rider: result.rider,
        order: result.order,
        activeOrders,
        activeCount: activeOrders.length,
        passengerExclusiveActive: (result.rider.state === 'PASSENGER_PICKUP' || result.rider.state === 'PASSENGER_ACTIVE')
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error processing order action.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

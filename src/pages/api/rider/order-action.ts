import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';
import { authenticateRiderRequest } from '../../../lib/riderAuth';

export const prerender = false;

// POST /api/rider/order-action
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await authenticateRiderRequest(request);
    if (!auth.authenticated || !auth.riderId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: auth.error || 'Authentication required. Missing Bearer token or session cookie.',
          code: 401
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid JSON request body.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { orderId, action } = body;

    // Strict Ownership Check: A rider CANNOT dispatch actions on behalf of another rider
    if (body.riderId && body.riderId !== auth.riderId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Forbidden: You cannot perform order actions for another rider.',
          code: 403
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

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

    // Authoritatively use the authenticated rider's verified identity
    const result = await ServerFleetEngine.handleActionAsync(auth.riderId, orderId, action);

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

    const activeOrders = await ServerFleetEngine.getActiveOrdersAsync(auth.riderId);

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

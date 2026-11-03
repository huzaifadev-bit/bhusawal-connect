import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';
import { authenticateRiderRequest } from '../../../lib/riderAuth';

export const prerender = false;

// GET /api/rider/orders
export const GET: APIRoute = async ({ request }) => {
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

    const url = new URL(request.url);
    const paramRiderId = url.searchParams.get('riderId');

    // Strict Ownership Check
    if (paramRiderId && paramRiderId !== auth.riderId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Forbidden: You are not authorized to view another partner\'s dispatch queue.',
          code: 403
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rider = await ServerFleetEngine.getRiderAsync(auth.riderId);
    const activeOrders = await ServerFleetEngine.getActiveOrdersAsync(auth.riderId);
    const availableOrders = ServerFleetEngine.getAvailableDispatchOrders(auth.riderId);

    return new Response(
      JSON.stringify({
        success: true,
        rider: {
          id: rider.id,
          name: rider.name,
          state: rider.state,
          isOnline: rider.isOnline,
          vehicleType: rider.vehicleType
        },
        activeOrders,
        activeCount: activeOrders.length,
        availableOrders,
        availableCount: availableOrders.length,
        passengerExclusiveActive: (rider.state === 'PASSENGER_PICKUP' || rider.state === 'PASSENGER_ACTIVE'),
        timestamp: Date.now()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error fetching orders.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

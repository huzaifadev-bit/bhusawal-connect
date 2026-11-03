import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';

export const prerender = false;

// GET /api/rider/orders?riderId=BSL-RIDER-8942
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const riderId = url.searchParams.get('riderId') || 'BSL-RIDER-8942';

    const rider = ServerFleetEngine.getRider(riderId);
    const activeOrders = ServerFleetEngine.getActiveOrders(riderId);
    const availableOrders = ServerFleetEngine.getAvailableDispatchOrders(riderId);

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

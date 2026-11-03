import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';

export const prerender = false;

// GET /api/rider/status?riderId=BSL-RIDER-8942
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const riderId = url.searchParams.get('riderId') || 'BSL-RIDER-8942';

    const rider = ServerFleetEngine.getRider(riderId);
    const activeOrders = ServerFleetEngine.getActiveOrders(riderId);

    return new Response(
      JSON.stringify({
        success: true,
        rider,
        activeOrders,
        activeCount: activeOrders.length,
        timestamp: Date.now()
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error fetching rider status.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// POST /api/rider/status { riderId, isOnline }
export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const riderId = body.riderId || 'BSL-RIDER-8942';
    const isOnline = Boolean(body.isOnline);

    const result = ServerFleetEngine.setDuty(riderId, isOnline);

    return new Response(
      JSON.stringify({
        success: true,
        rider: result.rider,
        message: `Rider is now ${isOnline ? 'ONLINE (Available for Shared Fleet)' : 'OFFLINE'}.`
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error updating duty state.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

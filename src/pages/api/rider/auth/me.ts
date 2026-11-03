import type { APIRoute } from 'astro';
import { authenticateRiderRequest } from '../../../../lib/riderAuth';
import { ServerFleetEngine } from '../../../../lib/serverFleetEngine';

export const prerender = false;

// GET /api/rider/auth/me
export const GET: APIRoute = async ({ request }) => {
  try {
    const auth = await authenticateRiderRequest(request);

    if (!auth.authenticated || !auth.riderId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: auth.error || 'Authentication required.',
          code: 401
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rider = await ServerFleetEngine.getRiderAsync(auth.riderId);
    const activeOrders = await ServerFleetEngine.getActiveOrdersAsync(auth.riderId);

    return new Response(
      JSON.stringify({
        success: true,
        rider,
        activeOrders,
        activeCount: activeOrders.length,
        session: {
          riderId: auth.session?.riderId,
          phone: auth.session?.phone,
          role: auth.session?.role,
          exp: auth.session?.exp
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error fetching authenticated rider session.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

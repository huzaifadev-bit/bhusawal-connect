import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';
import { authenticateRiderRequest } from '../../../lib/riderAuth';

export const prerender = false;

// GET /api/rider/status
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

    // Strict Ownership Check: Cannot query another rider's private operational status
    if (paramRiderId && paramRiderId !== auth.riderId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Forbidden: You are not authorized to inspect another partner\'s operational status.',
          code: 403
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
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

// POST /api/rider/status { isOnline }
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

    // Strict Ownership Check
    if (body.riderId && body.riderId !== auth.riderId) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Forbidden: You are not authorized to modify another partner\'s duty state.',
          code: 403
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const isOnline = Boolean(body.isOnline);
    const result = await ServerFleetEngine.setDutyAsync(auth.riderId, isOnline);

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

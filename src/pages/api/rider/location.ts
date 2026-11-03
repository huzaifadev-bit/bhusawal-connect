import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';
import { authenticateRiderRequest } from '../../../lib/riderAuth';

export const prerender = false;

// POST /api/rider/location
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
          message: 'Forbidden: You cannot update location telemetry for another rider.',
          code: 403
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const { lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'Numeric lat and lng coordinates are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = await ServerFleetEngine.updateLocationAsync(auth.riderId, lat, lng);

    return new Response(
      JSON.stringify({
        success: true,
        riderId: auth.riderId,
        lat: result.rider.currentLat,
        lng: result.rider.currentLng,
        timestamp: result.rider.lastLocationUpdate
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error updating location.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// GET /api/rider/location
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
          message: 'Forbidden: You cannot inspect another partner\'s GPS coordinates.',
          code: 403
        }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const rider = await ServerFleetEngine.getRiderAsync(auth.riderId);

    return new Response(
      JSON.stringify({
        success: true,
        riderId: auth.riderId,
        lat: rider.currentLat,
        lng: rider.currentLng,
        lastLocationUpdate: rider.lastLocationUpdate
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error fetching location.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

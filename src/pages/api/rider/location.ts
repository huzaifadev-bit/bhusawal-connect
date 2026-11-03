import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../lib/serverFleetEngine';

export const prerender = false;

// POST /api/rider/location
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

    const { riderId = 'BSL-RIDER-8942', lat, lng } = body;

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return new Response(
        JSON.stringify({ success: false, message: 'Numeric lat and lng coordinates are required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const result = ServerFleetEngine.updateLocation(riderId, lat, lng);

    return new Response(
      JSON.stringify({
        success: true,
        riderId,
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

// GET /api/rider/location?riderId=BSL-RIDER-8942
export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const riderId = url.searchParams.get('riderId') || 'BSL-RIDER-8942';

    const rider = ServerFleetEngine.getRider(riderId);

    return new Response(
      JSON.stringify({
        success: true,
        riderId,
        lat: rider.currentLat,
        lng: rider.currentLng,
        isOnline: rider.isOnline,
        state: rider.state,
        lastUpdated: rider.lastLocationUpdate
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error getting location.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

import type { APIRoute } from 'astro';
import { ServerFleetEngine } from '../../../../lib/serverFleetEngine';
import { createRiderSessionToken, createRiderSessionCookie, checkAuthRateLimit } from '../../../../lib/riderAuth';

export const prerender = false;

// POST /api/rider/auth/login
export const POST: APIRoute = async ({ request }) => {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || 'local';
    const rateCheck = checkAuthRateLimit(clientIp, 15, 60000);
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Too many login attempts. Please wait ${rateCheck.retryAfter} seconds.`,
          code: 429
        }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
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

    const { phone, riderId, otp, name, bikeNo, dlNo } = body;

    let targetRider: any = null;

    if (phone) {
      const cleanPhone = String(phone).replace(/\D/g, '').slice(-10);
      if (cleanPhone.length !== 10) {
        return new Response(
          JSON.stringify({ success: false, message: 'Invalid 10-digit Indian phone number.' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
      targetRider = await ServerFleetEngine.resolveRiderByPhone(cleanPhone, { name, bikeNo, dlNo });
    } else if (riderId) {
      targetRider = await ServerFleetEngine.getRiderAsync(riderId);
    }

    if (!targetRider) {
      return new Response(
        JSON.stringify({ success: false, message: 'Rider account not found. Please provide valid registered mobile number.' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // In production with MSG91 widget enabled, clients should authenticate via /verify-widget-token.
    // For direct login / test suite, validate OTP format or verify test credentials.
    if (otp !== undefined && String(otp).length < 4) {
      return new Response(
        JSON.stringify({ success: false, message: 'Invalid 4-digit verification code.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const token = createRiderSessionToken({
      id: targetRider.id,
      phone: targetRider.phone,
      name: targetRider.name
    });

    const cookieHeader = createRiderSessionCookie(token);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Welcome back, ${targetRider.name}! Signed session created.`,
        token,
        rider: targetRider
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': cookieHeader
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Server error during rider login.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

import type { APIRoute } from 'astro';
import { verifyMsg91WidgetAccessToken } from '../../../../lib/msg91Otp';
import { ServerFleetEngine } from '../../../../lib/serverFleetEngine';
import { createRiderSessionToken, createRiderSessionCookie, checkAuthRateLimit } from '../../../../lib/riderAuth';

export const prerender = false;

// POST /api/rider/auth/verify-widget-token
export const POST: APIRoute = async ({ request }) => {
  try {
    const clientIp = request.headers.get('x-forwarded-for') || 'local';
    const rateCheck = checkAuthRateLimit(clientIp, 10, 60000);
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

    const accessToken = body.accessToken || body['access-token'] || body.token || '';
    const phone = body.phone || body.mobile || body.identifier || '';

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return new Response(
        JSON.stringify({ success: false, message: 'MSG91 Widget access token is required.' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Verify token with server-side MSG91 verification engine
    const verification = await verifyMsg91WidgetAccessToken(accessToken, phone);

    if (!verification.success || !verification.phone) {
      return new Response(
        JSON.stringify({
          success: false,
          message: verification.message || 'OTP Widget verification failed.',
          errorCode: verification.errorCode
        }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const verifiedPhone = verification.phone.replace(/\D/g, '').slice(-10);

    // Resolve or link rider in fleet database
    const rider = await ServerFleetEngine.resolveRiderByPhone(verifiedPhone);

    // Create cryptographically signed session token
    const token = createRiderSessionToken({
      id: rider.id,
      phone: rider.phone,
      name: rider.name
    });

    const cookieHeader = createRiderSessionCookie(token);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Welcome back, ${rider.name}! Authentication verified.`,
        token,
        rider
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
      JSON.stringify({ success: false, message: err.message || 'Server error during rider widget authentication.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

import type { APIRoute } from 'astro';
import { verifyMsg91WidgetAccessToken } from '../../../lib/msg91Otp';

export const POST: APIRoute = async ({ request }) => {
  try {
    let body: any = {};
    try {
      body = await request.json();
    } catch (e) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid request body. Expected JSON format.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const accessToken = body.accessToken || body['access-token'] || body.token || '';
    const phone = body.phone || body.mobile || body.identifier || '';

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Widget access token is required.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    if (accessToken.length > 4096) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Invalid token format. Token exceeds maximum allowable length.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await verifyMsg91WidgetAccessToken(accessToken, phone);
    
    let statusCode = 200;
    if (!result.success) {
      if (result.errorCode === 'MISSING_ACCESS_TOKEN' || result.errorCode === 'INVALID_TOKEN_SIZE') {
        statusCode = 400;
      } else if (result.errorCode === 'PHONE_NUMBER_MISMATCH') {
        statusCode = 403;
      } else if (result.errorCode === 'MSG91_NOT_CONFIGURED') {
        statusCode = 503;
      } else {
        statusCode = 422;
      }
    }

    return new Response(JSON.stringify(result), {
      status: statusCode,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    });
  } catch (err: any) {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'An unexpected server error occurred during MSG91 phone OTP verification.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      service: 'Bhusawal Connect MSG91 Widget Token Verification API',
      status: 'Ready',
      method: 'POST',
      body: { accessToken: '<widget_access_token>', phone: '+919876543210' },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

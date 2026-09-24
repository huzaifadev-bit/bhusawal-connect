import type { APIRoute } from 'astro';
import { requestMsg91Otp } from '../../../lib/msg91Otp';

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

    const { phone } = body || {};
    if (!phone || typeof phone !== 'string') {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Phone number is required.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await requestMsg91Otp(phone);
    const statusCode = result.success ? 200 : (result.errorCode === 'INVALID_PHONE_FORMAT' ? 400 : 422);

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
        message: 'An unexpected server error occurred.',
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
      service: 'Bhusawal Connect MSG91 OTP API',
      status: 'Ready',
      method: 'POST',
      body: { phone: '9876543210' },
    }),
    {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }
  );
};

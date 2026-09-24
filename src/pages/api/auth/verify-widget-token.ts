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
          message: 'Invalid token format.',
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        }
      );
    }

    const result = await verifyMsg91WidgetAccessToken(accessToken);
    const statusCode = result.success ? 200 : (result.errorCode === 'MISSING_ACCESS_TOKEN' ? 400 : 422);

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
        message: 'An unexpected server error occurred during MSG91 widget token verification.',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
};

export const ALL: APIRoute = async ({ request }) => {
  if (request.method !== 'POST') {
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Method not allowed. Only POST requests are supported.',
      }),
      {
        status: 405,
        headers: { 'Content-Type': 'application/json', 'Allow': 'POST' },
      }
    );
  }
  return POST({ request } as any);
};


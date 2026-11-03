import type { APIRoute } from 'astro';
import { authenticateRiderRequest, revokeRiderSession, createRiderLogoutCookie } from '../../../../lib/riderAuth';

export const prerender = false;

// POST /api/rider/auth/logout
export const POST: APIRoute = async ({ request }) => {
  try {
    const auth = await authenticateRiderRequest(request);

    if (auth.authenticated && auth.session?.sessionId) {
      revokeRiderSession(auth.session.sessionId);
    }

    const clearCookie = createRiderLogoutCookie();

    return new Response(
      JSON.stringify({ success: true, message: 'Logged out successfully. Rider session revoked.' }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Set-Cookie': clearCookie
        }
      }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ success: false, message: err.message || 'Error logging out.' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

import crypto from 'node:crypto';

export interface RiderSessionPayload {
  riderId: string;
  phone: string;
  name: string;
  role: 'RIDER';
  iat: number;
  exp: number;
  sessionId: string;
}

export interface SessionVerificationResult {
  authenticated: boolean;
  riderId?: string;
  session?: RiderSessionPayload;
  error?: string;
  statusCode?: number;
}

// In-memory revocation cache for logged out sessions
const revokedSessions = new Set<string>();

// Rate limiting cache for auth attempts (max 10 requests per 60 seconds per IP/phone)
const authRateLimits = new Map<string, { count: number; resetTime: number }>();

function getSecretKey(): string {
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
    if (process.env.MSG91_AUTH_KEY) return `msg91_derived_${process.env.MSG91_AUTH_KEY}`;
  }
  return 'bhusawal_connect_rider_production_signing_key_2026_super_secure';
}

function base64UrlEncode(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function base64UrlDecode(str: string): string {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
}

/**
 * Creates a cryptographically signed HMAC-SHA256 session token for a rider.
 */
export function createRiderSessionToken(
  rider: { id: string; phone: string; name?: string },
  expiresInSeconds: number = 7 * 24 * 3600 // 7 days default
): string {
  const now = Math.floor(Date.now() / 1000);
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: RiderSessionPayload = {
    riderId: rider.id,
    phone: rider.phone,
    name: rider.name || 'Fleet Partner',
    role: 'RIDER',
    iat: now,
    exp: now + expiresInSeconds,
    sessionId: crypto.randomBytes(16).toString('hex')
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const signature = crypto
    .createHmac('sha256', getSecretKey())
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  return `${dataToSign}.${signature}`;
}

/**
 * Verifies and decodes a signed rider session token.
 */
export function verifyRiderSessionToken(token: string): { valid: boolean; payload?: RiderSessionPayload; error?: string } {
  if (!token || typeof token !== 'string') {
    return { valid: false, error: 'Token missing or invalid format.' };
  }

  const parts = token.trim().split('.');
  if (parts.length !== 3) {
    return { valid: false, error: 'Malformed session token.' };
  }

  const [encodedHeader, encodedPayload, signature] = parts;
  const dataToSign = `${encodedHeader}.${encodedPayload}`;

  const expectedSignature = crypto
    .createHmac('sha256', getSecretKey())
    .update(dataToSign)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');

  // Constant-time signature comparison to prevent timing attacks
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSignature);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return { valid: false, error: 'Invalid token signature.' };
  }

  try {
    const payloadJson = base64UrlDecode(encodedPayload);
    const payload: RiderSessionPayload = JSON.parse(payloadJson);

    // Verify role
    if (payload.role !== 'RIDER') {
      return { valid: false, error: 'Unauthorized role in session token.' };
    }

    // Verify expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return { valid: false, error: 'Session token has expired.' };
    }

    // Check revocation
    if (payload.sessionId && revokedSessions.has(payload.sessionId)) {
      return { valid: false, error: 'Session has been revoked/logged out.' };
    }

    return { valid: true, payload };
  } catch (err: any) {
    return { valid: false, error: 'Corrupt payload in session token.' };
  }
}

/**
 * Extracts and verifies rider session from an incoming HTTP Request.
 * Inspects:
 * 1. Authorization: Bearer <token>
 * 2. Cookie: bsl_rider_session=<token>
 */
export async function authenticateRiderRequest(request: Request): Promise<SessionVerificationResult> {
  let token: string | null = null;

  // 1. Check Authorization header
  const authHeader = request.headers.get('authorization') || request.headers.get('Authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Fallback to Cookie header
  if (!token) {
    const cookieHeader = request.headers.get('cookie') || request.headers.get('Cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)bsl_rider_session=([^;]+)/);
      if (match) {
        token = decodeURIComponent(match[1].trim());
      }
    }
  }

  if (!token) {
    return {
      authenticated: false,
      error: 'Authentication required. Missing Bearer token or session cookie.',
      statusCode: 401
    };
  }

  const result = verifyRiderSessionToken(token);
  if (!result.valid || !result.payload) {
    return {
      authenticated: false,
      error: result.error || 'Invalid session credentials.',
      statusCode: 401
    };
  }

  return {
    authenticated: true,
    riderId: result.payload.riderId,
    session: result.payload
  };
}

/**
 * Revokes a session upon explicit logout.
 */
export function revokeRiderSession(sessionId: string): void {
  if (sessionId) {
    revokedSessions.add(sessionId);
    // Auto-prune old sessions to prevent memory leak
    if (revokedSessions.size > 5000) {
      const arr = Array.from(revokedSessions);
      revokedSessions.clear();
      for (const id of arr.slice(-2000)) {
        revokedSessions.add(id);
      }
    }
  }
}

/**
 * Generates Set-Cookie header for rider session.
 */
export function createRiderSessionCookie(token: string, maxAgeSeconds: number = 7 * 24 * 3600): string {
  const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
  return `bsl_rider_session=${encodeURIComponent(token)}; Path=/; Max-Age=${maxAgeSeconds}; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

/**
 * Generates Set-Cookie header to clear rider session on logout.
 */
export function createRiderLogoutCookie(): string {
  const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production';
  return `bsl_rider_session=; Path=/; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT; HttpOnly; SameSite=Lax${isProd ? '; Secure' : ''}`;
}

/**
 * Rate Limiter for Authentication endpoints.
 */
export function checkAuthRateLimit(identifier: string, limit: number = 10, windowMs: number = 60000): { allowed: boolean; retryAfter?: number } {
  const now = Date.now();
  const entry = authRateLimits.get(identifier);

  if (!entry || now > entry.resetTime) {
    authRateLimits.set(identifier, { count: 1, resetTime: now + windowMs });
    return { allowed: true };
  }

  if (entry.count >= limit) {
    const retryAfter = Math.ceil((entry.resetTime - now) / 1000);
    return { allowed: false, retryAfter };
  }

  entry.count += 1;
  return { allowed: true };
}

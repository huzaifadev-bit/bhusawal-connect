/**
 * Vercel Serverless Function: POST /api/auth/verify-phone-otp
 * Verifies MSG91 OTP widget access-token against official MSG91 verification API.
 * Uses process.env.MSG91_AUTH_KEY strictly server-side.
 */

function normalizeIndianPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`;
  return null;
}

function extractPhoneFromJwt(jwtToken) {
  try {
    const parts = jwtToken.split('.');
    if (parts.length === 3) {
      const payloadBase64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const payloadJson = Buffer.from(payloadBase64, 'base64').toString('utf8');
      const parsed = JSON.parse(payloadJson);
      const raw = parsed.mobile || parsed.number || parsed.phone || parsed.identifier || parsed.sub ||
        (parsed.data && (parsed.data.mobile || parsed.data.number || parsed.data.phone)) || '';
      if (raw) return String(raw);
    }
  } catch (e) {}
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({
      success: false,
      message: 'Method not allowed. Only POST requests are supported.'
    });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) { body = {}; }
    }
    body = body || {};

    const accessToken = body.accessToken || body['access-token'] || body.token || '';
    const phone = body.phone || body.mobile || body.identifier || '';

    if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
      return res.status(400).json({
        success: false,
        message: 'Widget access token is required.',
        errorCode: 'MISSING_ACCESS_TOKEN'
      });
    }

    if (accessToken.length > 4096) {
      return res.status(400).json({
        success: false,
        message: 'Invalid token format. Token exceeds maximum allowable length.',
        errorCode: 'INVALID_TOKEN_SIZE'
      });
    }

    const authKey = process.env.MSG91_AUTH_KEY || '';
    if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
      return res.status(503).json({
        success: false,
        message: 'MSG91 server credentials (MSG91_AUTH_KEY) are not configured in environment variables.',
        errorCode: 'MSG91_NOT_CONFIGURED'
      });
    }

    // Call official MSG91 verifyAccessToken endpoint via HTTPS
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const upstreamRes = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      },
      body: JSON.stringify({
        authkey: authKey,
        'access-token': accessToken.trim()
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    const upstreamData = await upstreamRes.json().catch(() => ({}));

    // Fail closed if HTTP status is not ok or MSG91 reports an error
    if (!upstreamRes.ok || upstreamData.type === 'error' || (upstreamData.status && upstreamData.status !== 'success' && upstreamData.type !== 'success')) {
      return res.status(422).json({
        success: false,
        message: upstreamData.message || 'Invalid, expired, or rejected OTP widget access token.',
        errorCode: 'INVALID_WIDGET_TOKEN'
      });
    }

    // Extract verified phone number from response or JWT payload
    const rawMobile = upstreamData.mobile || upstreamData.number || upstreamData.phone || upstreamData.identifier ||
      (upstreamData.data && (upstreamData.data.mobile || upstreamData.data.number || upstreamData.data.phone || upstreamData.data.identifier)) ||
      extractPhoneFromJwt(accessToken.trim()) ||
      '';

    let verifiedPhone = normalizeIndianPhone(String(rawMobile));

    // Fallback to client phone if verified and token didn't contain explicit number
    if (!verifiedPhone && phone) {
      verifiedPhone = normalizeIndianPhone(phone);
    }

    if (!verifiedPhone) {
      return res.status(422).json({
        success: false,
        message: 'Could not resolve valid phone number from provider token verification.',
        errorCode: 'INVALID_PHONE_IN_TOKEN'
      });
    }

    // Enforce phone number correlation: token must correspond to authenticating phone
    if (phone) {
      const normalizedExpected = normalizeIndianPhone(phone);
      if (normalizedExpected && normalizedExpected !== verifiedPhone) {
        return res.status(403).json({
          success: false,
          message: 'Phone number mismatch. The verified token does not match the phone number being authenticated.',
          errorCode: 'PHONE_NUMBER_MISMATCH'
        });
      }
    }

    // User profile response (CUSTOMER role, never privileged)
    return res.status(200).json({
      success: true,
      phone: verifiedPhone,
      user: {
        id: 'CUST-' + verifiedPhone.slice(-4),
        phone: verifiedPhone,
        name: 'Customer',
        role: 'CUSTOMER'
      },
      message: 'MSG91 Widget access token verified successfully.'
    });

  } catch (err) {
    if (err.name === 'AbortError') {
      return res.status(504).json({
        success: false,
        message: 'Verification request timed out. Please try again.',
        errorCode: 'TIMEOUT_ERROR'
      });
    }
    return res.status(500).json({
      success: false,
      message: 'An unexpected server error occurred during MSG91 phone OTP verification.',
      errorCode: 'INTERNAL_SERVER_ERROR'
    });
  }
};

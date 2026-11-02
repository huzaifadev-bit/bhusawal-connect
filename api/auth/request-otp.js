/**
 * Vercel Serverless Function: POST /api/auth/request-otp
 * Direct MSG91 SMS OTP request fallback.
 */

function normalizeIndianPhone(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`;
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

    const phone = body.phone || body.mobile || '';
    const normalized = normalizeIndianPhone(phone);

    if (!normalized) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number.',
        errorCode: 'INVALID_PHONE_FORMAT'
      });
    }

    const authKey = process.env.MSG91_AUTH_KEY || '';
    const templateId = process.env.MSG91_TEMPLATE_ID || '';
    const apiUrl = process.env.MSG91_OTP_API_URL || 'https://control.msg91.com/api/v5/otp';

    if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
      return res.status(503).json({
        success: false,
        message: 'SMS Gateway credentials (MSG91_AUTH_KEY) are missing from server environment.',
        errorCode: 'MSG91_NOT_CONFIGURED'
      });
    }

    const msg91Mobile = normalized.replace('+', '');
    const queryParams = new URLSearchParams({
      template_id: templateId,
      mobile: msg91Mobile
    });

    const response = await fetch(`${apiUrl}?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === 'error') {
      return res.status(422).json({
        success: false,
        message: data.message || 'Unable to send OTP via SMS provider. Please verify DLT template and balance.',
        errorCode: 'PROVIDER_ERROR'
      });
    }

    return res.status(200).json({
      success: true,
      phone: normalized,
      message: 'OTP verification code sent successfully via SMS.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Network error communicating with OTP service. Please try again.',
      errorCode: 'NETWORK_ERROR'
    });
  }
}

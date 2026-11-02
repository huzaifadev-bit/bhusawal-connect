/**
 * Vercel Serverless Function: POST /api/auth/verify-otp
 * Direct MSG91 SMS OTP verification fallback.
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

    const { phone, otp } = body;
    const normalized = normalizeIndianPhone(phone);

    if (!normalized) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid 10-digit Indian mobile number.',
        errorCode: 'INVALID_PHONE_FORMAT'
      });
    }

    const cleanOtp = String(otp || '').trim();
    if (!cleanOtp || cleanOtp.length < 4 || cleanOtp.length > 6 || !/^\d+$/.test(cleanOtp)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid OTP code.',
        errorCode: 'INVALID_OTP_FORMAT'
      });
    }

    const authKey = process.env.MSG91_AUTH_KEY || '';
    if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
      return res.status(503).json({
        success: false,
        message: 'SMS Gateway credentials (MSG91_AUTH_KEY) are missing in server environment.',
        errorCode: 'MSG91_NOT_CONFIGURED'
      });
    }

    const msg91Mobile = normalized.replace('+', '');
    const queryParams = new URLSearchParams({
      mobile: msg91Mobile,
      otp: cleanOtp
    });

    const verifyUrl = 'https://control.msg91.com/api/v5/otp/verify';
    const response = await fetch(`${verifyUrl}?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey
      }
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === 'error' || data.message?.toLowerCase().includes('invalid') || data.message?.toLowerCase().includes('not match') || data.message?.toLowerCase().includes('expired')) {
      return res.status(422).json({
        success: false,
        message: data.message || 'Invalid or expired OTP code. Please try again.',
        errorCode: 'INVALID_OTP'
      });
    }

    return res.status(200).json({
      success: true,
      phone: normalized,
      user: {
        id: 'CUST-' + normalized.slice(-4),
        phone: normalized,
        name: 'Customer',
        role: 'CUSTOMER'
      },
      message: 'OTP verified successfully.'
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Network error verifying OTP code. Please try again.',
      errorCode: 'NETWORK_ERROR'
    });
  }
}

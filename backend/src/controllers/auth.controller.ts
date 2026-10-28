import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import prisma from '../db';

const JWT_SECRET = process.env.JWT_SECRET || 'bhusawal_connect_super_secret_key_12345';

// Mock DB storage in case PostgreSQL is offline
const inMemoryUsers: any[] = [
  { id: '1', phone: '+919999999999', name: 'Sahil Patel', role: 'CUSTOMER' },
  { id: '2', phone: '+918888888888', name: 'Rahul Sharma', role: 'MERCHANT' },
  { id: '3', phone: '+917777777777', name: 'Vikram Mehta', role: 'RIDER' }
];

export const requestOtp = async (req: Request, res: Response) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Mobile number is required.' });
  }

  console.log(`[AUTH] OTP request for phone: ${phone}. Sent mock OTP: 123456`);
  res.status(200).json({ success: true, message: 'OTP sent successfully (Use 123456 to log in)' });
};

export const verifyOtp = async (req: Request, res: Response) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone and OTP are required.' });
  }

  if (otp !== '123456') {
    return res.status(400).json({ error: 'Invalid OTP code.' });
  }

  try {
    let user: any = null;

    // Attempt to read from PostgreSQL database
    try {
      user = await prisma.user.findUnique({ where: { phone } });
      if (!user) {
        user = await prisma.user.create({
          data: { phone, role: 'CUSTOMER' }
        });
      }
    } catch (dbError) {
      console.warn('[AUTH] Database connection failed. Falling back to in-memory login.');
      user = inMemoryUsers.find(u => u.phone === phone);
      if (!user) {
        user = { id: `MOCK-${Date.now()}`, phone, role: 'CUSTOMER', name: 'Guest User' };
        inMemoryUsers.push(user);
      }
    }

    const token = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.status(200).json({
      success: true,
      token,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name || 'Bhusawal Resident',
        role: user.role
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message || 'Verification failed.' });
  }
};

function normalizeIndianPhone(phone: any): string | null {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (digits.length === 13 && digits.startsWith('091')) return `+${digits.slice(1)}`;
  return null;
}

function extractPhoneFromJwt(jwtToken: string): string | null {
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

export const verifyPhoneOtp = async (req: Request, res: Response) => {
  const { accessToken, token, phone, mobile, identifier } = req.body || {};
  const tokenVal = accessToken || req.body?.['access-token'] || token || '';
  const phoneVal = phone || mobile || identifier || '';

  if (!tokenVal || typeof tokenVal !== 'string' || !tokenVal.trim()) {
    return res.status(400).json({
      success: false,
      message: 'Widget access token is required.',
      errorCode: 'MISSING_ACCESS_TOKEN'
    });
  }

  if (tokenVal.length > 4096) {
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

  try {
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
        'access-token': tokenVal.trim()
      }),
      signal: controller.signal
    }).finally(() => clearTimeout(timeoutId));

    const upstreamData = await upstreamRes.json().catch(() => ({}));

    if (!upstreamRes.ok || upstreamData.type === 'error' || (upstreamData.status && upstreamData.status !== 'success' && upstreamData.type !== 'success')) {
      return res.status(422).json({
        success: false,
        message: upstreamData.message || 'Invalid, expired, or rejected OTP widget access token.',
        errorCode: 'INVALID_WIDGET_TOKEN'
      });
    }

    const rawMobile = upstreamData.mobile || upstreamData.number || upstreamData.phone || upstreamData.identifier ||
      (upstreamData.data && (upstreamData.data.mobile || upstreamData.data.number || upstreamData.data.phone || upstreamData.data.identifier)) ||
      extractPhoneFromJwt(tokenVal.trim()) ||
      '';

    let verifiedPhone = normalizeIndianPhone(rawMobile);
    if (!verifiedPhone && phoneVal) {
      verifiedPhone = normalizeIndianPhone(phoneVal);
    }

    if (!verifiedPhone) {
      return res.status(422).json({
        success: false,
        message: 'Could not resolve valid phone number from provider token verification.',
        errorCode: 'INVALID_PHONE_IN_TOKEN'
      });
    }

    if (phoneVal) {
      const expectedNormalized = normalizeIndianPhone(phoneVal);
      if (expectedNormalized && expectedNormalized !== verifiedPhone) {
        return res.status(403).json({
          success: false,
          message: 'Phone number mismatch. The verified token does not match the phone number being authenticated.',
          errorCode: 'PHONE_NUMBER_MISMATCH'
        });
      }
    }

    let user: any = null;
    try {
      user = await prisma.user.findUnique({ where: { phone: verifiedPhone } });
      if (!user) {
        user = await prisma.user.create({
          data: { phone: verifiedPhone, role: 'CUSTOMER' }
        });
      }
    } catch (dbError) {
      user = inMemoryUsers.find(u => u.phone === verifiedPhone);
      if (!user) {
        user = { id: `CUST-${Date.now()}`, phone: verifiedPhone, role: 'CUSTOMER', name: 'Customer' };
        inMemoryUsers.push(user);
      }
    }

    const jwtToken = jwt.sign(
      { userId: user.id, phone: user.phone, role: user.role || 'CUSTOMER' },
      JWT_SECRET,
      { expiresIn: '30d' }
    );

    return res.status(200).json({
      success: true,
      token: jwtToken,
      phone: verifiedPhone,
      user: {
        id: user.id,
        phone: user.phone,
        name: user.name || 'Customer',
        role: user.role || 'CUSTOMER'
      },
      message: 'MSG91 Widget access token verified successfully.'
    });
  } catch (err: any) {
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

export const verifyWidgetToken = verifyPhoneOtp;


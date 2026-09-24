import { normalizeIndianPhone, syncCustomerProfile } from './customerAuth';

// In-memory rate limiting cooldown cache (60 seconds per phone)
const otpCooldownCache = new Map<string, number>();

// In-memory failed verification attempt tracking (max 5 attempts per 10 mins)
const verificationAttemptsCache = new Map<string, { count: number; timestamp: number }>();

export interface OtpRequestResponse {
  success: boolean;
  message: string;
  phone?: string;
  cooldownSeconds?: number;
  errorCode?: string;
  user?: any;
}

/**
 * Masks phone number for safe logging (e.g., +91******3210).
 */
export function maskPhoneForLog(phone: string): string {
  if (!phone || phone.length < 10) return '***';
  const clean = phone.replace(/\D/g, '');
  if (clean.length < 10) return '***';
  const last4 = clean.slice(-4);
  return `+91******${last4}`;
}

/**
 * Secure server-side MSG91 OTP Request Engine.
 * Never exposes MSG91_AUTH_KEY to browser bundles.
 */
export async function requestMsg91Otp(phoneInput: string): Promise<OtpRequestResponse> {
  const normalized = normalizeIndianPhone(phoneInput);

  if (!normalized) {
    return {
      success: false,
      message: 'Please enter a valid 10-digit Indian mobile number (e.g., 9876543210).',
      errorCode: 'INVALID_PHONE_FORMAT',
    };
  }

  const now = Date.now();
  const lastRequestTime = otpCooldownCache.get(normalized);
  const COOLDOWN_MS = 60 * 1000; // 60s resend cooldown

  if (lastRequestTime && now - lastRequestTime < COOLDOWN_MS) {
    const remaining = Math.ceil((COOLDOWN_MS - (now - lastRequestTime)) / 1000);
    return {
      success: false,
      message: `Please wait ${remaining} seconds before requesting another OTP.`,
      cooldownSeconds: remaining,
      errorCode: 'RATE_LIMIT_COOLDOWN',
    };
  }

  // Read credentials exclusively from server-side environment variables
  const authKey = process.env.MSG91_AUTH_KEY || import.meta.env.MSG91_AUTH_KEY || '';
  const templateId = process.env.MSG91_TEMPLATE_ID || import.meta.env.MSG91_TEMPLATE_ID || '';
  const apiUrl = process.env.MSG91_OTP_API_URL || import.meta.env.MSG91_OTP_API_URL || 'https://control.msg91.com/api/v5/otp';

  const maskedPhone = maskPhoneForLog(normalized);


  // Check if MSG91 secrets are populated with real values or placeholder
  if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY' || !templateId || templateId === 'YOUR_MSG91_TEMPLATE_ID') {
    return {
      success: false,
      phone: normalized,
      errorCode: 'MSG91_NOT_CONFIGURED',
      message: 'SMS Gateway credentials (MSG91_AUTH_KEY / MSG91_TEMPLATE_ID) are missing from server environment.',
    };
  }

  // Extract 10-digit mobile number for MSG91 payload format (e.g., 919876543210)
  const msg91Mobile = normalized.replace('+', '');

  try {
    const queryParams = new URLSearchParams({
      template_id: templateId,
      mobile: msg91Mobile,
    });

    const response = await fetch(`${apiUrl}?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === 'error') {
      return {
        success: false,
        message: data.message || 'Unable to send OTP via SMS provider. Please verify DLT template and account balance.',
        errorCode: 'PROVIDER_ERROR',
      };
    }

    // Set cooldown on successful provider dispatch
    otpCooldownCache.set(normalized, now);

    return {
      success: true,
      phone: normalized,
      message: 'OTP verification code sent successfully via SMS.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Network error communicating with OTP service. Please try again.',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

/**
 * Secure server-side MSG91 OTP Verification Engine.
 * Connects verified MSG91 OTP to Supabase customer profile/session.
 */
export async function verifyMsg91Otp(phoneInput: string, otpInput: string): Promise<OtpRequestResponse> {
  const normalized = normalizeIndianPhone(phoneInput);
  if (!normalized) {
    return {
      success: false,
      message: 'Please enter a valid 10-digit Indian mobile number.',
      errorCode: 'INVALID_PHONE_FORMAT',
    };
  }

  const cleanOtp = String(otpInput || '').trim();
  if (!cleanOtp || cleanOtp.length < 4 || cleanOtp.length > 6 || !/^\d+$/.test(cleanOtp)) {
    return {
      success: false,
      message: 'Please enter a valid OTP code.',
      errorCode: 'INVALID_OTP_FORMAT',
    };
  }

  // Brute-force protection: Max 5 failed verification attempts per 10 minutes
  const now = Date.now();
  const attemptInfo = verificationAttemptsCache.get(normalized);
  if (attemptInfo && attemptInfo.count >= 5 && now - attemptInfo.timestamp < 10 * 60 * 1000) {
    return {
      success: false,
      message: 'Too many failed OTP verification attempts. Please wait 10 minutes or request a new OTP.',
      errorCode: 'VERIFICATION_ATTEMPTS_EXCEEDED',
    };
  }

  const authKey = process.env.MSG91_AUTH_KEY || import.meta.env.MSG91_AUTH_KEY || '';

  if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
    return {
      success: false,
      phone: normalized,
      errorCode: 'MSG91_NOT_CONFIGURED',
      message: 'SMS Gateway credentials (MSG91_AUTH_KEY) are missing in server environment.',
    };
  }

  const msg91Mobile = normalized.replace('+', '');

  try {
    const queryParams = new URLSearchParams({
      mobile: msg91Mobile,
      otp: cleanOtp,
    });

    const verifyUrl = 'https://control.msg91.com/api/v5/otp/verify';
    const response = await fetch(`${verifyUrl}?${queryParams.toString()}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === 'error' || data.message?.toLowerCase().includes('invalid') || data.message?.toLowerCase().includes('not match') || data.message?.toLowerCase().includes('expired')) {
      const currentCount = (attemptInfo?.count || 0) + 1;
      verificationAttemptsCache.set(normalized, { count: currentCount, timestamp: now });

      return {
        success: false,
        message: data.message || 'Invalid or expired OTP code. Please try again.',
        errorCode: 'INVALID_OTP',
      };
    }

    // Reset failed verification attempts on success
    verificationAttemptsCache.delete(normalized);

    // Sync Supabase customer profile for the verified phone number
    let profile = null;
    try {
      profile = await syncCustomerProfile(normalized, normalized);
    } catch (e) {
      console.warn('[verifyMsg91Otp] Supabase sync fallback:', e);
    }

    return {
      success: true,
      phone: normalized,
      user: profile || {
        id: 'CUST-' + normalized.slice(-4),
        phone: normalized,
        name: 'Customer',
      },
      message: 'OTP verified successfully.',
    };
  } catch (err: any) {
    return {
      success: false,
      message: 'Network error verifying OTP code. Please try again.',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

/**
 * Secure server-side MSG91 OTP Widget Token Verification Engine.
 * Verifies JWT access-token returned by MSG91 OTP Widget via POST https://control.msg91.com/api/v5/widget/verifyAccessToken
 * Uses MSG91_AUTH_KEY strictly server-side.
 */
export async function verifyMsg91WidgetAccessToken(accessToken: string): Promise<OtpRequestResponse> {
  if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
    return {
      success: false,
      message: 'Access token is required for verification.',
      errorCode: 'MISSING_ACCESS_TOKEN',
    };
  }

  const authKey = process.env.MSG91_AUTH_KEY || import.meta.env.MSG91_AUTH_KEY || '';
  if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
    return {
      success: false,
      errorCode: 'MSG91_NOT_CONFIGURED',
      message: 'MSG91 server credentials are not configured in environment variables.',
    };
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const response = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': authKey,
      },
      body: JSON.stringify({
        authkey: authKey,
        'access-token': accessToken.trim(),
      }),
      signal: controller.signal,
    }).finally(() => clearTimeout(timeoutId));

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.type === 'error' || (data.status && data.status !== 'success' && data.type !== 'success')) {

      return {
        success: false,
        message: data.message || 'Invalid or expired OTP widget access token.',
        errorCode: 'INVALID_WIDGET_TOKEN',
      };
    }

    const rawMobile = data.mobile || data.number || data.phone || data.identifier || '';
    const normalized = normalizeIndianPhone(String(rawMobile));

    if (!normalized) {
      return {
        success: false,
        message: 'Could not extract valid phone number from provider token verification.',
        errorCode: 'INVALID_PHONE_IN_TOKEN',
      };
    }

    const maskedPhone = maskPhoneForLog(normalized);
    const profile = await syncCustomerProfile(normalized, normalized);



    return {
      success: true,
      phone: normalized,
      user: profile,
      message: 'MSG91 Widget access token verified successfully.',
    };
  } catch (err: any) {

    return {
      success: false,
      message: 'Network error verifying MSG91 OTP widget token.',
      errorCode: 'NETWORK_ERROR',
    };
  }
}

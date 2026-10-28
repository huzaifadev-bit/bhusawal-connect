import { defineConfig } from 'astro/config';

export default defineConfig({
  output: 'static',
  trailingSlash: 'never',
  vite: {
    plugins: [
      {
        name: 'fix-malformed-uri-guard',
        enforce: 'pre',
        configureServer(server) {
          server.middlewares.use((req, res, next) => {
            if (req.url) {
              try {
                decodeURI(req.url);
              } catch (e) {
                req.url = req.url.replace(/%(?![0-9a-fA-F]{2})/g, '%25');
                try {
                  decodeURI(req.url);
                } catch (e2) {
                  req.url = encodeURI(req.url);
                }
              }
            }
            next();
          });

          // Built-in Dev Middleware for MSG91 OTP verification
          server.middlewares.use(async (req, res, next) => {
            const url = req.url ? req.url.split('?')[0] : '';
            if ((url === '/api/auth/verify-phone-otp' || url === '/api/auth/verify-widget-token') && req.method === 'POST') {
              let bodyStr = '';
              req.on('data', chunk => { bodyStr += chunk; });
              req.on('end', async () => {
                let parsed = {};
                try { parsed = JSON.parse(bodyStr); } catch (e) {}

                const accessToken = parsed.accessToken || parsed['access-token'] || parsed.token || '';
                const phone = parsed.phone || parsed.mobile || parsed.identifier || '';

                res.setHeader('Content-Type', 'application/json');

                if (!accessToken || typeof accessToken !== 'string' || !accessToken.trim()) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ success: false, message: 'Widget access token is required.', errorCode: 'MISSING_ACCESS_TOKEN' }));
                  return;
                }

                if (accessToken.length > 4096) {
                  res.statusCode = 400;
                  res.end(JSON.stringify({ success: false, message: 'Invalid token format. Token exceeds maximum allowable length.', errorCode: 'INVALID_TOKEN_SIZE' }));
                  return;
                }

                const authKey = process.env.MSG91_AUTH_KEY || '';
                if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
                  res.statusCode = 503;
                  res.end(JSON.stringify({ success: false, message: 'MSG91 server credentials (MSG91_AUTH_KEY) are not configured in environment variables.', errorCode: 'MSG91_NOT_CONFIGURED' }));
                  return;
                }

                try {
                  const controller = new AbortController();
                  const timeoutId = setTimeout(() => controller.abort(), 8000);

                  const upstreamRes = await fetch('https://control.msg91.com/api/v5/widget/verifyAccessToken', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'authkey': authKey },
                    body: JSON.stringify({ authkey: authKey, 'access-token': accessToken.trim() }),
                    signal: controller.signal
                  }).finally(() => clearTimeout(timeoutId));

                  const data = await upstreamRes.json().catch(() => ({}));

                  if (!upstreamRes.ok || data.type === 'error' || (data.status && data.status !== 'success' && data.type !== 'success')) {
                    res.statusCode = 422;
                    res.end(JSON.stringify({ success: false, message: data.message || 'Invalid or expired OTP widget access token.', errorCode: 'INVALID_WIDGET_TOKEN' }));
                    return;
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

                  const rawMobile = data.mobile || data.number || data.phone || data.identifier ||
                    (data.data && (data.data.mobile || data.data.number || data.data.phone || data.data.identifier)) ||
                    extractPhoneFromJwt(accessToken.trim()) || '';

                  let digits = String(rawMobile).replace(/\D/g, '');
                  let verifiedPhone = digits.length === 10 ? `+91${digits}` : (digits.length === 12 && digits.startsWith('91') ? `+${digits}` : null);
                  if (!verifiedPhone && phone) {
                    const clientDigits = String(phone).replace(/\D/g, '');
                    if (clientDigits.length === 10) verifiedPhone = `+91${clientDigits}`;
                    else if (clientDigits.length === 12 && clientDigits.startsWith('91')) verifiedPhone = `+${clientDigits}`;
                  }

                  if (phone && verifiedPhone) {
                    const pDigits = String(phone).replace(/\D/g, '');
                    const normExpected = pDigits.length === 10 ? `+91${pDigits}` : (pDigits.length === 12 && pDigits.startsWith('91') ? `+${pDigits}` : null);
                    if (normExpected && normExpected !== verifiedPhone) {
                      res.statusCode = 403;
                      res.end(JSON.stringify({ success: false, message: 'Phone number mismatch. The verified token belongs to a different mobile number.', errorCode: 'PHONE_NUMBER_MISMATCH' }));
                      return;
                    }
                  }

                  res.statusCode = 200;
                  res.end(JSON.stringify({
                    success: true,
                    phone: verifiedPhone,
                    user: { id: 'CUST-' + (verifiedPhone ? verifiedPhone.slice(-4) : '0000'), phone: verifiedPhone, name: 'Customer', role: 'CUSTOMER' },
                    message: 'MSG91 Widget access token verified successfully.'
                  }));
                } catch (err) {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ success: false, message: 'Network error communicating with MSG91 verification service.', errorCode: 'NETWORK_ERROR' }));
                }
              });
              return;
            }
            next();
          });
        }
      }
    ],
    server: {
      watch: {
        ignored: ['**/public/images/**', '**/public/product_images/**']
      }
    }
  }
});

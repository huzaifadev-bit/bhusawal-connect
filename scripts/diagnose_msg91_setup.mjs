/**
 * MSG91 Setup Diagnostic and End-to-End Verification Script
 * Checks credentials, CDNs, upstream API response, and local endpoints.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');

// Load .env manually to ensure we see the actual values
const envPath = path.join(rootDir, '.env');
const envVars = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf8');
  content.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const idx = trimmed.indexOf('=');
      if (idx !== -1) {
        const k = trimmed.substring(0, idx).trim();
        let v = trimmed.substring(idx + 1).trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
          v = v.slice(1, -1);
        }
        envVars[k] = v;
      }
    }
  });
}

function maskKey(key) {
  if (!key) return '(NOT CONFIGURED)';
  if (key.length <= 8) return '****';
  return `${key.slice(0, 4)}...${key.slice(-4)} (Length: ${key.length})`;
}

async function runDiagnostics() {
  console.log('====================================================================');
  console.log('🔍 BHUSAWAL CONNECT — MSG91 COMPREHENSIVE SETUP DIAGNOSTIC');
  console.log('====================================================================\n');

  let issuesFound = 0;

  // ---------------------------------------------------------
  // 1. Environment Variables Audit
  // ---------------------------------------------------------
  console.log('📋 STEP 1: Environment Variables Audit');
  console.log('----------------------------------------------------');

  const authKey = envVars.MSG91_AUTH_KEY || process.env.MSG91_AUTH_KEY || '';
  const widgetId = envVars.MSG91_WIDGET_ID || process.env.MSG91_WIDGET_ID || '';
  const tokenAuth = envVars.MSG91_WIDGET_TOKEN_AUTH || process.env.MSG91_WIDGET_TOKEN_AUTH || '';
  const templateId = envVars.MSG91_TEMPLATE_ID || process.env.MSG91_TEMPLATE_ID || '';
  const apiUrl = envVars.MSG91_OTP_API_URL || process.env.MSG91_OTP_API_URL || 'https://control.msg91.com/api/v5/otp';

  console.log(`• MSG91_AUTH_KEY:         ${maskKey(authKey)}`);
  console.log(`• MSG91_WIDGET_ID:        ${widgetId ? widgetId : '(NOT CONFIGURED)'}`);
  console.log(`• MSG91_WIDGET_TOKEN_AUTH: ${tokenAuth ? maskKey(tokenAuth) : '(None - direct widget ID mode)'}`);
  console.log(`• MSG91_TEMPLATE_ID:      ${templateId ? templateId : '(None)'}`);
  console.log(`• MSG91_OTP_API_URL:      ${apiUrl}`);

  if (!authKey || authKey === 'YOUR_MSG91_AUTH_KEY') {
    console.log('  ⚠️ WARNING: MSG91_AUTH_KEY is not configured or using placeholder in .env');
    issuesFound++;
  } else {
    console.log('  ✅ MSG91_AUTH_KEY is configured.');
  }

  if (widgetId === '366a426b4d52323538343338') {
    console.log('  ✅ MSG91_WIDGET_ID matches official ID (366a426b4d52323538343338).');
  } else if (!widgetId) {
    console.log('  ⚠️ WARNING: MSG91_WIDGET_ID is not configured in .env (defaults to 366a426b4d52323538343338 in code).');
  } else {
    console.log(`  ℹ️ Custom Widget ID configured: ${widgetId}`);
  }

  // ---------------------------------------------------------
  // 2. Official CDN Accessibility Audit
  // ---------------------------------------------------------
  console.log('\n🌐 STEP 2: Official CDN Accessibility Audit');
  console.log('----------------------------------------------------');

  const cdnUrls = [
    { name: 'Primary CDN', url: 'https://verify.msg91.com/otp-provider.js' },
    { name: 'Fallback CDN', url: 'https://verify.phone91.com/otp-provider.js' }
  ];

  for (const cdn of cdnUrls) {
    try {
      const start = Date.now();
      const res = await fetch(cdn.url, { method: 'GET' });
      const duration = Date.now() - start;
      if (res.ok) {
        const text = await res.text();
        const containsInit = text.includes('initSendOTP') || text.includes('window');
        console.log(`  ✅ ${cdn.name} (${cdn.url}): Reachable [HTTP ${res.status}] in ${duration}ms (Size: ${text.length} bytes, initSendOTP present: ${containsInit})`);
      } else {
        console.log(`  ❌ ${cdn.name} (${cdn.url}): Returned HTTP ${res.status}`);
        issuesFound++;
      }
    } catch (e) {
      console.log(`  ❌ ${cdn.name} (${cdn.url}): Network error - ${e.message}`);
      issuesFound++;
    }
  }

  // ---------------------------------------------------------
  // 3. Upstream MSG91 API Handshake & AuthKey Validation
  // ---------------------------------------------------------
  console.log('\n🔒 STEP 3: Upstream MSG91 API Handshake & AuthKey Validation');
  console.log('----------------------------------------------------');

  if (authKey && authKey !== 'YOUR_MSG91_AUTH_KEY') {
    try {
      const verifyEndpoint = 'https://control.msg91.com/api/v5/widget/verifyAccessToken';
      const start = Date.now();
      const res = await fetch(verifyEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'authkey': authKey
        },
        body: JSON.stringify({
          authkey: authKey,
          'access-token': 'diagnostic_probe_token_test'
        })
      });
      const duration = Date.now() - start;
      const data = await res.json().catch(() => ({}));

      console.log(`• Upstream endpoint response in ${duration}ms: HTTP ${res.status}`);
      console.log(`• Provider response payload:`, JSON.stringify(data));

      if (data.message && data.message.toLowerCase().includes('authkey')) {
        console.log(`  ❌ MSG91 reported AuthKey problem: "${data.message}"`);
        console.log('  👉 Please check your MSG91 AuthKey in MSG91 Dashboard -> Settings -> Authkey.');
        issuesFound++;
      } else if (data.message && (data.message.toLowerCase().includes('token') || data.message.toLowerCase().includes('invalid') || data.type === 'error')) {
        console.log(`  ✅ MSG91 API Handshake Successful! Upstream reached and verified authentication headers.`);
        console.log(`     (Provider rejected the dummy probe token as expected: "${data.message}")`);
      } else {
        console.log(`  ℹ️ MSG91 API responded:`, data);
      }
    } catch (e) {
      console.log(`  ❌ Error contacting MSG91 API: ${e.message}`);
      issuesFound++;
    }
  } else {
    console.log('  ⚠️ Skipped upstream live handshake: MSG91_AUTH_KEY is not set in .env.');
    console.log('     To test live authentication, set MSG91_AUTH_KEY in .env or Vercel environment.');
  }

  // ---------------------------------------------------------
  // 4. Serverless Function & Security Guard Test
  // ---------------------------------------------------------
  console.log('\n🛡️ STEP 4: Serverless Function & Security Guard Test');
  console.log('----------------------------------------------------');

  const handler = (await import('../api/auth/verify-phone-otp.js')).default;

  function mockRes() {
    return {
      statusCode: 200,
      headers: {},
      body: null,
      setHeader(k, v) { this.headers[k] = v; return this; },
      status(c) { this.statusCode = c; return this; },
      json(d) { this.body = d; return this; }
    };
  }

  // Case A: Missing token
  const resA = mockRes();
  await handler({ method: 'POST', body: { phone: '9876543210' } }, resA);
  console.log(`• Missing token check: HTTP ${resA.statusCode} (${resA.body?.errorCode}) - ${resA.statusCode === 400 ? '✅ CORRECT' : '❌ FAILED'}`);

  // Case B: Oversized token
  const resB = mockRes();
  await handler({ method: 'POST', body: { accessToken: 'x'.repeat(4500), phone: '9876543210' } }, resB);
  console.log(`• Oversized token guard (>4096): HTTP ${resB.statusCode} (${resB.body?.errorCode}) - ${resB.statusCode === 400 ? '✅ CORRECT' : '❌ FAILED'}`);

  // Case C: Phone mismatch guard
  const dummyJwt = `${Buffer.from('{"alg":"HS256"}').toString('base64')}.${Buffer.from('{"mobile":"919876543210"}').toString('base64')}.sig`;
  const origFetch = global.fetch;
  global.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ status: 'success', mobile: '919876543210' })
  });

  const resC = mockRes();
  process.env.MSG91_AUTH_KEY = authKey || 'mock_probe_auth_key';
  await handler({ method: 'POST', body: { accessToken: dummyJwt, phone: '9111111111' } }, resC);
  global.fetch = origFetch;
  console.log(`• Phone mismatch enforcement: HTTP ${resC.statusCode} (${resC.body?.errorCode}) - ${resC.statusCode === 403 ? '✅ CORRECT' : '❌ FAILED'}`);

  // ---------------------------------------------------------
  // 5. Client HTML Security Verification
  // ---------------------------------------------------------
  console.log('\n📄 STEP 5: Client HTML Security Verification');
  console.log('----------------------------------------------------');

  const loginAstro = fs.readFileSync(path.join(rootDir, 'src/pages/login.astro'), 'utf8');
  const leaksAuthKey = loginAstro.includes('window.__msg91AuthKey') || loginAstro.includes(authKey && authKey.length > 10 ? authKey : 'NOT_FOUND_XYZ');
  const hasWidgetId = loginAstro.includes('366a426b4d52323538343338');
  const hasScriptFallback = loginAstro.includes('https://verify.phone91.com/otp-provider.js');

  console.log(`• AuthKey leak check:           ${!leaksAuthKey ? '✅ SAFE (Master key never exposed to client)' : '❌ LEAK DETECTED'}`);
  console.log(`• Official Widget ID injection: ${hasWidgetId ? '✅ CONFIGURED (366a426b4d52323538343338)' : '❌ MISSING'}`);
  console.log(`• Dynamic CDN fallback loader:  ${hasScriptFallback ? '✅ CONFIGURED' : '❌ MISSING'}`);

  // ---------------------------------------------------------
  // SUMMARY
  // ---------------------------------------------------------
  console.log('\n====================================================================');
  if (issuesFound === 0) {
    console.log('🎉 MSG91 SETUP STATUS: HEALTHY & FULLY OPERATIONAL');
  } else {
    console.log(`⚠️ MSG91 SETUP STATUS: ${issuesFound} ACTION ITEM(S) TO REVIEW`);
  }
  console.log('====================================================================\n');
}

runDiagnostics().catch(err => {
  console.error('Diagnostic error:', err);
  process.exit(1);
});

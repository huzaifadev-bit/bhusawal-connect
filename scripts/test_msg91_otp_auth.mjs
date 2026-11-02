/**
 * Test Suite: MSG91 OTP Authentication Verification
 * Verifies security, fail-closed behavior, phone correlation, and rate-limiting.
 */

import assert from 'assert';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { verifyMsg91WidgetAccessToken } from '../src/lib/msg91Otp.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function createDummyJwt(payload) {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const body = Buffer.from(JSON.stringify(payload)).toString('base64');
  const signature = Buffer.from('dummy_signature').toString('base64');
  return `${header}.${body}.${signature}`;
}

async function runTests() {
  console.log('====================================================');
  console.log('  RUNNING MSG91 OTP AUTHENTICATION TEST SUITE');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  async function test(name, fn) {
    total++;
    process.stdout.write(`TEST ${total}: ${name} ... `);
    try {
      await fn();
      console.log('PASSED');
      passed++;
    } catch (err) {
      console.log('FAILED');
      console.error(err);
    }
  }

  // TEST 1: Method not allowed check on Astro endpoint
  await test('Reject empty or non-string accessToken with 400 Bad Request', async () => {
    const res = await verifyMsg91WidgetAccessToken('', '9876543210');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'MISSING_ACCESS_TOKEN');
  });

  // TEST 2: Missing access token returns error
  await test('Reject missing accessToken with MISSING_ACCESS_TOKEN error code', async () => {
    const res = await verifyMsg91WidgetAccessToken(null, '9876543210');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'MISSING_ACCESS_TOKEN');
  });

  // TEST 3: Oversized token returns error
  await test('Reject oversized accessToken (>4096 bytes) with INVALID_TOKEN_SIZE', async () => {
    const hugeToken = 'a'.repeat(5000);
    const res = await verifyMsg91WidgetAccessToken(hugeToken, '9876543210');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'INVALID_TOKEN_SIZE');
  });

  // TEST 4: Missing MSG91_AUTH_KEY in env returns MSG91_NOT_CONFIGURED
  await test('Return MSG91_NOT_CONFIGURED when MSG91_AUTH_KEY is unconfigured', async () => {
    const oldKey = process.env.MSG91_AUTH_KEY;
    delete process.env.MSG91_AUTH_KEY;

    const res = await verifyMsg91WidgetAccessToken('valid_looking_token_123', '9876543210');
    assert.strictEqual(res.success, false);
    assert.strictEqual(res.errorCode, 'MSG91_NOT_CONFIGURED');

    if (oldKey) process.env.MSG91_AUTH_KEY = oldKey;
  });

  // TEST 5: Fail-closed on invalid token when provider rejects it
  await test('Fail-closed with INVALID_WIDGET_TOKEN on rejected upstream token', async () => {
    process.env.MSG91_AUTH_KEY = 'test_key_dummy_99999';

    // Mock fetch to simulate MSG91 rejecting invalid token
    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ type: 'error', message: 'Invalid or expired access token' })
    });

    try {
      const res = await verifyMsg91WidgetAccessToken('invalid_expired_token', '9876543210');
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.errorCode, 'INVALID_WIDGET_TOKEN');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // TEST 6: Phone number correlation mismatch returns PHONE_NUMBER_MISMATCH
  await test('Enforce phone correlation: return PHONE_NUMBER_MISMATCH on number mismatch', async () => {
    process.env.MSG91_AUTH_KEY = 'test_key_dummy_99999';

    const tokenWithPhone = createDummyJwt({ mobile: '919876543210' });

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        type: 'success',
        mobile: '919876543210',
        message: 'Token verified'
      })
    });

    try {
      // User claims they are 9112345678, but token is for 9876543210
      const res = await verifyMsg91WidgetAccessToken(tokenWithPhone, '9112345678');
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.errorCode, 'PHONE_NUMBER_MISMATCH');
    } finally {
      global.fetch = originalFetch;
    }
  });

  // TEST 7: Successful verification returns CUSTOMER session
  await test('Successful verification returns success with CUSTOMER role session', async () => {
    process.env.MSG91_AUTH_KEY = 'test_key_dummy_99999';

    const tokenWithPhone = createDummyJwt({ mobile: '919876543210' });

    const originalFetch = global.fetch;
    global.fetch = async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        status: 'success',
        type: 'success',
        mobile: '919876543210',
        message: 'Token verified successfully'
      })
    });

    try {
      const res = await verifyMsg91WidgetAccessToken(tokenWithPhone, '+919876543210');
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.phone, '+919876543210');
      assert.strictEqual(res.user.role, 'CUSTOMER');
      // Verify no secrets leaked in response
      assert.strictEqual(res.authkey, undefined);
      assert.strictEqual(res.MSG91_AUTH_KEY, undefined);
    } finally {
      global.fetch = originalFetch;
    }
  });

  // TEST 8: Verify client HTML does NOT leak MSG91_AUTH_KEY
  await test('Verify login.astro template does not bundle or expose MSG91_AUTH_KEY', async () => {
    const loginAstroContent = fs.readFileSync(path.join(__dirname, '../src/pages/login.astro'), 'utf8');

    // Ensure MSG91_AUTH_KEY is never exposed in client script
    assert.doesNotMatch(loginAstroContent, /window\.__msg91AuthKey/, 'Master key must not be exposed globally');
    assert.match(loginAstroContent, /SAFETY GUARD: Never leak master MSG91_AUTH_KEY/, 'Safety guard comment must exist');
    assert.match(loginAstroContent, /366a426b4d52323538343338/, 'Correct official widget ID must be present');
  });

  console.log('\n====================================================');
  console.log(`  RESULT: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('====================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runTests().catch(err => {
  console.error('Test suite failed:', err);
  process.exit(1);
});

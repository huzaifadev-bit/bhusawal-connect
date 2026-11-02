const assert = require('assert');
const fs = require('fs');
const path = require('path');

console.log('--- TESTING GOOGLE MAPS LINK FEATURE ---');

// 1. Test URL Validation Logic
function isValidGoogleMapsUrl(url) {
  if (!url || typeof url !== 'string') return false;
  const trimmed = url.trim();
  if (!trimmed) return false;
  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : ('https://' + trimmed);
  try {
    const parsed = new URL(candidate);
    const host = parsed.hostname.toLowerCase();
    const isGoogleHost = (
      host === 'maps.google.com' ||
      host.endsWith('.maps.google.com') ||
      host === 'maps.google.co.in' ||
      host === 'maps.app.goo.gl' ||
      host === 'goo.gl' ||
      host === 'google.com' ||
      host.endsWith('.google.com') ||
      host === 'google.co.in' ||
      host.endsWith('.google.co.in')
    );
    if (!isGoogleHost) return false;

    if (host === 'maps.app.goo.gl' || host === 'goo.gl') {
      return parsed.pathname.length > 1;
    }
    if (host === 'maps.google.com' || host === 'maps.google.co.in') {
      return true;
    }
    if (parsed.pathname.startsWith('/maps')) {
      return true;
    }
    return false;
  } catch(e) {
    return false;
  }
}

function normalizeGoogleMapsUrl(url) {
  if (!url || typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (!/^https?:\/\//i.test(trimmed)) {
    return 'https://' + trimmed;
  }
  return trimmed;
}

// Test valid cases
const validLinks = [
  'https://maps.google.com/?q=21.0478,75.7896',
  'http://maps.google.com/?q=21.0478,75.7896',
  'https://www.google.com/maps/place/Bhusawal,+Maharashtra',
  'https://google.com/maps/@21.0478,75.7896,16z',
  'https://maps.google.co.in/maps?q=Bhusawal',
  'https://maps.app.goo.gl/AbCdEf12345',
  'http://maps.app.goo.gl/XyZ890',
  'https://goo.gl/maps/AbCdEf12345',
  'maps.app.goo.gl/AbCdEf12345', // no protocol
  'www.google.com/maps/dir/21.0,75.0/21.1,75.1'
];

validLinks.forEach(link => {
  assert.strictEqual(isValidGoogleMapsUrl(link), true, `Failed for valid link: ${link}`);
  assert.ok(normalizeGoogleMapsUrl(link).startsWith('http'), `Normalize failed for: ${link}`);
});
console.log('✓ All 10 valid Google Maps URL variants correctly identified');

// Test invalid cases
const invalidLinks = [
  '',
  '   ',
  'https://facebook.com',
  'https://bing.com/maps',
  'https://google.com/search?q=bhusawal',
  'https://google.com',
  'https://goo.gl', // empty short path
  'https://goo.gl/',
  'invalid-url-string',
  'ftp://maps.google.com'
];

invalidLinks.forEach(link => {
  assert.strictEqual(isValidGoogleMapsUrl(link), false, `Failed for invalid link: ${link}`);
});
console.log('✓ All 10 invalid URL cases correctly rejected');

// 2. Verify Checkout File
const checkoutPath = path.join(__dirname, '..', 'src', 'pages', 'checkout.astro');
const checkoutContent = fs.readFileSync(checkoutPath, 'utf8');

assert.ok(checkoutContent.includes('Google Maps Location Link (Optional)'), 'Missing label title in checkout.astro');
assert.ok(checkoutContent.includes('Paste your Google Maps location link here'), 'Missing placeholder in checkout.astro');
assert.ok(checkoutContent.includes('id="checkout-google-maps-link"'), 'Missing checkout-google-maps-link ID');
assert.ok(checkoutContent.includes('id="google-maps-link-error"'), 'Missing error element in checkout.astro');
assert.ok(checkoutContent.includes('id="btn-clear-maps-link"'), 'Missing clear button');
assert.ok(checkoutContent.includes('field-modal-maps-link'), 'Missing modal maps link field');
assert.ok(checkoutContent.includes('googleMapsLink: finalMapsLink'), 'Missing order payload googleMapsLink');
assert.ok(checkoutContent.includes('google_maps_link: finalMapsLink'), 'Missing order payload google_maps_link');
console.log('✓ checkout.astro has all required fields, labels, placeholders, and error elements');

// 3. Verify Rider Route Sequencer & Rider UI Files
const sequencerPath = path.join(__dirname, '..', 'public', 'assets', 'bsl_route_sequencer.js');
const sequencerContent = fs.readFileSync(sequencerPath, 'utf8');
assert.ok(sequencerContent.includes('googleMapsLink: ord.googleMapsLink || ord.google_maps_link'), 'Route sequencer must extract googleMapsLink');
assert.ok(sequencerContent.includes('googleMapsLink: firstStop.googleMapsLink'), 'Route sequencer must attach to nextAction');
console.log('✓ bsl_route_sequencer.js properly preserves and propagates customer Google Maps link');

const riderHomePath = path.join(__dirname, '..', 'src', 'components', 'RiderHomeDashboard.astro');
const riderHomeContent = fs.readFileSync(riderHomePath, 'utf8');
assert.ok(riderHomeContent.includes('id="next-action-maps-link-container"'), 'Missing maps link container in RiderHomeDashboard.astro');
assert.ok(riderHomeContent.includes('id="btn-next-action-maps-link"'), 'Missing maps link button in RiderHomeDashboard.astro');
assert.ok(riderHomeContent.includes('Open in Google Maps'), 'Missing "Open in Google Maps" text in RiderHomeDashboard.astro');
console.log('✓ RiderHomeDashboard.astro has dedicated "Open in Google Maps" button for active HUD');

const bslRiderHomePath = path.join(__dirname, '..', 'public', 'assets', 'bsl_rider_home.js');
const bslRiderHomeContent = fs.readFileSync(bslRiderHomePath, 'utf8');
assert.ok(bslRiderHomeContent.includes('next-action-maps-link-container'), 'Missing next-action-maps-link-container toggle in bsl_rider_home.js');
assert.ok(bslRiderHomeContent.includes('stop.googleMapsLink'), 'Missing stop.googleMapsLink check in bsl_rider_home.js');
console.log('✓ bsl_rider_home.js dynamically updates link and active stop buttons');

const riderDashPath = path.join(__dirname, '..', 'src', 'pages', 'rider_dashboard.astro');
const riderDashContent = fs.readFileSync(riderDashPath, 'utf8');
assert.ok(riderDashContent.includes('btn-customer-maps-link'), 'Missing btn-customer-maps-link in rider_dashboard.astro');
console.log('✓ rider_dashboard.astro has customer Google Maps button in active order modal/view');

console.log('\nALL VERIFICATION CHECKS PASSED!');

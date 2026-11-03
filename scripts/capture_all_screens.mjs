import puppeteer from 'puppeteer-core';
import path from 'node:path';

const CHROME_PATH = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const ARTIFACT_DIR = 'C:\\Users\\sahil\\.gemini\\antigravity\\brain\\0c4ff04a-19ad-4a43-ad7a-e1ad1d9ddb11';

async function run() {
  console.log('Launching Chrome via puppeteer-core...');
  const browser = await puppeteer.launch({
    executablePath: CHROME_PATH,
    headless: 'new',
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu']
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 412, height: 915, isMobile: true, hasTouch: true });

  const TARGET_URL = 'https://bhusawal-connect.vercel.app/rider';
  console.log('Navigating to', TARGET_URL);
  await page.goto(TARGET_URL, { waitUntil: 'networkidle2', timeout: 30000 });

  // Wait for map and dashboard to boot
  await page.waitForSelector('#view-dashboard', { timeout: 10000 });
  await new Promise(r => setTimeout(r, 2000));

  // 1. HOME SCREEN
  console.log('Capturing: rider_screen_home.png');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rider_screen_home.png'), fullPage: false });

  // 2. ORDER REQUEST MODAL (GROCERY / MEDICINE / PASSENGER)
  console.log('Triggering Order Request Modal...');
  await page.evaluate(() => {
    if (window.BslOrderRequestEngine) {
      window.BslOrderRequestEngine.simulateOrderRequest('MEDICINE');
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Capturing: rider_screen_order_request.png');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rider_screen_order_request.png'), fullPage: false });

  // Decline modal
  await page.evaluate(() => {
    const btn = document.getElementById('btn-order-request-decline');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 500));

  // 3. PASSENGER EXCLUSIVE MODE SCREEN
  console.log('Triggering Passenger Mode...');
  await page.evaluate(() => {
    const st = {
      isLoggedIn: true,
      phone: '9876543210',
      fullName: 'Rahul Ramesh Patil',
      isOnline: true,
      state: 'PASSENGER_PICKUP',
      isPassengerLocked: true,
      activeOrderId: 'ORD-PASSENGER-501',
      activeOrders: [{
        id: 'ORD-PASSENGER-501',
        type: 'PASSENGER',
        serviceType: 'PASSENGER',
        status: 'GOING_TO_PICKUP',
        passengerName: 'Pooja Kulkarni',
        passengerPhone: '9876543210',
        pickupAddress: 'Bhusawal Railway Station (Platform 1)',
        dropAddress: 'Khadaka Road Residential Enclave',
        fare: 65
      }],
      todayEarnings: 749,
      todayOrdersCount: 7,
      walletBalance: 1305
    };
    if (window.BslRiderHome) {
      localStorage.setItem('bhusawal_rider_auth', JSON.stringify(st));
      window.BslRiderHome.renderHomeView(st);
    }
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Capturing: rider_screen_passenger_exclusive.png');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rider_screen_passenger_exclusive.png'), fullPage: false });

  // Reset to Available
  await page.evaluate(() => {
    const st = {
      isLoggedIn: true,
      phone: '9876543210',
      fullName: 'Rahul Ramesh Patil',
      isOnline: true,
      state: 'AVAILABLE',
      isPassengerLocked: false,
      activeOrders: [],
      todayEarnings: 684,
      todayOrdersCount: 6,
      walletBalance: 1240
    };
    if (window.BslRiderHome) {
      localStorage.setItem('bhusawal_rider_auth', JSON.stringify(st));
      window.BslRiderHome.renderHomeView(st);
    }
  });
  await new Promise(r => setTimeout(r, 500));

  // 4. ORDERS TAB
  console.log('Navigating to Orders tab...');
  await page.evaluate(() => {
    const btn = document.querySelector('.nav-tab-btn[data-tab="orders"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Capturing: rider_screen_orders_tab.png');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rider_screen_orders_tab.png'), fullPage: false });

  // 5. EARNINGS TAB
  console.log('Navigating to Earnings tab...');
  await page.evaluate(() => {
    const btn = document.querySelector('.nav-tab-btn[data-tab="earnings"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Capturing: rider_screen_earnings_tab.png');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rider_screen_earnings_tab.png'), fullPage: false });

  // 6. PROFILE TAB
  console.log('Navigating to Profile tab...');
  await page.evaluate(() => {
    const btn = document.querySelector('.nav-tab-btn[data-tab="profile"]');
    if (btn) btn.click();
  });
  await new Promise(r => setTimeout(r, 1000));
  console.log('Capturing: rider_screen_profile_tab.png');
  await page.screenshot({ path: path.join(ARTIFACT_DIR, 'rider_screen_profile_tab.png'), fullPage: false });

  await browser.close();
  console.log('All screenshots captured successfully!');
}

run().catch(err => {
  console.error('Screenshot capture failed:', err);
  process.exit(1);
});

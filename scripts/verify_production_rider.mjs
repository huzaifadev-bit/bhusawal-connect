import https from 'node:https';

function fetchUrl(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          body
        });
      });
    });
    req.on('error', reject);
    if (options.body) {
      req.write(typeof options.body === 'string' ? options.body : JSON.stringify(options.body));
    }
    req.end();
  });
}

async function run() {
  console.log('--- 1. Testing GET /rider ---');
  const riderPage = await fetchUrl('https://bhusawal-connect.vercel.app/rider');
  console.log('Status:', riderPage.statusCode);
  console.log('x-vercel-id:', riderPage.headers['x-vercel-id']);
  console.log('etag:', riderPage.headers['etag']);
  console.log('HTML Length:', riderPage.body.length);
  console.log('Contains view-dashboard:', riderPage.body.includes('view-dashboard'));
  console.log('Contains leaflet:', riderPage.body.includes('leaflet'));
  console.log('Contains bsl_rider_home.js:', riderPage.body.includes('bsl_rider_home.js'));
  console.log('Contains RiderHomeDashboard title:', riderPage.body.includes('Delivery Partner & Captain App'));

  console.log('\n--- 2. Testing GET /rider_dashboard ---');
  const dashPage = await fetchUrl('https://bhusawal-connect.vercel.app/rider_dashboard');
  console.log('Status:', dashPage.statusCode);
  console.log('HTML Length:', dashPage.body.length);
  console.log('Contains view-dashboard:', dashPage.body.includes('view-dashboard'));
  console.log('Contains leaflet:', dashPage.body.includes('leaflet'));

  console.log('\n--- 3. Testing GET /api/rider/status ---');
  const statusRes = await fetchUrl('https://bhusawal-connect.vercel.app/api/rider/status?riderId=BSL-RIDER-8942');
  console.log('Status:', statusRes.statusCode);
  console.log('Body:', statusRes.body);

  console.log('\n--- 4. Testing GET /api/rider/orders ---');
  const ordersRes = await fetchUrl('https://bhusawal-connect.vercel.app/api/rider/orders?riderId=BSL-RIDER-8942');
  console.log('Status:', ordersRes.statusCode);
  console.log('Body:', ordersRes.body);

  console.log('\n--- 5. Testing GET /api/rider/earnings ---');
  const earningsRes = await fetchUrl('https://bhusawal-connect.vercel.app/api/rider/earnings?riderId=BSL-RIDER-8942');
  console.log('Status:', earningsRes.statusCode);
  console.log('Body:', earningsRes.body);
}

run().catch(console.error);

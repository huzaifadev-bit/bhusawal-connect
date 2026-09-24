// scripts/deploy_git_push.cjs
const fs = require('fs');
const path = require('path');
const git = require('isomorphic-git');
const http = require('isomorphic-git/http/node');

const dir = process.cwd();

async function pushUpdates() {
  console.log('=== PUSHING UPDATES TO GITHUB REPOSITORY ===');

  const gitConfig = fs.readFileSync(path.join(dir, '.git/config'), 'utf8');
  const tokenMatch = gitConfig.match(/https:\/\/([^@]+)@github\.com/);
  const token = tokenMatch ? tokenMatch[1] : '';

  console.log('Found remote auth token:', token ? 'YES (configured)' : 'NO');

  const filesToStage = [
    'src/pages/customer.astro',
    'src/pages/login.astro',
    'bhusawal_connect_master_product_catalog.xlsx',
    'bhusawal_connect_master_product_catalog.csv',
    'bhusawal_connect_catalog_summary.json',
    'public/bhusawal_connect_master_product_catalog.xlsx',
    'public/bhusawal_connect_master_product_catalog.csv',
    'package.json',
    'package-lock.json',
    'scripts/build_master_catalog_excel.cjs',
    'scripts/build_bulletproof_catalogs.cjs',
    'scripts/validate_master_catalog_excel.cjs'
  ];

  for (const f of filesToStage) {
    if (fs.existsSync(path.join(dir, f))) {
      await git.add({ fs, dir, filepath: f });
      console.log('Staged:', f);
    }
  }

  // Push to origin/main with force
  const pushResult = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    force: true,
    onAuth: () => ({ username: token })
  });

  console.log('Push Result:', JSON.stringify(pushResult, null, 2));
  console.log('=== PUSH SUCCESSFUL! VERCEL DEPLOYMENT TRIGGERED ===');
}

pushUpdates().catch(err => {
  console.error('Git Push Error:', err);
  process.exit(1);
});

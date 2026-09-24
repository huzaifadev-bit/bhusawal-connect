// scripts/push_via_github_api.cjs
const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();

async function pushToGitHub() {
  console.log('=== CREATING ATOMIC COMMIT VIA GITHUB API ===');

  const gitConfig = fs.readFileSync(path.join(ROOT_DIR, '.git/config'), 'utf8');
  const tokenMatch = gitConfig.match(/https:\/\/([^@]+)@github\.com/);
  const token = tokenMatch ? tokenMatch[1] : '';

  const owner = 'huzaifadev-bit';
  const repo = 'bhusawal-connect';
  const branch = 'main';

  const headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Bhusawal-Connect-Auto-Deployer'
  };

  // 1. Get latest commit on main
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  const refData = await refRes.json();
  const latestCommitSha = refData.object.sha;
  console.log('Latest Commit SHA on main:', latestCommitSha);

  // 2. Get base tree
  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;
  console.log('Base Tree SHA:', baseTreeSha);

  // 3. Create blobs for each file
  const files = [
    { path: 'src/pages/customer.astro', encoding: 'utf-8', isBinary: false },
    { path: 'src/pages/login.astro', encoding: 'utf-8', isBinary: false },
    { path: 'package.json', encoding: 'utf-8', isBinary: false },
    { path: 'bhusawal_connect_catalog_summary.json', encoding: 'utf-8', isBinary: false },
    { path: 'public/bhusawal_connect_master_product_catalog.csv', encoding: 'utf-8', isBinary: false },
    { path: 'public/bhusawal_connect_master_product_catalog.xlsx', encoding: 'base64', isBinary: true }
  ];

  const treeEntries = [];

  for (const f of files) {
    const fullPath = path.join(ROOT_DIR, f.path);
    if (!fs.existsSync(fullPath)) {
      console.warn('File does not exist:', fullPath);
      continue;
    }

    const content = f.isBinary ? fs.readFileSync(fullPath).toString('base64') : fs.readFileSync(fullPath, 'utf8');
    const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        content,
        encoding: f.isBinary ? 'base64' : 'utf-8'
      })
    });
    const blobData = await blobRes.json();
    console.log(`Created blob for ${f.path}: ${blobData.sha}`);

    treeEntries.push({
      path: f.path.replace(/\\/g, '/'),
      mode: '100644',
      type: 'blob',
      sha: blobData.sha
    });
  }

  // 4. Create new tree
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries
    })
  });
  const treeData = await treeRes.json();
  console.log('Created New Tree SHA:', treeData.sha);

  // 5. Create new commit
  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: 'feat: add customer hub, master product catalog export, and otp verification pipeline',
      tree: treeData.sha,
      parents: [latestCommitSha],
      author: {
        name: 'Huzaifa Shaikh',
        email: 'huzaifashaikh9923@gmail.com',
        date: new Date().toISOString()
      }
    })
  });
  const newCommitData = await newCommitRes.json();
  console.log('Created New Commit SHA:', newCommitData.sha);

  // 6. Update branch ref
  const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitData.sha,
      force: false
    })
  });
  const updateRefData = await updateRefRes.json();
  console.log('Updated Ref:', updateRefData.ref, '->', updateRefData.object?.sha);

  console.log('\n=== SUCCESS: GITHUB REPOSITORY UPDATED! VERCEL BUILD IN PROGRESS ===');
}

pushToGitHub().catch(err => {
  console.error('Fatal Push Error:', err);
  process.exit(1);
});

// scripts/sync_all_to_github.cjs
const fs = require('fs');
const path = require('path');

const ROOT_DIR = process.cwd();

// Directories to skip entirely
const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  '.astro',
  '.vercel',
  '.jobs',
  '.colab_cache',
  '.image_cache'
]);

// Files to skip (secrets, huge archives)
const IGNORE_FILES = new Set([
  '.env',
  'bhusawal_connect_full_project.zip'
]);

function getAllFiles(dirPath, arrayOfFiles = []) {
  if (!fs.existsSync(dirPath)) return arrayOfFiles;
  const files = fs.readdirSync(dirPath);

  files.forEach(file => {
    const fullPath = path.join(dirPath, file);
    if (IGNORE_FILES.has(file) || file.endsWith('.zip')) return;

    if (fs.statSync(fullPath).isDirectory()) {
      if (!IGNORE_DIRS.has(file)) {
        getAllFiles(fullPath, arrayOfFiles);
      }
    } else {
      const relPath = path.relative(ROOT_DIR, fullPath).replace(/\\/g, '/');
      arrayOfFiles.push(relPath);
    }
  });

  return arrayOfFiles;
}

async function syncAll() {
  console.log('====================================================================');
  console.log('🚀 BHUSAWAL CONNECT — COMPLETE GITHUB SYNCHRONIZATION');
  console.log('====================================================================\n');

  const gitConfig = fs.readFileSync(path.join(ROOT_DIR, '.git/config'), 'utf8');
  const tokenMatch = gitConfig.match(/https:\/\/([^@]+)@github\.com/);
  const token = tokenMatch ? tokenMatch[1] : '';

  if (!token) {
    throw new Error('GitHub token not found in .git/config');
  }

  const owner = 'huzaifadev-bit';
  const repo = 'bhusawal-connect';
  const branch = 'main';

  const headers = {
    'Authorization': 'token ' + token,
    'Accept': 'application/vnd.github.v3+json',
    'User-Agent': 'Bhusawal-Connect-Full-Sync'
  };

  // 1. Get latest commit on main
  console.log('[Step 1] Fetching latest commit on main branch...');
  const refRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${branch}`, { headers });
  const refData = await refRes.json();
  if (!refData.object) {
    throw new Error(`Failed to fetch ref: ${JSON.stringify(refData)}`);
  }
  const latestCommitSha = refData.object.sha;
  console.log('         Latest Commit SHA:', latestCommitSha);

  // 2. Get base tree
  const commitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits/${latestCommitSha}`, { headers });
  const commitData = await commitRes.json();
  const baseTreeSha = commitData.tree.sha;
  console.log('         Base Tree SHA:    ', baseTreeSha);

  // 3. Collect all project files
  console.log('\n[Step 2] Scanning all project directories and files...');
  const targetDirs = ['src', 'public', 'scripts', 'colab', 'supabase', 'catalogs_csv', 'backups'];
  let allFiles = [];
  targetDirs.forEach(dir => {
    allFiles = allFiles.concat(getAllFiles(path.join(ROOT_DIR, dir)));
  });

  // Root files
  const rootFiles = fs.readdirSync(ROOT_DIR).filter(f => {
    const full = path.join(ROOT_DIR, f);
    return !fs.statSync(full).isDirectory() &&
           !IGNORE_FILES.has(f) &&
           !f.endsWith('.zip') &&
           !f.startsWith('.env.');
  });
  allFiles = allFiles.concat(rootFiles);

  // Deduplicate
  allFiles = Array.from(new Set(allFiles));
  console.log(`         Total files to synchronize: ${allFiles.length}`);

  // 4. Create Git Blobs with batching
  console.log('\n[Step 3] Uploading file blobs to GitHub...');
  const treeEntries = [];
  const CONCURRENCY = 8;

  for (let i = 0; i < allFiles.length; i += CONCURRENCY) {
    const chunk = allFiles.slice(i, i + CONCURRENCY);
    const promises = chunk.map(async (relPath) => {
      const fullPath = path.join(ROOT_DIR, relPath);
      if (!fs.existsSync(fullPath)) return null;

      const stat = fs.statSync(fullPath);
      // Skip files larger than 40MB
      if (stat.size > 40 * 1024 * 1024) {
        console.log(`         ⚠️ Skipping large file (>40MB): ${relPath}`);
        return null;
      }

      const isBinary = relPath.endsWith('.xlsx') || relPath.endsWith('.png') || relPath.endsWith('.jpg') ||
                       relPath.endsWith('.jpeg') || relPath.endsWith('.pdf') || relPath.endsWith('.webp') ||
                       relPath.endsWith('.ico') || relPath.endsWith('.woff') || relPath.endsWith('.woff2');

      const content = isBinary ? fs.readFileSync(fullPath).toString('base64') : fs.readFileSync(fullPath, 'utf8');

      try {
        const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            content,
            encoding: isBinary ? 'base64' : 'utf-8'
          })
        });
        const blobData = await blobRes.json();
        if (blobData.sha) {
          return {
            path: relPath,
            mode: '100644',
            type: 'blob',
            sha: blobData.sha
          };
        }
      } catch (err) {
        console.warn(`         ⚠️ Blob error for ${relPath}: ${err.message}`);
      }
      return null;
    });

    const results = await Promise.all(promises);
    results.forEach(r => { if (r) treeEntries.push(r); });

    const pct = Math.round(((i + chunk.length) / allFiles.length) * 100);
    if (i % 32 === 0 || i + chunk.length >= allFiles.length) {
      console.log(`         [${pct}%] Uploaded ${treeEntries.length}/${allFiles.length} blobs...`);
    }
  }

  // 5. Create new Git Tree
  console.log(`\n[Step 4] Creating Git tree with ${treeEntries.length} entries...`);
  const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      base_tree: baseTreeSha,
      tree: treeEntries
    })
  });
  const treeData = await treeRes.json();
  if (!treeData.sha) {
    throw new Error(`Tree creation failed: ${JSON.stringify(treeData)}`);
  }
  console.log('         Tree SHA:', treeData.sha);

  // 6. Create Commit
  console.log('\n[Step 5] Creating commit on main branch...');
  const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      message: 'feat: full project update — Google Colab worker, product catalog verification, and UI updates',
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
  if (!newCommitData.sha) {
    throw new Error(`Commit creation failed: ${JSON.stringify(newCommitData)}`);
  }
  console.log('         Commit SHA:', newCommitData.sha);

  // 7. Update branch ref
  console.log('\n[Step 6] Updating main branch head reference...');
  const updateRefRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    headers,
    body: JSON.stringify({
      sha: newCommitData.sha,
      force: true
    })
  });
  const updateRefData = await updateRefRes.json();
  console.log('         Branch updated:', updateRefData.ref, '->', updateRefData.object?.sha);

  console.log('\n====================================================================');
  console.log('🎉 ALL PROJECT UPDATES SUCCESSFULLY PUSHED TO GITHUB (main)!');
  console.log('====================================================================\n');
}

syncAll().catch(err => {
  console.error('Fatal Sync Error:', err);
  process.exit(1);
});

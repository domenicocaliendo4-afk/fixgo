// FixGo — Express + React SPA on Render
const express = require('express');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

if (!process.env.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3000;
const clientDist = path.join(__dirname, 'client', 'dist');
const vendorDir  = path.join(clientDist, 'vendor');
const publicDir  = path.join(__dirname, 'public');

// Ensure Leaflet vendor files exist by copying from node_modules at startup.
// React/Router are bundled inside app.bundle.js, so no other vendor files are needed.
async function ensureVendorFiles() {
  fs.mkdirSync(vendorDir, { recursive: true });

  const files = [
    {
      src: path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.js'),
      dest: path.join(vendorDir, 'leaflet.js'),
    },
    {
      src: path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.css'),
      dest: path.join(vendorDir, 'leaflet.css'),
    },
  ];

  await Promise.all(files.map(({ src, dest }) =>
    new Promise((resolve) => {
      if (fs.existsSync(dest) && fs.statSync(dest).size > 1000) {
        console.log(`[startup] ${path.basename(dest)} already present (${fs.statSync(dest).size}b)`);
        return resolve();
      }
      if (!fs.existsSync(src)) {
        console.error(`[startup] missing: ${src}`);
        return resolve();
      }
      fs.copyFileSync(src, dest);
      console.log(`[startup] copied ${path.basename(dest)} (${fs.statSync(dest).size}b)`);
      resolve();
    })
  ));
}

async function ensureBundle() {
  const bundlePath = path.join(vendorDir, 'app.bundle.js');
  const size = fs.existsSync(bundlePath) ? fs.statSync(bundlePath).size : 0;
  if (size > 100000) {
    console.log(`[startup] app.bundle.js present (${size}b)`);
    return;
  }
  console.log(`[startup] app.bundle.js missing or too small (${size}b) — rebuilding...`);
  try {
    const esbuild = require('esbuild');
    await esbuild.build({
      entryPoints: [path.join(__dirname, 'src', 'app.jsx')],
      bundle: true,
      minify: true,
      outfile: bundlePath,
      format: 'iife',
      loader: { '.jsx': 'jsx', '.js': 'jsx' },
      define: { 'process.env.NODE_ENV': '"production"' },
    });
    console.log(`[startup] bundle rebuilt (${fs.statSync(bundlePath).size}b)`);
  } catch (e) {
    console.error('[startup] bundle rebuild failed:', e.message);
  }
}

app.use(express.json());
app.use(cors());

app.get('/health', (_req, res) => res.json({ status: 'healthy' }));
app.use(express.static(publicDir));
app.use('/vendor', express.static(vendorDir));

app.use('/api/auth',         require('./routes/auth'));
app.use('/api/leads',        require('./routes/lead-capture'));
app.use('/api',              require('./routes/api'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/pro',          require('./routes/pro'));
app.use('/api/reviews',      require('./routes/reviews'));
app.use('/api/verification', require('./routes/verification'));
app.use('/api/push',         require('./routes/push'));
app.use('/api/analytics',    require('./routes/analytics'));

app.get('/landing', (_req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'landing.html'));
});

// SPA: rewrite CDN script tags to local /vendor/ paths, then serve index.html.
app.get('*', (req, res) => {
  // Never answer asset requests with HTML — return proper 404 instead.
  if (/\.(js|css|map|png|jpg|jpeg|svg|ico|webp|json|txt)$/i.test(req.path)) {
    return res.status(404).end();
  }
  const indexPath = path.join(clientDist, 'index.html');
  let html = fs.readFileSync(indexPath, 'utf8');

  html = html.replace(
    /<script[^>]+src="https:\/\/unpkg.com\/react@18[^"]*"[^>]*><\/script>/g,
    '<script src="/vendor/react.js"></script>'
  );
  html = html.replace(
    /<script[^>]+src="https:\/\/unpkg.com\/react-dom@18[^"]*"[^>]*><\/script>/g,
    '<script src="/vendor/react-dom.js"></script>'
  );
  html = html.replace(
    /<script[^>]+src="https:\/\/unpkg.com\/react-router-dom@6[^"]*"[^>]*><\/script>/g,
    '<script src="/vendor/router.js"></script>'
  );
  html = html.replace(
    /<link[^>]+href="https:\/\/unpkg.com\/leaflet@1[^"]*leaflet.css[^"]*"[^>]*>/g,
    '<link rel="stylesheet" href="/vendor/leaflet.css" />'
  );
  html = html.replace(
    /<script[^>]+src="https:\/\/unpkg.com\/leaflet@1[^"]*leaflet.js[^"]*"[^>]*><\/script>/g,
    '<script src="/vendor/leaflet.js"></script>'
  );

  res.type('html').send(html);
});

ensureVendorFiles().then(() => ensureBundle()).then(() => {
  app.listen(port, () => console.log(`FixGo server running on port ${port}`));
});
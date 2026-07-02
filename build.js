#!/usr/bin/env node
// build.js — bundles the React app with esbuild and stages Leaflet assets in client/dist/vendor.
// React/ReactDOM/Router are bundled INTO app.bundle.js (imported in src/app.jsx),
// so no CDN or UMD globals are needed at runtime. Leaflet is served from /vendor.
'use strict';
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const distDir   = path.join(__dirname, 'client', 'dist');
const vendorDir = path.join(distDir, 'vendor');
fs.mkdirSync(vendorDir, { recursive: true });

// === Step 1: Leaflet assets (copy from node_modules; fall back to unpkg) ===
const leafletAssets = [
  { local: path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.js'),
    url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',  file: 'leaflet.js'  },
  { local: path.join(__dirname, 'node_modules', 'leaflet', 'dist', 'leaflet.css'),
    url: 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css', file: 'leaflet.css' },
];

for (const { local, url, file } of leafletAssets) {
  const dest = path.join(vendorDir, file);
  if (fs.existsSync(local) && fs.statSync(local).size > 1000) {
    fs.copyFileSync(local, dest);
    console.log(`Copied ${file} from node_modules (${fs.statSync(dest).size} bytes)`);
    continue;
  }
  console.log(`node_modules copy unavailable — downloading ${url}...`);
  try {
    execSync(`curl -sL --max-time 30 --retry 2 -o "${dest}" "${url}"`, { stdio: 'inherit' });
    if (!fs.existsSync(dest) || fs.statSync(dest).size < 1000) {
      throw new Error('downloaded file too small');
    }
    console.log(`Downloaded ${file} (${fs.statSync(dest).size} bytes)`);
  } catch (e) {
    console.error(`WARNING: could not stage ${file} (${e.message}). Map page may not work.`);
  }
}

// === Step 2: Bundle app code (React included in the bundle) ===
console.log('Bundling app code...');
const esbuild = require('esbuild');
const srcIndex = path.join(__dirname, 'src', 'app.jsx');
if (!fs.existsSync(srcIndex)) {
  console.error(`ERROR: app source not found at ${srcIndex}`);
  process.exit(1);
}

esbuild.buildSync({
  entryPoints: [srcIndex],
  bundle: true,
  minify: true,
  outfile: path.join(vendorDir, 'app.bundle.js'),
  format: 'iife',
  loader: { '.jsx': 'jsx', '.js': 'jsx' },
  define: { 'process.env.NODE_ENV': '"production"' },
});
const appSize = fs.statSync(path.join(vendorDir, 'app.bundle.js')).size;
console.log(`Bundle: app.bundle.js (${appSize} bytes)`);
console.log('Done.');

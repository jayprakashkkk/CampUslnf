import { cp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const mobileDir = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(mobileDir, '..');
const sourceDir = join(repoRoot, 'frontend-source');
const webDir = join(mobileDir, 'www');

const rootFiles = [
  'index.html',
  'app.js',
  'style.css',
  'manifest.webmanifest',
  'sw.js',
  'apple-touch-icon.png',
  'campus-apple-touch-orange-20261022.png',
  'campus-favicon-orange-20261022.ico',
  'campus-favicon-orange-20261022.png',
  'favicon-32.png',
  'favicon.ico'
];

await rm(webDir, { recursive: true, force: true });
await mkdir(webDir, { recursive: true });

for (const file of rootFiles) {
  await cp(join(sourceDir, file), join(webDir, file));
}

for (const directory of ['icons', 'avatars']) {
  await cp(join(sourceDir, directory), join(webDir, directory), { recursive: true });
}

const indexPath = join(webDir, 'index.html');
let html = await readFile(indexPath, 'utf8');

const appScriptPattern = /(<script\s+src=["']\/app\.js[^>]*><\/script>)/i;
if (!appScriptPattern.test(html)) {
  throw new Error('Could not find the CampUs app.js script tag in frontend-source/index.html');
}

html = html.replace(
  appScriptPattern,
  '<script>window.CAMPUS_API_BASE = "https://campuslnf-production.up.railway.app";</script>\n$1'
);

// A service worker is useful on the website, but the native WebView owns its
// local asset lifecycle. Avoid registering the website worker on localhost.
html = html.replace(
  "if ('serviceWorker' in navigator) {",
  "if ('serviceWorker' in navigator && location.hostname !== 'localhost') {"
);

await writeFile(indexPath, html, 'utf8');
console.log('CampUs mobile web bundle prepared at mobile/www');

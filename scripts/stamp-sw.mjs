// Stamp the service worker with the release version (#451).
//
// `ui/public/sw.js` is served verbatim as a static file; the browser only treats
// it as an *update* (running the install→activate→update-toast flow) when the
// file's bytes change. Left alone it is byte-identical release to release, so
// returning visitors get pinned to whatever build first cached them. This script
// runs as `ui`'s `prebuild`, injecting the monorepo root `package.json` version
// into `SW_VERSION` and the precache cache name, so every release changes the
// worker's bytes → triggers the update toast → activates a fresh precache.
//
// The transform is a pure, idempotent regex swap so it is unit-testable and safe
// to run on an already-stamped file. See ui/tests/serviceWorker.test.ts.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const SW_PATH = path.join(repoRoot, 'ui', 'public', 'sw.js');
const PKG_PATH = path.join(repoRoot, 'package.json');

/** Cache-name prefix; the version is appended so a bump makes it a new cache. */
export const PRECACHE_PREFIX = 'algebranch-precache-v';

/**
 * Return `source` with `SW_VERSION` and the precache cache name set to `version`.
 * Pure and idempotent — matches whatever the current values are and replaces them.
 */
export function stampServiceWorker(source, version) {
  return source
    .replace(/const SW_VERSION = '[^']*';/, `const SW_VERSION = '${version}';`)
    .replace(/const PRECACHE_NAME = '[^']*';/, `const PRECACHE_NAME = '${PRECACHE_PREFIX}${version}';`);
}

// When run directly (npm prebuild), stamp the real file in place.
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const version = JSON.parse(readFileSync(PKG_PATH, 'utf8')).version;
  const source = readFileSync(SW_PATH, 'utf8');
  const stamped = stampServiceWorker(source, version);
  if (stamped !== source) {
    writeFileSync(SW_PATH, stamped);
    console.log(`stamp-sw: sw.js stamped to ${version}`);
  } else {
    console.log(`stamp-sw: sw.js already at ${version}`);
  }
}

// IndexNow constants, shared by lib/indexNow.ts (per-article pings from the app) and
// scripts/indexnow-submit.mjs (bulk submit of the whole sitemap). Plain .mjs so the
// Node script can import it without a TypeScript build.

// Public by design: search engines verify it by fetching /<key>.txt (public/<key>.txt).
export const INDEXNOW_KEY = "579544694d74b8675c216eaee375ebdb";
export const INDEXNOW_HOST = "www.nitg-eg.com";
export const INDEXNOW_KEY_LOCATION = `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`;
export const INDEXNOW_ENDPOINT = "https://api.indexnow.org/indexnow";

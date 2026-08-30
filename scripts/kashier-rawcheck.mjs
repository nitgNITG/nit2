// Kashier RAW key check — bypasses dotenv-expand entirely.
//
// Problem: Next loads .env via dotenv-expand, which treats an unescaped `$` as a
// variable reference and TRUNCATES the value there. So the app (and the normal
// diagnostic) can see a cut-short secret even when .env holds the full one.
//
// This script reads the three KASHIER_ values DIRECTLY from the .env text — no
// expansion, no truncation — shows the true length, and calls Kashier with the
// full secret against BOTH test and live. It also prints what the app currently
// sees (via @next/env) so the truncation is obvious side by side.
//
//   node scripts/kashier-rawcheck.mjs
//
// Nothing is written; it only creates a throwaway session attempt.

import fs from "node:fs";
import path from "node:path";
import nextEnv from "@next/env";
const { loadEnvConfig } = nextEnv;

const ENV_PATH = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(ENV_PATH)) {
    console.error("✗ No .env at", ENV_PATH);
    process.exit(1);
}

// Raw parse: pull KEY=VALUE straight from the file, applying dotenv's quote +
// inline-comment rules but WITHOUT $-expansion — so we get the TRUE full value
// (including any literal $) that dotenv-expand would otherwise truncate.
function rawValue(name) {
    const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(new RegExp(`^\\s*${name}\\s*=(.*)$`));
        if (!m) continue;
        const rest = m[1].replace(/\r$/, "");
        const q = rest[0];
        if (q === '"' || q === "'") {
            // quoted: value is up to the matching unescaped quote; ignore the rest
            // (that's where a trailing `# comment` lives).
            let out = "";
            for (let i = 1; i < rest.length; i++) {
                const c = rest[i];
                if (c === "\\" && i + 1 < rest.length) { out += rest[++i]; continue; }
                if (c === q) break;
                out += c;
            }
            return out;
        }
        // unquoted: strip a ` #...` inline comment, then trim; keep literal $.
        const hash = rest.search(/\s#/);
        return (hash >= 0 ? rest.slice(0, hash) : rest).trim().replace(/\\\$/g, "$");
    }
    return "";
}

const merchantId = rawValue("KASHIER_MERCHANT_ID");
const apiKey = rawValue("KASHIER_API_KEY");
const secretKey = rawValue("KASHIER_SECRET_KEY");

// What the APP actually sees (dotenv-expand) — to show the truncation.
loadEnvConfig(process.cwd());
const appSecret = process.env.KASHIER_SECRET_KEY || "";

const shape = (s) => (s ? `len ${s.length}  ${s.slice(0, 6)}…${s.slice(-4)}` : "(empty)");
console.log("── keys ──");
console.log("  MERCHANT_ID           :", merchantId || "(empty)");
console.log("  API_KEY  (raw)        :", shape(apiKey));
console.log("  SECRET   (raw, TRUE)  :", shape(secretKey));
console.log("  SECRET   (app sees)   :", shape(appSecret));
if (appSecret && appSecret.length < secretKey.length) {
    console.log(`  ⚠ APP IS TRUNCATING the secret: app has ${appSecret.length} chars, file has ${secretKey.length}.`);
    console.log("    → the value is cut at a $ by dotenv-expand. Fix = escape EVERY $ as \\$ in .env,");
    console.log("      or switch to the base64 approach (ask Claude).");
}
if (!merchantId || !apiKey || !secretKey) {
    console.error("\n✗ One of the three keys is empty in .env.");
    process.exit(1);
}

async function tryOne(baseUrl) {
    const orderId = "raw_" + Date.now().toString(36);
    const body = {
        amount: "10", currency: "EGP", display: "en", merchantId, order: orderId,
        type: "one-time", allowedMethods: "card,wallet", enable3DS: true,
        serverWebhook: "https://dev.nitg-eg.com/api/payments/kashier/webhook",
        merchantRedirect: `https://dev.nitg-eg.com/en/payment/callback?order=${orderId}`,
        failureRedirect: true,
        customer: { reference: "raw", email: "raw@example.com" },
        metaData: { merchant_order_id: orderId },
    };
    try {
        const res = await fetch(`${baseUrl}/v3/payment/sessions`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: secretKey, "api-key": apiKey },
            body: JSON.stringify(body),
        });
        const text = await res.text();
        let j; try { j = JSON.parse(text); } catch { j = null; }
        const ok = res.ok && j?.sessionUrl;
        console.log(`\n── ${baseUrl}  →  HTTP ${res.status} ${ok ? "✓" : "✗"}`);
        console.log("   ", j ? JSON.stringify(j).slice(0, 300) : text.slice(0, 300));
        return ok;
    } catch (e) {
        console.log(`\n── ${baseUrl}  →  request error:`, e?.message || e);
        return false;
    }
}

console.log("\nTesting the FULL raw secret against both environments…");
const testOk = await tryOne("https://test-api.kashier.io");
const liveOk = await tryOne("https://api.kashier.io");

console.log("\n── verdict ──");
if (testOk) console.log("✓ Keys are valid for TEST. Set KASHIER_BASE_URL=https://test-api.kashier.io");
else if (liveOk) console.log("✓ Keys are valid for LIVE. Set KASHIER_BASE_URL=https://api.kashier.io  (you were pointing at test!)");
else console.log("✗ Still rejected with the full secret → the key VALUES are wrong/expired, or api-key & secret are swapped in the dashboard. Regenerate keys in Kashier and re-copy.");

// The permanent fix: paste these base64 lines into .env (base64 has no $, so
// dotenv-expand can never truncate them). The code prefers *_B64 when present.
if (testOk || liveOk) {
    console.log("\n── paste these into .env (replaces the plain KASHIER_*_KEY lines) ──");
    console.log(`KASHIER_SECRET_KEY_B64=${Buffer.from(secretKey, "utf8").toString("base64")}`);
    if (/\$/.test(apiKey)) {
        console.log(`KASHIER_API_KEY_B64=${Buffer.from(apiKey, "utf8").toString("base64")}`);
    } else {
        console.log("(KASHIER_API_KEY has no $, it's fine as-is)");
    }
    console.log("then: pm2 restart 14 && node scripts/kashier-diagnose.mjs");
}

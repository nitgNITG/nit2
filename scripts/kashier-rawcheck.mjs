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

// Raw parse: pull KEY=VALUE straight from the file. Strip only surrounding
// quotes and un-escape \$ -> $ (so an escaped or bare $ both yield the TRUE
// value). Deliberately does NOT expand or stop at $.
function rawValue(name) {
    const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
    for (const line of lines) {
        const m = line.match(new RegExp(`^\\s*${name}\\s*=(.*)$`));
        if (!m) continue;
        let v = m[1].replace(/\r$/, "");
        // strip one layer of matching surrounding quotes
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
            v = v.slice(1, -1);
        }
        v = v.replace(/\\\$/g, "$"); // \$ -> $
        return v;
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
if (secretKey.length > appSecret.length) {
    console.log("\nNOTE: even once the keys are right, the APP will keep failing until the $ truncation");
    console.log("is fixed in .env (escape every $ as \\$), because the running app uses the truncated value.");
}

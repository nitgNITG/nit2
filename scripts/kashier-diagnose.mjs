// Standalone Kashier session probe — no app rebuild needed.
// Reads KASHIER_* from .env (or the shell) and attempts to create a real v3
// session, printing the EXACT request + Kashier's raw response so we can see why
// a 400/4xx is coming back.
//
//   node scripts/kashier-diagnose.mjs            # amount 10 EGP
//   node scripts/kashier-diagnose.mjs 25         # amount 25 EGP
//
// It creates a throwaway session (no Payment row, no provisioning) — safe to run.

import fs from "node:fs";
import path from "node:path";

// Minimal .env loader (Next loads .env itself; a bare node script does not).
function loadEnv() {
    const p = path.resolve(process.cwd(), ".env");
    if (!fs.existsSync(p)) return;
    for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
        if (!m) continue;
        let v = m[2].trim();
        if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
        if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
}
loadEnv();

const BASE_URL = (process.env.KASHIER_BASE_URL || "https://api.kashier.io").replace(/\/+$/, "");
const merchantId = process.env.KASHIER_MERCHANT_ID || "";
const apiKey = process.env.KASHIER_API_KEY || "";
const secretKey = process.env.KASHIER_SECRET_KEY || "";
const appBase = (process.env.APP_BASE_URL || "https://dev.nitg-eg.com").replace(/\/+$/, "");

const mask = (s) => (s ? `${s.slice(0, 6)}…${s.slice(-4)} (len ${s.length})` : "(empty)");
console.log("── Kashier config ──");
console.log("  BASE_URL        :", BASE_URL);
console.log("  MERCHANT_ID     :", merchantId || "(empty)");
console.log("  API_KEY         :", mask(apiKey));
console.log("  SECRET_KEY      :", mask(secretKey));
console.log("  APP_BASE_URL    :", appBase);
// Trailing-whitespace / newline traps that break auth silently.
for (const [k, v] of [["MERCHANT_ID", merchantId], ["API_KEY", apiKey], ["SECRET_KEY", secretKey]]) {
    if (v && v !== v.trim()) console.log(`  ⚠ ${k} has surrounding whitespace!`);
}
if (!merchantId || !apiKey || !secretKey) {
    console.error("\n✗ Missing one of KASHIER_MERCHANT_ID / KASHIER_API_KEY / KASHIER_SECRET_KEY in .env");
    process.exit(1);
}

const amount = String(Number(process.argv[2] || 10));
const orderId = "diag_" + Date.now().toString(36);
const body = {
    amount,
    currency: "EGP",
    display: "en",
    merchantId,
    order: orderId,
    type: "one-time",
    allowedMethods: "card,wallet",
    enable3DS: true,
    serverWebhook: `${appBase}/api/payments/kashier/webhook`,
    merchantRedirect: `${appBase}/en/payment/callback?order=${orderId}`,
    failureRedirect: true,
    customer: { reference: "diag", email: "diag@example.com" },
    metaData: { merchant_order_id: orderId, diagnostic: true },
};

console.log("\n── POST", `${BASE_URL}/v3/payment/sessions`, "──");
console.log(JSON.stringify(body, null, 2));

const res = await fetch(`${BASE_URL}/v3/payment/sessions`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: secretKey, "api-key": apiKey },
    body: JSON.stringify(body),
});
const text = await res.text();
let json;
try { json = JSON.parse(text); } catch { json = null; }

console.log("\n── Response", res.status, res.statusText, "──");
console.log(json ? JSON.stringify(json, null, 2) : text);

if (res.ok && json?.sessionUrl) {
    console.log("\n✓ SUCCESS — sessionUrl:", json.sessionUrl);
} else {
    console.log("\n✗ FAILED — the message above is exactly what Kashier returned. That's the fix target.");
}

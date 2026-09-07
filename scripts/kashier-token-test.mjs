// Kashier pay-with-token PROBE — confirms the auto-renew unknowns (docs plan §9)
// on a real (test) merchant, using the KASHIER_* creds already in your .env. No
// secrets to paste, no openssl needed — Node's crypto does the hash.
//
// Reads the keys DIRECTLY from .env text (same as kashier-rawcheck.mjs) so a `$`
// in a secret is never truncated, and falls back to the *_B64 variants.
//
// Usage (run from the nit2 folder):
//   node scripts/kashier-token-test.mjs list   <customerReference>
//   node scripts/kashier-token-test.mjs pay    <cardToken> <customerReference> [amountEGP=1]
//   node scripts/kashier-token-test.mjs delete <cardToken> <customerReference>
//   node scripts/kashier-token-test.mjs hash   <orderId> <amount> <currency> <customerReference>
//
// Flags: --live (use fep.kashier.io instead of test-fep), --secret-hash (sign with
//        the SECRET key instead of the API key), --no-ref (drop customerReference
//        from the signed path). Use these to find the recipe Kashier accepts (§9.3).
//
// Typical flow:
//   1) Do a normal checkout in the app (it already sends customer.reference = your
//      user id) and pay with a Kashier TEST card.
//   2) node scripts/kashier-token-test.mjs list <that user id>   → see the saved token.
//   3) node scripts/kashier-token-test.mjs pay <token> <that user id> 1  → 1 EGP token charge.

import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const argv = process.argv.slice(2);
const flags = new Set(argv.filter((a) => a.startsWith("--")));
const args = argv.filter((a) => !a.startsWith("--"));
const cmd = args[0];

const ENV_PATH = path.resolve(process.cwd(), ".env");
if (!fs.existsSync(ENV_PATH)) {
  console.error("✗ No .env at", ENV_PATH, "— run this from the nit2 folder.");
  process.exit(1);
}

// Raw .env read (no $-expansion), with base64 fallback — mirrors lib/kashier cfg().
function rawValue(name) {
  const lines = fs.readFileSync(ENV_PATH, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const m = line.match(new RegExp(`^\\s*${name}\\s*=(.*)$`));
    if (!m) continue;
    const rest = m[1].replace(/\r$/, "");
    const q = rest[0];
    if (q === '"' || q === "'") {
      let out = "";
      for (let i = 1; i < rest.length; i++) {
        const c = rest[i];
        if (c === "\\" && i + 1 < rest.length) { out += rest[++i]; continue; }
        if (c === q) break;
        out += c;
      }
      return out;
    }
    const hash = rest.search(/\s#/);
    return (hash >= 0 ? rest.slice(0, hash) : rest).trim().replace(/\\\$/g, "$");
  }
  return "";
}
function cred(name) {
  const b64 = rawValue(`${name}_B64`);
  if (b64) { try { return Buffer.from(b64, "base64").toString("utf8"); } catch {} }
  return rawValue(name);
}

const merchantId = cred("KASHIER_MERCHANT_ID");
const apiKey = cred("KASHIER_API_KEY");
const secretKey = cred("KASHIER_SECRET_KEY");
if (!merchantId || !apiKey || !secretKey) {
  console.error("✗ KASHIER_MERCHANT_ID / API_KEY / SECRET_KEY missing in .env");
  process.exit(1);
}

const FEP = flags.has("--live") ? "https://fep.kashier.io" : "https://test-fep.kashier.io";
// FEP wants Authorization: secretKey + api-key: apiKey (same as the hosted checkout).
// --swap-auth tries them reversed, in case this merchant is configured the other way.
const AUTH = flags.has("--swap-auth") ? apiKey : secretKey;
const APIKEY = flags.has("--swap-auth") ? secretKey : apiKey;
const shape = (s) => (s ? `len ${s.length} ${s.slice(0, 4)}…${s.slice(-3)}` : "(empty)");
console.log("── creds ──");
console.log("  merchantId:", merchantId);
console.log("  api-key   :", shape(apiKey));
console.log("  secret    :", shape(secretKey));
console.log("  FEP host  :", FEP, flags.has("--live") ? "(LIVE)" : "(test)");

function orderHash(orderId, amount, currency, customerReference) {
  const key = flags.has("--secret-hash") ? secretKey : apiKey;
  let p = `/?payment=${merchantId}.${orderId}.${amount}.${currency}`;
  if (!flags.has("--no-ref") && customerReference) p += `.${customerReference}`;
  const hash = crypto.createHmac("sha256", key).update(p).digest("hex");
  console.log("  signed path:", p);
  console.log("  hash key   :", flags.has("--secret-hash") ? "SECRET key" : "API key");
  console.log("  Kashier-Hash:", hash);
  return hash;
}

async function show(res) {
  const text = await res.text();
  let j; try { j = JSON.parse(text); } catch { j = null; }
  console.log(`\n→ HTTP ${res.status}`);
  console.log(j ? JSON.stringify(j, null, 2) : text.slice(0, 1500));
  return j;
}

if (cmd === "list") {
  const ref = args[1];
  if (!ref) { console.error("usage: list <customerReference>"); process.exit(1); }
  const url = new URL(`${FEP}/v3/cards/customer`);
  url.searchParams.set("customerReference", ref);
  url.searchParams.set("merchantId", merchantId);
  console.log("\nGET", url.toString());
  const res = await fetch(url, { headers: { Authorization: AUTH, "api-key": APIKEY, accept: "application/json" } });
  await show(res);
} else if (cmd === "pay") {
  const [, cardToken, ref, amount = "1"] = args;
  if (!cardToken || !ref) { console.error("usage: pay <cardToken> <customerReference> [amountEGP=1]"); process.exit(1); }
  const orderId = "probe_" + Date.now().toString(36);
  console.log("\n── PAY (Recurring, no 3DS) ──");
  const hash = orderHash(orderId, amount, "EGP", ref);
  const body = {
    apiOperation: "PAY",
    merchantId,
    order: { reference: orderId, amount: String(amount), currency: "EGP" },
    customer: { reference: ref },
    paymentMethod: { type: "CARD", card: { cardToken }, enable3DS: false },
    interactionSource: "Recurring",
    timestamp: new Date().toISOString(),
  };
  console.log("POST", `${FEP}/v3/orders/`);
  const res = await fetch(`${FEP}/v3/orders/`, {
    method: "POST",
    headers: {
      accept: "application/json", "Content-Type": "application/json",
      Authorization: AUTH, "api-key": APIKEY, "Kashier-Hash": hash,
    },
    body: JSON.stringify(body),
  });
  const j = await show(res);
  const captured = String(j?.status).toUpperCase() === "SUCCESS" && String(j?.response?.result).toUpperCase() === "SUCCESS";
  console.log("\nverdict:", captured ? "✅ CAPTURED — hash recipe + token charge WORK"
    : (String(j?.response?.status || "").includes("AUTHENTICATION") ? "🔐 needs 3DS/OTP (acquirer forces step-up on recurring)"
      : "❌ not captured — if it's a hash/signature error, retry with --no-ref and/or --secret-hash"));
} else if (cmd === "delete") {
  const [, cardToken, ref] = args;
  if (!cardToken || !ref) { console.error("usage: delete <cardToken> <customerReference>"); process.exit(1); }
  const url = new URL(`${FEP}/v3/token/${encodeURIComponent(cardToken)}`);
  url.searchParams.set("customerReference", ref);
  console.log("\nDELETE", url.toString());
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: AUTH, "api-key": APIKEY, accept: "application/json", "Content-Type": "application/json" },
    body: "{}",
  });
  await show(res);
} else if (cmd === "hash") {
  const [, orderId, amount, currency, ref] = args;
  if (!orderId || !amount || !currency) { console.error("usage: hash <orderId> <amount> <currency> [customerReference]"); process.exit(1); }
  console.log("\n── hash only ──");
  orderHash(orderId, amount, currency, ref);
} else {
  console.log(`\nusage:
  node scripts/kashier-token-test.mjs list   <customerReference>
  node scripts/kashier-token-test.mjs pay    <cardToken> <customerReference> [amountEGP=1]
  node scripts/kashier-token-test.mjs delete <cardToken> <customerReference>
  node scripts/kashier-token-test.mjs hash   <orderId> <amount> <currency> [customerReference]
flags: --live  --secret-hash  --no-ref`);
}

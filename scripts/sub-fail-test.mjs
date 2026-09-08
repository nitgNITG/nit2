// Force a FAILED auto-renew to test the dunning path (past_due + retry + the
// "payment failed — update your card" email + Telegram alert).
//
// It points the subscription at a temporary card-on-file holding a BOGUS token,
// so the next billing run declines. Your real saved card is never touched.
//
//   node scripts/sub-fail-test.mjs <slug>                 # arm the failure
//   curl -sX POST http://localhost:3002/api/cron/expiry -H "x-cron-secret: $CRON_SECRET"
//   node scripts/sub-fail-test.mjs <slug> --restore <originalPaymentMethodId>
//
// NOTE: set BILLING_COOLDOWN_HOURS=0 (temporarily, then ./update.sh) if the sub
// was charged in the last 12h — otherwise the cooldown guard skips it before the
// decline can happen.

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import crypto from "node:crypto";
import { PrismaClient } from "prismamysql";

const SECRET = process.env.CREDENTIAL_SECRET || "";
if (!SECRET) { console.error("✗ CREDENTIAL_SECRET not set — cannot encrypt the test token"); process.exit(1); }
const key = crypto.createHash("sha256").update(SECRET, "utf8").digest();
function enc(plain) {
  const iv = crypto.randomBytes(12);
  const c = crypto.createCipheriv("aes-256-gcm", key, iv);
  const e = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("hex")}:${c.getAuthTag().toString("hex")}:${e.toString("hex")}`;
}

const slug = process.argv[2];
const restoreIdx = process.argv.indexOf("--restore");
const restore = restoreIdx !== -1;
const restoreId = restore ? process.argv[restoreIdx + 1] : null;
if (!slug) { console.error("usage: node scripts/sub-fail-test.mjs <slug> [--restore <originalPmId>]"); process.exit(1); }

const p = new PrismaClient();
try {
  const sub = await p.subscription.findUnique({ where: { academySlug: slug } });
  if (!sub) { console.error("✗ no subscription for", slug); process.exit(1); }

  if (restore) {
    if (!restoreId) { console.error("✗ pass the original PaymentMethod id: --restore <id>"); process.exit(1); }
    await p.subscription.update({ where: { academySlug: slug }, data: { paymentMethodId: restoreId, status: "active", attemptCount: 0, lastError: null } });
    const del = await p.paymentMethod.deleteMany({ where: { userId: sub.userId, brand: "TESTFAIL" } });
    console.log(`✅ restored ${slug} → paymentMethod ${restoreId}, removed ${del.count} test card(s), status active.`);
  } else {
    const originalPmId = sub.paymentMethodId;
    const bad = await p.paymentMethod.create({
      data: { userId: sub.userId, customerReference: sub.userId, cardTokenEnc: enc("BOGUS-TEST-TOKEN-" + Date.now()), brand: "TESTFAIL", last4: "0000", isDefault: false },
    });
    await p.subscription.update({ where: { academySlug: slug }, data: { paymentMethodId: bad.id, nextAttemptAt: new Date(Date.now() - 1000), preRenewNotifiedAt: null } });
    console.log("✅ armed a FAILING charge for", slug);
    console.log("   original paymentMethod:", originalPmId ?? "(was using default)");
    console.log("\n1) trigger the billing run:");
    console.log('   curl -sX POST http://localhost:3002/api/cron/expiry -H "x-cron-secret: $CRON_SECRET"');
    console.log("   → expect billing.failed = [\"" + slug + "\"], a 'payment failed' email, and a ⚠️ Telegram alert.");
    console.log("\n2) then RESTORE the real card:");
    console.log(`   node scripts/sub-fail-test.mjs ${slug} --restore ${originalPmId ?? "<originalPmId>"}`);
  }
} finally {
  await p.$disconnect();
}

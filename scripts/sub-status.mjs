// Inspect / test an academy's auto-renew subscription.
//
//   node scripts/sub-status.mjs <slug>              → show subscription + saved card (masked)
//   node scripts/sub-status.mjs <slug> --charge-now → arm it so the NEXT billing run charges it
//
// Never prints the card token — only brand/last4. After --charge-now, trigger the
// billing run:  curl -X POST http://localhost:3002/api/cron/expiry -H "x-cron-secret: $CRON_SECRET"

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { PrismaClient } from "prismamysql";

const slug = process.argv[2];
const chargeNow = process.argv.includes("--charge-now");
if (!slug) { console.error("usage: node scripts/sub-status.mjs <slug> [--charge-now]"); process.exit(1); }

const prisma = new PrismaClient();
try {
  const sub = await prisma.subscription.findUnique({ where: { academySlug: slug } });
  if (!sub) {
    console.log("✗ no Subscription for", slug, "— (feature off? autoRenew not set? or webhook hasn't opened it yet)");
  } else {
    console.log("── subscription ──");
    console.log("  academy      :", sub.academySlug);
    console.log("  status       :", sub.status, "  autoRenew:", sub.autoRenew);
    console.log("  license      :", sub.licenseKey, " amount:", sub.amountEgp, sub.currency, " every", sub.intervalDays, "d");
    console.log("  periodEnd    :", sub.currentPeriodEnd?.toISOString());
    console.log("  nextAttempt  :", sub.nextAttemptAt?.toISOString() ?? "(none)");
    console.log("  attempts     :", sub.attemptCount, sub.lastError ? `(last error: ${sub.lastError})` : "");
    console.log("  paymentMethod:", sub.paymentMethodId ?? "(none — billing will use the user's default)");

    const pm = sub.paymentMethodId
      ? await prisma.paymentMethod.findUnique({ where: { id: sub.paymentMethodId } })
      : await prisma.paymentMethod.findFirst({ where: { userId: sub.userId, isDefault: true }, orderBy: { createdAt: "desc" } });
    console.log("── saved card ──");
    if (!pm) console.log("  ✗ none stored for owner", sub.userId, "— did the callback save-card run?");
    else console.log(`  ${pm.brand || "card"} ****${pm.last4 || "????"}  default:${pm.isDefault}  saved:${pm.createdAt?.toISOString()}  (token stored encrypted)`);

    if (chargeNow) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { nextAttemptAt: new Date(Date.now() - 1000) } });
      console.log("\n✅ armed — nextAttemptAt set to now. Trigger the billing run:");
      console.log('   curl -X POST http://localhost:3002/api/cron/expiry -H "x-cron-secret: $CRON_SECRET"');
    }
  }
} finally {
  await prisma.$disconnect();
}

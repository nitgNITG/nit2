// Find the customerReference a checkout used for a given Kashier order, so we can
// pay-with-token under the RIGHT reference (a token only charges under the exact
// customer id it was saved with).
//
//   node scripts/kashier-find-ref.mjs <orderId>
//   e.g. node scripts/kashier-find-ref.mjs acad_2927a230352243fcbe5d2f20
//
// Prints the Payment.userId (== customer.reference we sent Kashier) + context.

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd()); // same env resolution the app uses ($ handled)
import { PrismaClient } from "prismamysql";

const orderId = process.argv[2];
if (!orderId) { console.error("usage: node scripts/kashier-find-ref.mjs <orderId>"); process.exit(1); }

const prisma = new PrismaClient();
try {
  const p = await prisma.payment.findUnique({ where: { orderId } });
  if (!p) { console.error("✗ no Payment row for order", orderId); process.exit(1); }
  console.log("order        :", p.orderId);
  console.log("customerRef  :", p.userId, "  ← use THIS as the customerReference in `pay`");
  console.log("purpose      :", p.purpose);
  console.log("licenseKey   :", p.licenseKey);
  console.log("academySlug  :", p.academySlug);
  console.log("status       :", p.status, "  amount", p.amount, p.currency);
  console.log("\nnext:");
  console.log(`  node scripts/kashier-token-test.mjs pay <cardDataToken> ${p.userId} 1 --hash-only`);
} finally {
  await prisma.$disconnect();
}

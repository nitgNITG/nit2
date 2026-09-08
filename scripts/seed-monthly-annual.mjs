// Add MONTHLY variants for each paid tier, and label the existing paid tiers as
// ANNUAL — so buyers can pick a billing cycle. Idempotent (upsert by key).
//
//   node scripts/seed-monthly-annual.mjs            # preview (no writes)
//   node scripts/seed-monthly-annual.mjs --apply    # write the rows
//
// SAFE for existing academies: the base keys (basic/standard/professional) are kept
// ACTIVE and unchanged except their display name — an academy on tier "basic" keeps
// renewing. We only ADD "<key>-monthly" rows (30-day term) and relabel the annual
// ones "(Annual)". Monthly price defaults to round(annual / 10) → ~2 months free on
// annual; edit any price/name later in Dashboard → Licenses.

import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
import { PrismaClient } from "prismamysql";

const apply = process.argv.includes("--apply");
const MONTHLY_DIVISOR = 10; // annual ≈ 10 monthly payments (2 months free)
const p = new PrismaClient();

const stripCycle = (name) => name.replace(/\s*\((annual|monthly|yearly|سنوي|شهري)\)\s*$/i, "").trim();

try {
  const all = await p.license.findMany({ orderBy: [{ order: "asc" }, { price: "asc" }] });
  // Paid base tiers = priceEgp>0 and not already a -monthly/-annual variant.
  const bases = all.filter(
    (l) => (l.priceEgp ?? 0) > 0 && !/-(monthly|annual)$/i.test(l.key),
  );
  if (!bases.length) {
    console.log("No paid base tiers found (priceEgp>0). Set prices in Dashboard → Licenses first.");
    process.exit(0);
  }

  const plan = [];
  for (const base of bases) {
    const baseName = stripCycle(base.name);
    const monthlyKey = `${base.key}-monthly`;
    const monthlyEgp = Math.max(1, Math.round((base.priceEgp ?? 0) / MONTHLY_DIVISOR));
    const monthlyUsd = base.price ? Math.max(1, Math.round(base.price / MONTHLY_DIVISOR)) : 0;
    const exists = all.find((l) => l.key === monthlyKey);

    // The monthly variant is identical to its annual parent except cycle/price/name.
    const monthly = {
      key: monthlyKey, name: `${baseName} (Monthly)`,
      active: base.active, price: monthlyUsd, priceEgp: monthlyEgp, durationDays: 30,
      maxCourses: base.maxCourses, maxTeachers: base.maxTeachers, storageGb: base.storageGb,
      supportedApp: base.supportedApp, videoSource: base.videoSource, kashierEnabled: base.kashierEnabled,
      limits: base.limits, features: base.features, order: base.order,
    };
    plan.push({ op: exists ? "update-monthly" : "create-monthly", key: monthlyKey, monthly });

    // Relabel the annual parent for clarity (display only; key/price unchanged).
    const annualName = `${baseName} (Annual)`;
    if (base.name !== annualName) plan.push({ op: "relabel-annual", key: base.key, annualName });
  }

  console.log(apply ? "── applying ──" : "── preview (pass --apply to write) ──");
  for (const step of plan) {
    if (step.op === "relabel-annual") {
      console.log(`  ${step.key}: name → "${step.annualName}"`);
      if (apply) await p.license.update({ where: { key: step.key }, data: { name: step.annualName } });
    } else {
      console.log(`  ${step.key}: ${step.op === "create-monthly" ? "CREATE" : "update"}  ${step.monthly.priceEgp} EGP / 30d  ("${step.monthly.name}")`);
      if (apply) await p.license.upsert({ where: { key: step.key }, update: step.monthly, create: step.monthly });
    }
  }
  console.log(apply ? `\n✅ done — total licenses: ${await p.license.count()}` : "\n(no changes written)");
} catch (e) {
  console.error("FAIL", String(e.message).slice(0, 300));
  process.exitCode = 1;
} finally {
  await p.$disconnect();
}

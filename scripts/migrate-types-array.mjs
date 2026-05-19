/**
 * Migration: type String? → types String[]
 * Also seeds the Step2English LMS project.
 * Run: node scripts/migrate-types-array.mjs
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // ── 1. Fetch all projects via raw MongoDB to read the old "type" field ──
  // Prisma no longer exposes "type", so we use $runCommandRaw
  const raw = await prisma.$runCommandRaw({
    find: 'Project',
    filter: {},
    projection: { _id: 1, type: 1, types: 1 },
  });

  const docs = raw.cursor?.firstBatch ?? [];
  console.log(`Found ${docs.length} project(s) to migrate.`);

  for (const doc of docs) {
    const id = doc._id?.$oid ?? doc._id;
    const existingTypes = doc.types ?? [];        // already migrated?
    const legacyType = doc.type;                  // old single-value field

    if (existingTypes.length > 0) {
      console.log(`  ⏭  ${id} already has types=${JSON.stringify(existingTypes)}`);
      continue;
    }

    // Map old type values → new system
    let newTypes = [];
    if (legacyType === 'project') newTypes = ['lms'];
    else if (legacyType === 'app') newTypes = ['ecommerce'];
    else if (legacyType && legacyType !== '') newTypes = [legacyType];
    else newTypes = ['lms'];  // fallback

    await prisma.project.update({
      where: { id },
      data: { types: newTypes },
    });
    console.log(`  ✅ ${id}: type="${legacyType}" → types=${JSON.stringify(newTypes)}`);
  }

  console.log('\nAll projects migrated.\n');

  // ── 2. Verify PayPoins is ecommerce ──
  const paypoins = await prisma.project.findFirst({ where: { types: { has: 'ecommerce' } }, select: { id: true, titleEn: true, types: true } });
  if (paypoins) console.log(`✅ eCommerce: "${paypoins.titleEn}" → types=${JSON.stringify(paypoins.types)}`);
  else console.log('⚠️  No ecommerce project found — check DB');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

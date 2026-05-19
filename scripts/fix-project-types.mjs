// One-off migration: set type='ecommerce' on the existing PayPoins project
// Run with: node scripts/fix-project-types.mjs
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Update ALL projects that still have the old type values
  const fixes = [
    // old type 'project' → 'lms' (LMS/Moodle projects)
    // old type 'app' → 'ecommerce' (eCommerce apps)
    // Special: PayPoins (id: 69e4985c87b22cccf5a45bdc) is an ecommerce app, not LMS
    { id: '69e4985c87b22cccf5a45bdc', newType: 'ecommerce' },
  ];

  for (const fix of fixes) {
    const result = await prisma.project.update({
      where: { id: fix.id },
      data: { type: fix.newType },
      select: { id: true, title: true, titleEn: true, type: true },
    });
    console.log(`✅ Updated: ${result.titleEn} (${result.id}) → type=${result.type}`);
  }

  // Also bulk-update any remaining old-style type values
  const legacyProjects = await prisma.project.updateMany({
    where: { type: 'project' },
    data: { type: 'lms' },
  });
  if (legacyProjects.count > 0) {
    console.log(`✅ Migrated ${legacyProjects.count} legacy "project" → "lms"`);
  }

  const legacyApps = await prisma.project.updateMany({
    where: { type: 'app' },
    data: { type: 'ecommerce' },
  });
  if (legacyApps.count > 0) {
    console.log(`✅ Migrated ${legacyApps.count} legacy "app" → "ecommerce"`);
  }

  console.log('Done.');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());

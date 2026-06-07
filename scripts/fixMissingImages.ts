/**
 * Fixes the 3 articles that still have Cloudinary placeholder images.
 * Run on the server:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/fixMissingImages.ts
 */

import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const fixes = [
    { id: '6a0d17a26c1734c8e49722e5', img: '/blog/ecommerce-app-cost.svg' },
    { id: '6a0cca724c487ec84645d8da', img: '/blog/moodle-egypt-2025.svg' },
    { id: '6a0cca6c4c487ec84645d8d4', img: '/blog/build-ecommerce-app.svg' },
];

async function main() {
    for (const { id, img } of fixes) {
        try {
            await prisma.article.update({ where: { id }, data: { img } });
            console.log(`✅ Fixed: ${img}`);
        } catch (e: any) {
            console.error(`❌ Failed ${id}: ${e.message}`);
        }
    }
    console.log('\nDone.\n');
}

main().catch(console.error).finally(() => prisma.$disconnect());

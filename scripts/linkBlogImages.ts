/**
 * Links the 16 pre-generated SVG images (in /public/blog/) to their articles in the DB.
 *
 * Run on the server after git pull:
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/linkBlogImages.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const links = [
    { id: '6a24e803b778f410a3acf0cb', img: '/blog/ios-android-web.svg' },
    { id: '6a24e802b778f410a3acf0c6', img: '/blog/digital-transform.svg' },
    { id: '6a24e801b778f410a3acf0c2', img: '/blog/multivendor-ecommerce.svg' },
    { id: '6a24e800b778f410a3acf0bd', img: '/blog/moodle-benefits.svg' },
    { id: '6a24e7feb778f410a3acf0b7', img: '/blog/choose-dev-company.svg' },
    { id: '6a24e7fdb778f410a3acf0b2', img: '/blog/moodle-cost.svg' },
    { id: '6a0d17ca6c1734c8e497230f', img: '/blog/moodle-plugins.svg' },
    { id: '6a0d17c46c1734c8e4972309', img: '/blog/transform-training.svg' },
    { id: '6a0d17be6c1734c8e4972303', img: '/blog/elearning-benefits.svg' },
    { id: '6a0d17b86c1734c8e49722fd', img: '/blog/elearning-cost.svg' },
    { id: '6a0d17b36c1734c8e49722f7', img: '/blog/boost-store-sales.svg' },
    { id: '6a0d17ad6c1734c8e49722f1', img: '/blog/shopify-vs-custom.svg' },
    { id: '6a0d17a86c1734c8e49722eb', img: '/blog/payment-gateways.svg' },
    { id: '6a0d17a24c487ec84645d8da', img: '/blog/ecommerce-app-cost.svg' },
    { id: '6a0cca724c487ec84645d8da', img: '/blog/moodle-egypt-2025.svg' },
    { id: '6a0cca6c4c487ec84645d8d4', img: '/blog/build-ecommerce-app.svg' },
];

async function main() {
    console.log(`\nLinking ${links.length} blog images…\n`);
    let updated = 0;
    for (const { id, img } of links) {
        await prisma.article.update({ where: { id }, data: { img } });
        console.log(`✅ ${img}`);
        updated++;
    }
    console.log(`\nDone — ${updated} articles updated.\n`);
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

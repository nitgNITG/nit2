/**
 * Generate simple SVG header images for all 16 blog articles,
 * save to /public/blog/, and update the database.
 *
 * Run (generates + updates DB):
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/generateBlogImages.ts
 *
 * After providing Bunny.net credentials, upload + update DB with CDN URLs:
 *   BUNNY_ZONE=yourzone BUNNY_KEY=yourapikey BUNNY_HOST=https://yourzone.b-cdn.net \
 *   npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/generateBlogImages.ts
 */

import fs from 'fs';
import path from 'path';
import https from 'https';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const OUT = path.join(process.cwd(), 'public', 'blog');

/* ── SVG builder ──────────────────────────────────────────────────────────── */

function svg(accent: string, icon: string, label: string): string {
    const a = accent;
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">
  <!-- Background -->
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#071a16"/>
      <stop offset="100%" stop-color="#0f2e28"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>

  <!-- Decorative circles -->
  <circle cx="100"  cy="100"  r="180" fill="${a}" opacity="0.07"/>
  <circle cx="1100" cy="530"  r="220" fill="${a}" opacity="0.07"/>
  <circle cx="600"  cy="315"  r="300" fill="${a}" opacity="0.04"/>

  <!-- Accent top bar -->
  <rect x="0" y="0" width="6" height="630" fill="${a}" opacity="0.8"/>

  <!-- Icon group (centered at 600,290) -->
  <g transform="translate(600,290)" fill="none" stroke-linecap="round" stroke-linejoin="round">
${icon}
  </g>

  <!-- Bottom label strip -->
  <rect x="0" y="575" width="1200" height="55" fill="${a}" opacity="0.12"/>
  <text x="60" y="608" font-family="Arial,sans-serif" font-size="20" font-weight="bold"
        fill="${a}" opacity="0.9" letter-spacing="2">N.I.T EGYPT</text>
  <text x="1140" y="608" font-family="Arial,sans-serif" font-size="16"
        fill="white" opacity="0.5" text-anchor="end">${label}</text>
</svg>`;
}

/* ── Icon definitions (centered at 0,0, roughly 220×160 bounding box) ──────── */

const ICONS: Record<string, string> = {

    // 3 device screens
    'three-screens': `
    <rect x="-160" y="-65" width="80" height="115" rx="10" stroke="white" stroke-width="5" opacity="0.6"/>
    <rect x="-40"  y="-80" width="80" height="130" rx="10" stroke="#00FFB2" stroke-width="5"/>
    <rect x="80"   y="-65" width="80" height="115" rx="10" stroke="white" stroke-width="5" opacity="0.6"/>
    <circle cx="-120" cy="32"  r="7" fill="white" opacity="0.5"/>
    <circle cx="0"    cy="32"  r="7" fill="#00FFB2"/>
    <circle cx="120"  cy="32"  r="7" fill="white" opacity="0.5"/>`,

    // Lightning bolt
    'lightning': `
    <polygon points="20,-90 -30,10 10,10 -20,90 40,-15 -5,-15 30,-90"
             fill="#00FFB2" opacity="0.9"/>
    <circle cx="0" cy="0" r="100" stroke="white" stroke-width="3" stroke-dasharray="12 10" opacity="0.3"/>`,

    // Shopping cart + 3 people
    'multivendor': `
    <circle cx="-90" cy="-80" r="22" stroke="white" stroke-width="4" opacity="0.7"/>
    <circle cx="0"   cy="-90" r="22" stroke="#00FFB2" stroke-width="4"/>
    <circle cx="90"  cy="-80" r="22" stroke="white" stroke-width="4" opacity="0.7"/>
    <line x1="-90" y1="-55" x2="-30" y2="0" stroke="white" stroke-width="2" opacity="0.4"/>
    <line x1="0"   y1="-65" x2="0"   y2="0" stroke="#00FFB2" stroke-width="2" opacity="0.5"/>
    <line x1="90"  y1="-55" x2="30"  y2="0" stroke="white" stroke-width="2" opacity="0.4"/>
    <rect x="-70" y="0" width="140" height="75" rx="8" stroke="#00FFB2" stroke-width="4"/>
    <line x1="-50" y1="75" x2="-50" y2="90" stroke="white" stroke-width="4"/>
    <line x1="50"  y1="75" x2="50"  y2="90" stroke="white" stroke-width="4"/>
    <circle cx="-50" cy="95" r="10" stroke="white" stroke-width="4"/>
    <circle cx="50"  cy="95" r="10" stroke="white" stroke-width="4"/>`,

    // Graduation cap + bar chart
    'graduation-chart': `
    <polygon points="0,-90 -90,-45 0,0 90,-45" stroke="#00FFB2" stroke-width="4" fill="#00FFB2" opacity="0.15"/>
    <line x1="0" y1="-90" x2="0" y2="-45" stroke="#00FFB2" stroke-width="4"/>
    <line x1="90" y1="-45" x2="90" y2="0" stroke="white" stroke-width="4" opacity="0.7"/>
    <circle cx="0" cy="5" r="28" stroke="#00FFB2" stroke-width="4"/>
    <rect x="-85" y="35" width="35" height="55" rx="4" fill="white" opacity="0.25"/>
    <rect x="-35" y="20" width="35" height="70" rx="4" fill="#00FFB2" opacity="0.4"/>
    <rect x="15"  y="10" width="35" height="80" rx="4" fill="white" opacity="0.6"/>
    <rect x="65"  y="5"  width="35" height="85" rx="4" fill="#00FFB2" opacity="0.8"/>`,

    // Magnifier with checkmark
    'magnifier': `
    <circle cx="-25" cy="-20" r="85" stroke="#00FFB2" stroke-width="6"/>
    <line x1="45" y1="50" x2="100" y2="105" stroke="white" stroke-width="10" stroke-linecap="round"/>
    <polyline points="-65,-15 -30,25 35,-40" stroke="white" stroke-width="7" stroke-linecap="round"/>`,

    // Stacked coins + price tag
    'coins-tag': `
    <ellipse cx="-60" cy="30"  rx="55" ry="18" stroke="#00FFB2" stroke-width="4" fill="#00FFB2" opacity="0.1"/>
    <ellipse cx="-60" cy="10"  rx="55" ry="18" stroke="#00FFB2" stroke-width="4" fill="#0B2923"/>
    <ellipse cx="-60" cy="-10" rx="55" ry="18" stroke="#00FFB2" stroke-width="4" fill="#0B2923"/>
    <ellipse cx="-60" cy="-30" rx="55" ry="18" stroke="white"   stroke-width="4" fill="#0B2923"/>
    <text x="-60" y="-25" font-family="Arial" font-size="18" fill="white" text-anchor="middle" font-weight="bold">$</text>
    <path d="M40,-70 L110,-70 L120,-60 L120,40 L110,50 L40,50 L40,-70 Z" stroke="white" stroke-width="4"/>
    <circle cx="55" cy="-55" r="10" stroke="#00FFB2" stroke-width="3"/>
    <text x="80" y="5" font-family="Arial" font-size="22" fill="#00FFB2" text-anchor="middle" font-weight="bold">$$</text>`,

    // Book + gear
    'book-gear': `
    <path d="M-90,-80 L-90,80 Q-90,90 -80,90 L0,80 L0,-80 Z" stroke="#00FFB2" stroke-width="4" fill="#00FFB2" opacity="0.1"/>
    <path d="M90,-80 L90,80 Q90,90 80,90 L0,80 L0,-80 Z" stroke="white" stroke-width="4" fill="white" opacity="0.05"/>
    <line x1="0" y1="-80" x2="0" y2="80" stroke="white" stroke-width="3"/>
    <circle cx="55" cy="-10" r="40" stroke="#00FFB2" stroke-width="5"/>
    <circle cx="55" cy="-10" r="18" fill="#00FFB2" opacity="0.3"/>
    <line x1="55" y1="-55" x2="55" y2="-50" stroke="#00FFB2" stroke-width="8" stroke-linecap="round"/>
    <line x1="55" y1="30"  x2="55" y2="35"  stroke="#00FFB2" stroke-width="8" stroke-linecap="round"/>
    <line x1="10" y1="-10" x2="15" y2="-10" stroke="#00FFB2" stroke-width="8" stroke-linecap="round"/>
    <line x1="95" y1="-10" x2="100" y2="-10" stroke="#00FFB2" stroke-width="8" stroke-linecap="round"/>`,

    // Building → arrow → monitor
    'transform': `
    <rect x="-160" y="-30" width="90" height="110" rx="4" stroke="white" stroke-width="4" opacity="0.7"/>
    <polygon points="-115,-75 -160,-30 -70,-30" fill="white" opacity="0.3"/>
    <rect x="-145" y="20" width="25" height="35" rx="2" fill="white" opacity="0.4"/>
    <rect x="-110" y="20" width="25" height="35" rx="2" fill="white" opacity="0.4"/>
    <line x1="-65" y1="30" x2="45" y2="30" stroke="#00FFB2" stroke-width="5" marker-end="url(#arr)"/>
    <polygon points="45,30 30,22 30,38" fill="#00FFB2"/>
    <rect x="55" y="-45" width="105" height="75" rx="8" stroke="#00FFB2" stroke-width="5"/>
    <rect x="90" y="30"  width="35"  height="8"  rx="4" fill="white" opacity="0.5"/>
    <rect x="65" y="5"   width="80"  height="3"  rx="2" fill="#00FFB2" opacity="0.5"/>
    <rect x="65" y="15"  width="60"  height="3"  rx="2" fill="white" opacity="0.3"/>`,

    // School + checkmarks
    'school-check': `
    <rect x="-120" y="-30" width="130" height="110" rx="4" stroke="white" stroke-width="4" opacity="0.6"/>
    <polygon points="-55,-80 -120,-30 10,-30" fill="white" opacity="0.2" stroke="white" stroke-width="3"/>
    <rect x="-85" y="20" width="30" height="40" rx="2" fill="white" opacity="0.35"/>
    <rect x="-45" y="20" width="30" height="40" rx="2" fill="white" opacity="0.35"/>
    <rect x="-5"  y="20" width="30" height="40" rx="2" fill="white" opacity="0.35"/>
    <polyline points="60,-50 85,-20 130,-70" stroke="#00FFB2" stroke-width="7" fill="none" stroke-linecap="round"/>
    <polyline points="60,5  85,35  130,-15" stroke="#00FFB2" stroke-width="7" fill="none" stroke-linecap="round"/>
    <polyline points="60,55 85,85  130,35"  stroke="#00FFB2" stroke-width="7" fill="none" stroke-linecap="round"/>`,

    // Coins + line chart
    'coins-chart': `
    <ellipse cx="-80" cy="50"  rx="50" ry="16" stroke="#00FFB2" stroke-width="4" fill="#00FFB2" opacity="0.08"/>
    <ellipse cx="-80" cy="30"  rx="50" ry="16" stroke="#00FFB2" stroke-width="4" fill="#0f2e28"/>
    <ellipse cx="-80" cy="10"  rx="50" ry="16" stroke="#00FFB2" stroke-width="4" fill="#0f2e28"/>
    <ellipse cx="-80" cy="-10" rx="50" ry="16" stroke="white"   stroke-width="4" fill="#0f2e28"/>
    <text x="-80" y="-5" font-family="Arial" font-size="14" fill="white" text-anchor="middle">$</text>
    <polyline points="30,60 70,20 100,-30 140,-60 170,-80" stroke="#00FFB2" stroke-width="5" fill="none" stroke-linecap="round"/>
    <circle cx="30"  cy="60"  r="8" fill="#00FFB2"/>
    <circle cx="100" cy="-30" r="8" fill="#00FFB2"/>
    <circle cx="170" cy="-80" r="8" fill="white"/>
    <line x1="30" y1="-100" x2="30" y2="80" stroke="white" stroke-width="2" opacity="0.3"/>
    <line x1="20" y1="80"   x2="185" y2="80" stroke="white" stroke-width="2" opacity="0.3"/>`,

    // Bag + upward arrow
    'bag-arrow': `
    <path d="M-80,-20 Q-80,-90 0,-90 Q80,-90 80,-20 L80,80 Q80,90 70,90 L-70,90 Q-80,90 -80,80 Z"
          stroke="white" stroke-width="5" fill="white" opacity="0.08"/>
    <path d="M-40,-90 Q-40,-130 0,-130 Q40,-130 40,-90" stroke="white" stroke-width="5" fill="none"/>
    <line x1="130" y1="50" x2="130" y2="-100" stroke="#00FFB2" stroke-width="7" stroke-linecap="round"/>
    <polygon points="130,-100 110,-70 150,-70" fill="#00FFB2"/>
    <text x="0" y="30" font-family="Arial" font-size="30" fill="#00FFB2" text-anchor="middle" font-weight="bold">+</text>`,

    // Two boxes VS
    'vs-compare': `
    <rect x="-160" y="-70" width="110" height="130" rx="10" stroke="white" stroke-width="4" opacity="0.6"/>
    <text x="-105" y="15" font-family="Arial" font-size="50" fill="white" text-anchor="middle" font-weight="bold" opacity="0.7">S</text>
    <text x="0" y="20" font-family="Arial" font-size="36" fill="#00FFB2" text-anchor="middle" font-weight="bold">VS</text>
    <rect x="50"  y="-70" width="110" height="130" rx="10" stroke="#00FFB2" stroke-width="4"/>
    <text x="60"  y="5" font-family="Arial" font-size="34" fill="#00FFB2" text-anchor="start" font-weight="bold">&lt;/&gt;</text>`,

    // Credit card + shield
    'card-shield': `
    <rect x="-140" y="-55" width="175" height="115" rx="12" stroke="white" stroke-width="5"/>
    <rect x="-140" y="-15" width="175" height="20" fill="white" opacity="0.2"/>
    <rect x="-120" y="20" width="50" height="12" rx="3" fill="white" opacity="0.4"/>
    <rect x="-60"  y="20" width="30" height="12" rx="3" fill="white" opacity="0.3"/>
    <path d="M50,-60 L155,-60 L155,30 Q155,80 100,90 Q45,80 45,30 Z"
          stroke="#00FFB2" stroke-width="4" fill="#00FFB2" opacity="0.1"/>
    <polyline points="70,15 95,40 140,-20" stroke="#00FFB2" stroke-width="7" fill="none" stroke-linecap="round"/>`,

    // Phone + dollar circle
    'phone-price': `
    <rect x="-120" y="-100" width="100" height="175" rx="14" stroke="white" stroke-width="5"/>
    <rect x="-110" y="-85"  width="80"  height="115" rx="6" fill="white" opacity="0.07"/>
    <circle cx="-70" cy="60" r="10" fill="white" opacity="0.5"/>
    <circle cx="70" cy="-10" r="75" stroke="#00FFB2" stroke-width="5" fill="#00FFB2" opacity="0.08"/>
    <text x="70" y="10" font-family="Arial" font-size="55" fill="#00FFB2" text-anchor="middle" font-weight="bold">$</text>`,

    // Book + pyramid
    'book-pyramid': `
    <path d="M-110,-85 L-110,85 Q-105,95 -95,90 L0,75 L0,-85 Z"
          stroke="#00FFB2" stroke-width="4" fill="#00FFB2" opacity="0.1"/>
    <path d="M110,-85 L110,85 Q105,95 95,90 L0,75 L0,-85 Z"
          stroke="white" stroke-width="4" fill="white" opacity="0.05"/>
    <line x1="0" y1="-85" x2="0" y2="75" stroke="white" stroke-width="3"/>
    <line x1="-85" y1="10" x2="-15" y2="10" stroke="#00FFB2" stroke-width="3" opacity="0.6"/>
    <line x1="-85" y1="30" x2="-15" y2="30" stroke="white" stroke-width="3" opacity="0.3"/>`,

    // Code brackets + cart
    'code-cart': `
    <text x="-130" y="40" font-family="Arial,monospace" font-size="110" fill="white" font-weight="bold" opacity="0.7">&lt;</text>
    <text x="30"   y="40" font-family="Arial,monospace" font-size="110" fill="white" font-weight="bold" opacity="0.7">&gt;</text>
    <rect x="-30" y="-20" width="60" height="45" rx="5" stroke="#00FFB2" stroke-width="4"/>
    <line x1="-40" y1="-30" x2="-30" y2="-20" stroke="#00FFB2" stroke-width="4"/>
    <line x1="-60" y1="-30" x2="-40" y2="-30" stroke="#00FFB2" stroke-width="4"/>
    <circle cx="-15" cy="35" r="9" stroke="#00FFB2" stroke-width="4"/>
    <circle cx="15"  cy="35" r="9" stroke="#00FFB2" stroke-width="4"/>`,
};

/* ── Article definitions ─────────────────────────────────────────────────── */

interface ArticleImg {
    id: string;
    slug: string;
    accent: string;
    icon: string;
    label: string;
}

const articles: ArticleImg[] = [
    // ── 6 seeded articles (have /logo.svg) ───────────────────────────────────
    {
        id: '6a24e803b778f410a3acf0cb',
        slug: 'ios-android-web',
        accent: '#3B82F6',
        icon: ICONS['three-screens'],
        label: 'Mobile & Web',
    },
    {
        id: '6a24e802b778f410a3acf0c6',
        slug: 'digital-transform',
        accent: '#F59E0B',
        icon: ICONS['lightning'],
        label: 'Digital Transformation',
    },
    {
        id: '6a24e801b778f410a3acf0c2',
        slug: 'multivendor-ecommerce',
        accent: '#10B981',
        icon: ICONS['multivendor'],
        label: 'eCommerce',
    },
    {
        id: '6a24e800b778f410a3acf0bd',
        slug: 'moodle-benefits',
        accent: '#268F79',
        icon: ICONS['graduation-chart'],
        label: 'Moodle LMS',
    },
    {
        id: '6a24e7feb778f410a3acf0b7',
        slug: 'choose-dev-company',
        accent: '#F97316',
        icon: ICONS['magnifier'],
        label: 'Software Development',
    },
    {
        id: '6a24e7fdb778f410a3acf0b2',
        slug: 'moodle-cost',
        accent: '#EAB308',
        icon: ICONS['coins-tag'],
        label: 'Moodle LMS',
    },
    // ── 10 existing articles ──────────────────────────────────────────────────
    {
        id: '6a0d17ca6c1734c8e497230f',
        slug: 'moodle-plugins',
        accent: '#8B5CF6',
        icon: ICONS['book-gear'],
        label: 'Moodle Plugins',
    },
    {
        id: '6a0d17c46c1734c8e4972309',
        slug: 'transform-training',
        accent: '#3B82F6',
        icon: ICONS['transform'],
        label: 'Training Centers',
    },
    {
        id: '6a0d17be6c1734c8e4972303',
        slug: 'elearning-benefits',
        accent: '#10B981',
        icon: ICONS['school-check'],
        label: 'eLearning',
    },
    {
        id: '6a0d17b86c1734c8e49722fd',
        slug: 'elearning-cost',
        accent: '#F59E0B',
        icon: ICONS['coins-chart'],
        label: 'eLearning Cost',
    },
    {
        id: '6a0d17b36c1734c8e49722f7',
        slug: 'boost-store-sales',
        accent: '#F97316',
        icon: ICONS['bag-arrow'],
        label: 'eCommerce',
    },
    {
        id: '6a0d17ad6c1734c8e49722f1',
        slug: 'shopify-vs-custom',
        accent: '#EC4899',
        icon: ICONS['vs-compare'],
        label: 'eCommerce',
    },
    {
        id: '6a0d17a86c1734c8e49722eb',
        slug: 'payment-gateways',
        accent: '#06B6D4',
        icon: ICONS['card-shield'],
        label: 'Payment Solutions',
    },
    {
        id: '6a0d17a24c487ec84645d8da',
        slug: 'ecommerce-app-cost',
        accent: '#EF4444',
        icon: ICONS['phone-price'],
        label: 'eCommerce App',
    },
    {
        id: '6a0cca724c487ec84645d8da',
        slug: 'moodle-egypt-2025',
        accent: '#06B6D4',
        icon: ICONS['book-pyramid'],
        label: 'Moodle Egypt',
    },
    {
        id: '6a0cca6c4c487ec84645d8d4',
        slug: 'build-ecommerce-app',
        accent: '#8B5CF6',
        icon: ICONS['code-cart'],
        label: 'App Development',
    },
];

/* ── Bunny.net uploader ──────────────────────────────────────────────────── */

function uploadToBunny(
    zoneName: string,
    apiKey: string,
    filePath: string,
    destPath: string,
): Promise<void> {
    return new Promise((resolve, reject) => {
        const fileContent = fs.readFileSync(filePath);
        const options = {
            hostname: 'storage.bunnynet.com',
            path: `/${zoneName}/${destPath}`,
            method: 'PUT',
            headers: {
                AccessKey: apiKey,
                'Content-Type': 'image/svg+xml',
                'Content-Length': fileContent.length,
            },
        };
        const req = https.request(options, res => {
            if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                resolve();
            } else {
                reject(new Error(`Bunny upload failed: HTTP ${res.statusCode}`));
            }
        });
        req.on('error', reject);
        req.write(fileContent);
        req.end();
    });
}

/* ── Main ─────────────────────────────────────────────────────────────────── */

async function main() {
    fs.mkdirSync(OUT, { recursive: true });

    const bunnyZone = process.env.BUNNY_ZONE;
    const bunnyKey  = process.env.BUNNY_KEY;
    const bunnyHost = process.env.BUNNY_HOST; // e.g. https://nitg.b-cdn.net

    const useBunny = !!(bunnyZone && bunnyKey && bunnyHost);
    console.log(useBunny
        ? `\nMode: Generate + Upload to Bunny.net (${bunnyZone})\n`
        : '\nMode: Generate only (no Bunny credentials) — will use /blog/ public path\n');

    let done = 0;
    for (const a of articles) {
        const filename = `${a.slug}.svg`;
        const localPath = path.join(OUT, filename);

        // 1. Generate SVG file
        const content = svg(a.accent, a.icon, a.label);
        fs.writeFileSync(localPath, content, 'utf-8');

        // 2. Determine final image URL
        let imgUrl: string;
        if (useBunny) {
            const destPath = `blog/${filename}`;
            try {
                await uploadToBunny(bunnyZone!, bunnyKey!, localPath, destPath);
                imgUrl = `${bunnyHost!.replace(/\/$/, '')}/blog/${filename}`;
                console.log(`✅ Uploaded: ${filename} → ${imgUrl}`);
            } catch (err: any) {
                console.error(`❌ Upload failed for ${filename}: ${err.message}`);
                imgUrl = `/blog/${filename}`; // fallback to local
            }
        } else {
            imgUrl = `/blog/${filename}`;
            console.log(`💾 Saved: ${filename}`);
        }

        // 3. Update database (skip silently if DB is unreachable — run on server)
        try {
            await prisma.article.update({
                where: { id: a.id },
                data: { img: imgUrl },
            });
        } catch {
            console.log(`   ⚠️  DB update skipped (run on server): ${a.id}`);
        }

        done++;
    }

    console.log(`\n✅ Done — ${done} images generated & DB updated.\n`);
    if (!useBunny) {
        console.log('To upload to Bunny.net, run:');
        console.log('  BUNNY_ZONE=yourzone BUNNY_KEY=yourapikey BUNNY_HOST=https://yourhost.b-cdn.net \\');
        console.log('  npx ts-node --compiler-options \'{"module":"CommonJS"}\' scripts/generateBlogImages.ts\n');
    }
}

main()
    .catch(console.error)
    .finally(() => prisma.$disconnect());

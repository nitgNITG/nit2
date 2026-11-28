import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// Service pages moved from /<locale>/<slug> to /<locale>/our-services/<slug>.
// Permanent (301/308) redirects preserve existing Google rankings & backlinks.
const MOVED_SERVICE_SLUGS = ['moodle-lms', 'ecommerce-app', 'delivery-app', 'restaurant-app', 'loyalty-app'];

/** @type {import('next').NextConfig} */
const nextConfig = {
    // The secondary MySQL Prisma client (node_modules/prismamysql) ships a native
    // query engine — keep it out of the webpack bundle/trace so `next build` doesn't
    // walk into it (which broke the Windows build) and Vercel copies it whole.
    experimental: {
        serverComponentsExternalPackages: ['prismamysql'],
    },
    async redirects() {
        return [
            ...MOVED_SERVICE_SLUGS.map((slug) => ({
                source: `/:locale(ar|en)/${slug}`,
                destination: `/:locale/our-services/${slug}`,
                permanent: true,
            })),
            // Article content links to /contact-us, which never existed (404).
            { source: '/:locale(ar|en)/contact-us', destination: '/:locale/contact', permanent: true },
        ];
    },
    // dev.nitg-eg.com runs the dev copy (nit2) and was being indexed next to the real
    // site. A noindex header (not a robots.txt Disallow, which would hide the noindex
    // from Google) keeps it out. Matches only that exact host, so www / the apex / the
    // academy subdomains are never affected — even behind a proxy that rewrites Host.
    async headers() {
        return [
            {
                source: '/:path*',
                has: [{ type: 'host', value: 'dev\\.nitg-eg\\.com' }],
                headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }],
            },
        ];
    },
    async rewrites() {
        return [
            {
                source: '/isharat-api/:path*',
                destination: 'https://apis.isharat.net/:path*',
            },
        ];
    },
    images: {
        // Serve AVIF first (50% smaller than WebP), fallback to WebP, then original
        formats: ['image/avif', 'image/webp'],

        // Standard responsive breakpoints
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

        // Allow SVG files (used for blog article header images)
        dangerouslyAllowSVG: true,
        contentDispositionType: 'inline',

        // Cache optimized images for 30 days (default is 60 seconds)
        minimumCacheTTL: 60 * 60 * 24 * 30,

        remotePatterns: [
            {
                protocol: 'https',
                hostname: 'res.cloudinary.com',
            },
            {
                protocol: 'https',
                hostname: 'storage.googleapis.com',
            },
        ],
    },
};

export default withNextIntl(nextConfig);

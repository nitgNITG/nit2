import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

// Service pages moved from /<locale>/<slug> to /<locale>/our-services/<slug>.
// Permanent (301/308) redirects preserve existing Google rankings & backlinks.
const MOVED_SERVICE_SLUGS = ['moodle-lms', 'ecommerce-app', 'delivery-app', 'restaurant-app', 'loyalty-app'];

/** @type {import('next').NextConfig} */
const nextConfig = {
    async redirects() {
        return MOVED_SERVICE_SLUGS.map((slug) => ({
            source: `/:locale(ar|en)/${slug}`,
            destination: `/:locale/our-services/${slug}`,
            permanent: true,
        }));
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

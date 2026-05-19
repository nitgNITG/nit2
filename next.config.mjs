import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Serve AVIF first (50% smaller than WebP), fallback to WebP, then original
        formats: ['image/avif', 'image/webp'],

        // Standard responsive breakpoints
        deviceSizes: [640, 750, 828, 1080, 1200, 1920],
        imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],

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

import { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: 'N.I.T Egypt — National Software Engineering',
        short_name: 'N.I.T Egypt',
        description:
            'Moodle LMS & eCommerce app development for Egypt and the Gulf since 2013.',
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: '#0B2923',
        icons: [
            {
                src: '/logo.svg',
                sizes: 'any',
                type: 'image/svg+xml',
            },
        ],
    }
}

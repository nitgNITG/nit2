import { getLocale } from 'next-intl/server'

const BASE_URL = 'https://nitg-eg.com'

export type Crumb = {
    /** Path segment after the locale, e.g. "moodle-lms" or "blog/my-article". Empty for home. */
    path: string
    ar: string
    en: string
}

// Emits BreadcrumbList JSON-LD so Google/AI engines understand the page's
// position in the site hierarchy and can show breadcrumb rich results.
// "Home" is always prepended automatically.
export default async function BreadcrumbsJsonLd({ items }: { items: Crumb[] }) {
    const locale = await getLocale()
    const isAr = locale === 'ar'

    const crumbs: Crumb[] = [
        { path: '', ar: 'الرئيسية', en: 'Home' },
        ...items,
    ]

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'BreadcrumbList',
        itemListElement: crumbs.map((c, i) => ({
            '@type': 'ListItem',
            position: i + 1,
            name: isAr ? c.ar : c.en,
            item: `${BASE_URL}/${locale}${c.path ? `/${c.path}` : ''}`,
        })),
    }

    return (
        <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    )
}

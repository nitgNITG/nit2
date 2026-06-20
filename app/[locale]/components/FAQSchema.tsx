import { getLocale } from 'next-intl/server'
import { FAQS, type FAQPageKey } from '@/lib/faqData'

// Emits FAQPage JSON-LD. The same Q&A is rendered visibly by FAQSection.tsx,
// so the structured data always matches the on-page content.
export default async function FAQSchema({ page }: { page: FAQPageKey }) {
    const locale = await getLocale()
    const faqs = FAQS[page][locale === 'ar' ? 'ar' : 'en']

    const schema = {
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        mainEntity: faqs.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: {
                '@type': 'Answer',
                text: a,
            },
        })),
    }

    return (
        <script
            type='application/ld+json'
            dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
    )
}

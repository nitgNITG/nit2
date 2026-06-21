import { getLocale } from 'next-intl/server'
import { FAQS, type FAQPageKey } from '@/lib/faqData'

// Visible FAQ accordion. Renders the SAME questions/answers as FAQSchema.tsx
// so the FAQPage structured data is backed by real, user-visible content
// (required for valid rich results and useful for AI/GEO citation).
// Uses native <details>/<summary> → fully server-rendered, zero client JS.
export default async function FAQSection({ page }: { page: FAQPageKey }) {
    const locale = await getLocale()
    const isAr = locale === 'ar'
    const faqs = FAQS[page][isAr ? 'ar' : 'en']

    return (
        <section
            dir={isAr ? 'rtl' : 'ltr'}
            className='p-container py-14 lg:py-20'
            aria-labelledby='faq-heading'
        >
            <div className={`mb-8 ${isAr ? 'text-right' : 'text-left'}`}>
                <span className='inline-block bg-[#1E7D67]/10 border border-[#1E7D67]/30 text-[#1E7D67] text-xs font-bold px-4 py-1.5 rounded-full mb-4 tracking-wider uppercase'>
                    {isAr ? 'الأسئلة الشائعة' : 'FAQ'}
                </span>
                <h2
                    id='faq-heading'
                    className='text-2xl md:text-3xl font-bold text-[#0B2923]'
                >
                    {isAr ? 'أسئلة شائعة' : 'Frequently Asked Questions'}
                </h2>
            </div>

            <div className='max-w-3xl space-y-3'>
                {faqs.map(({ q, a }, i) => (
                    <details
                        key={i}
                        className='group bg-white border border-gray-100 rounded-xl shadow-sm overflow-hidden'
                    >
                        <summary
                            className={`flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-bold text-gray-900 text-base lg:text-lg ${isAr ? 'text-right' : 'text-left'}`}
                        >
                            <span>{q}</span>
                            <span
                                className='flex-shrink-0 text-[#1E7D67] text-xl transition-transform duration-300 group-open:rotate-45'
                                aria-hidden='true'
                            >
                                +
                            </span>
                        </summary>
                        <div
                            className={`px-5 pb-5 text-gray-600 text-base leading-relaxed ${isAr ? 'text-right' : 'text-left'}`}
                        >
                            {a}
                        </div>
                    </details>
                ))}
            </div>
        </section>
    )
}

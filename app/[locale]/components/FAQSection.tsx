import { getLocale } from 'next-intl/server'
import { FAQS, type FAQPageKey } from '@/lib/faqData'
import LocaleLink from './LocaleLink'

// Visible FAQ accordion. Renders the SAME questions/answers as FAQSchema.tsx
// so the FAQPage structured data is backed by real, user-visible content
// (required for valid rich results and useful for AI/GEO citation).
// Uses native <details>/<summary> → fully server-rendered, zero client JS.
//
// Layout: the accordion is paired with a sticky "still have a question?" CTA
// card that fills the space beside the (max-width) question list and gives
// readers who didn't find their answer a direct way to reach the team.
export default async function FAQSection({ page }: { page: FAQPageKey }) {
    const locale = await getLocale()
    const isAr = locale === 'ar'
    const faqs = FAQS[page][isAr ? 'ar' : 'en']

    const waHref =
        'https://wa.me/201091568240?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D8%8C%20%D8%A3%D8%B1%D9%8A%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D8%B4%D8%B1%D9%88%D8%B9%D9%8A'

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

            <div className='grid lg:grid-cols-12 gap-8 lg:gap-12 items-start'>
                {/* Questions */}
                <div className='lg:col-span-7 space-y-3'>
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

                {/* "Still have a question?" CTA — fills the space beside the list */}
                <aside className='lg:col-span-5'>
                    <div className='lg:sticky lg:top-24 rounded-2xl bg-gradient-to-br from-[#0B2923] to-[#1E7D67] p-7 lg:p-8 text-white shadow-xl overflow-hidden relative'>
                        {/* subtle diamond accent */}
                        <div className='absolute -top-8 -left-8 w-28 h-28 opacity-10 pointer-events-none'>
                            <div className='absolute inset-0 rotate-45 rounded-xl border-2 border-[#00FFCD]' />
                        </div>

                        <div className='relative'>
                            <span className='inline-flex items-center justify-center w-12 h-12 rounded-full bg-[#00FFB2]/15 text-[#00FFB2] ring-1 ring-[#00FFB2]/30'>
                                <svg width='24' height='24' viewBox='0 0 24 24' fill='none' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' aria-hidden='true'>
                                    <path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z' />
                                    <path d='M9.5 9a2.5 2.5 0 1 1 3 2.5c-.7.3-1 .8-1 1.5' />
                                    <line x1='12' y1='16' x2='12' y2='16' />
                                </svg>
                            </span>

                            <h3 className='text-xl lg:text-2xl font-bold mt-4'>
                                {isAr ? 'لا تزال لديك سؤال؟' : 'Still have a question?'}
                            </h3>
                            <p className='text-white/80 text-sm lg:text-base leading-relaxed mt-3'>
                                {isAr
                                    ? 'تواصل مع فريقنا وسنجيبك خلال 24 ساعة ونساعدك في اختيار الحل المناسب لمشروعك.'
                                    : 'Reach out to our team — we reply within 24 hours and help you choose the right solution for your project.'}
                            </p>

                            <div className='mt-6 flex flex-col gap-3'>
                                <LocaleLink
                                    href='/contact'
                                    className='block text-center bg-[#00FFB2] text-[#0B2923] font-bold px-5 py-3 rounded-lg hover:opacity-90 transition-opacity'
                                >
                                    {isAr ? 'تواصل معنا' : 'Contact us'}
                                </LocaleLink>
                                <a
                                    href={waHref}
                                    target='_blank'
                                    rel='noreferrer'
                                    className='flex items-center justify-center gap-2 text-center border border-white/30 text-white font-semibold px-5 py-3 rounded-lg hover:bg-white/10 transition-colors'
                                >
                                    💬 {isAr ? 'استشارة واتساب' : 'Chat on WhatsApp'}
                                </a>
                            </div>
                        </div>
                    </div>
                </aside>
            </div>
        </section>
    )
}

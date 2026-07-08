import { getLocale } from 'next-intl/server'
import Image from 'next/image'

const LOGOS = [
    { file: 'telecom.png',   ar: 'وزارة الاتصالات',        en: 'Ministry of Communications' },
    { file: 'education.png', ar: 'وزارة التربية والتعليم', en: 'Ministry of Education' },
    { file: 'labour.png',    ar: 'وزارة القوى العاملة',    en: 'Ministry of Labour' },
    { file: 'dar-ifta.png',  ar: 'دار الإفتاء المصرية',    en: 'Dar Al-Ifta Egypt' },
    { file: 'aic.png',       ar: 'مركز AIC',                en: 'AIC' },
    { file: 'undp.png',      ar: 'برنامج الأمم المتحدة',   en: 'UNDP' },
    { file: 'aoi.png',       ar: 'هيئة العربية للتصنيع',   en: 'AOI' },
    { file: 'ilo.svg',       ar: 'منظمة العمل الدولية',    en: 'ILO' },
]

export default async function TrustedByStrip() {
    const locale = await getLocale()
    const isAr = locale === 'ar'

    return (
        <div className='bg-white border-b border-gray-100 shadow-sm'>
            <div className='p-container py-5'>
                <div className={`flex flex-wrap items-center gap-x-5 gap-y-4 ${isAr ? 'flex-row-reverse' : ''}`}>

                    {/* Label */}
                    <div className={`flex items-center gap-2 flex-shrink-0 ${isAr ? 'flex-row-reverse' : ''}`}>
                        <span className='inline-block w-2 h-2 rounded-full bg-[#1E7D67]' />
                        <span className='text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap'>
                            {isAr ? 'موثوق من قِبَل' : 'Trusted by'}
                        </span>
                    </div>

                    {/* Divider */}
                    <div className='hidden sm:block w-px h-8 bg-gray-200 flex-shrink-0' />

                    {/* Logos */}
                    <div className={`flex flex-wrap items-center gap-3 sm:gap-4 lg:gap-5 flex-1 min-w-0 ${isAr ? 'flex-row-reverse justify-end' : 'justify-start'}`}>
                        {LOGOS.map((logo) => (
                            <div
                                key={logo.file}
                                title={isAr ? logo.ar : logo.en}
                                className='group flex-shrink-0 flex items-center justify-center bg-white rounded-lg border border-gray-100 hover:border-[#1E7D67]/30 hover:shadow-md transition-all duration-300'
                                style={{ width: 88, height: 50, padding: '6px 10px' }}
                            >
                                <Image
                                    src={`/trusted/${logo.file}`}
                                    alt={isAr ? logo.ar : logo.en}
                                    width={88}
                                    height={50}
                                    loading="lazy"
                                    className='max-w-full max-h-full w-auto h-auto object-contain grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all duration-300'
                                />
                            </div>
                        ))}
                    </div>

                    {/* Gov badge — end of row, large screens only */}
                    <div className={`${isAr ? 'mr-auto' : 'ml-auto'} flex-shrink-0 hidden xl:block`}>
                        <span className='text-xs bg-[#1E7D67]/10 text-[#1E7D67] border border-[#1E7D67]/20 font-semibold px-3 py-1 rounded-full whitespace-nowrap'>
                            {isAr ? '🏛️ شريك حكومي موثوق منذ 2013' : '🏛️ Trusted Government Partner since 2013'}
                        </span>
                    </div>

                </div>
            </div>
        </div>
    )
}

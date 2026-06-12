/* eslint-disable @next/next/no-img-element */
import { getLocale } from 'next-intl/server'

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
        <div className='bg-[#f8faf9] border-b border-gray-200'>
            <div className='p-container py-6'>

                {/* Label */}
                <p className={`text-xs font-bold text-gray-400 uppercase tracking-widest mb-5 ${isAr ? 'text-right' : 'text-left'}`}>
                    {isAr ? 'موثوق من قِبَل' : 'Trusted by'}
                </p>

                {/* Logos grid */}
                <div className={`flex flex-wrap items-center justify-center gap-4 sm:gap-6`}>
                    {LOGOS.map((logo) => (
                        <div
                            key={logo.file}
                            title={isAr ? logo.ar : logo.en}
                            className='flex items-center justify-center bg-white rounded-xl shadow-sm hover:shadow-md transition-shadow duration-300'
                            style={{ width: 110, height: 64, padding: '10px 14px' }}
                        >
                            <img
                                src={`/trusted/${logo.file}`}
                                alt={isAr ? logo.ar : logo.en}
                                className='w-full h-full object-contain'
                            />
                        </div>
                    ))}
                </div>

            </div>
        </div>
    )
}

'use client'
import { useLocale } from 'next-intl';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LangSwitcher = () => {
    const locale = useLocale();
    const pathname = usePathname();

    const getNewPathname = (newLocale: string) => {
        const newPath = pathname.replace(/^\/(en|ar)/, '');
        return `/${newLocale}${newPath}`;
    };

    // Show the opposite locale as the switch target
    const targetLocale = locale === 'ar' ? 'en' : 'ar';
    const label = locale === 'ar' ? 'EN' : 'ع';

    return (
        <Link
            href={getNewPathname(targetLocale)}
            className='border px-3 py-2 rounded-md text-sm font-bold hover:bg-gray-50 transition-colors'
            title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        >
            {label}
        </Link>
    );
};

export default LangSwitcher;

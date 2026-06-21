'use client'
import { useLocale } from 'next-intl';
import { usePathname, useRouter } from '../../../navigation';
import React, { useTransition } from 'react';

const LangSwitcher = () => {
    const locale = useLocale();
    const router = useRouter();
    const pathname = usePathname();
    const [isPending, startTransition] = useTransition();

    // Show the opposite locale as the switch target
    const targetLocale = locale === 'ar' ? 'en' : 'ar';
    const label = locale === 'ar' ? 'EN' : 'ع';

    const onSelectChange = () => {
        startTransition(() => {
            router.replace(pathname, { locale: targetLocale });
        });
    };

    return (
        <button
            onClick={onSelectChange}
            disabled={isPending}
            className='border px-3 py-2 rounded-md text-sm font-bold hover:bg-gray-50 transition-colors'
            title={locale === 'ar' ? 'Switch to English' : 'التبديل إلى العربية'}
        >
            {label}
        </button>
    );
};

export default LangSwitcher;

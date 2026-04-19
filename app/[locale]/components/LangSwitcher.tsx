'use client'
import { useLocale } from 'next-intl';
import React, { useState } from 'react';
import { ArrowDownIcon } from './icons';
import Link from 'next/link';
import useClickOutside from '../hook/useClickOutSide';
import { usePathname } from 'next/navigation';

const LangSwitcher = () => {
    const locale = useLocale();
    const [open, setOpen] = useState(false);
    const pathname = usePathname();

    const close = () => {
        setOpen(false);
    };

    const ref = useClickOutside(close, open);

    const getNewPathname = (newLocale: string) => {
        let newPathname = pathname.replace(/^\/(en|ar)/, '');
        return `/${newLocale}${newPathname}`;
    };

    return (
        <div ref={ref} className='relative'>
            <button onClick={() => setOpen(!open)} className='border p-[10px] rounded-md flex items-center'>
                <ArrowDownIcon className='size-4' />
                <span className='text-sm'>{locale?.toUpperCase()}</span>
            </button>
            {open && (
                <ul className='absolute top-10 w-full bg-white rounded-md shadow overflow-hidden'>
                    <li className={`${locale === 'ar' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>
                        <Link href={getNewPathname('ar')} className='block w-full text-center py-2 text-sm'>
                            AR
                        </Link>
                    </li>
                    <li className={`${locale === 'en' ? 'bg-blue-500 text-white' : 'hover:bg-gray-100'}`}>
                        <Link href={getNewPathname('en')} className='block w-full text-center py-2 text-sm'>
                            EN
                        </Link>
                    </li>
                </ul>
            )}
        </div>
    );
};

export default LangSwitcher;

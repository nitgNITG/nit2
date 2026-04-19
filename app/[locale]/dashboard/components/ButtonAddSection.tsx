'use client';
import { usePathname } from 'next/navigation';
import React from 'react'
import LocaleLink from '../../components/LocaleLink';

const ButtonAddSection = () => {
    const pathname = usePathname()
    return (
        <LocaleLink href={`${pathname}?formSection=true`}
            onClick={() => {
                document.body.style.overflow = 'hidden'
            }}
            className='bg-blue-500 text-white px-5 py-2 rounded-md uppercase'>
            Add section
        </LocaleLink>
    )
}

export default ButtonAddSection
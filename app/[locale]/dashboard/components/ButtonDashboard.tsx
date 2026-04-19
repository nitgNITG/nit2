'use client'
import React from 'react'
import LocaleLink from '../../components/LocaleLink'

const ButtonDashboard = ({ children, href }: { children: React.ReactNode, href: string }) => {
    return (
        <LocaleLink href={href}
            onClick={() => {
                document.body.style.overflow = 'hidden'
            }}
            className='bg-blue-500 text-white px-5 py-2 rounded-md uppercase'>
            {children}
        </LocaleLink>
    )
}

export default ButtonDashboard
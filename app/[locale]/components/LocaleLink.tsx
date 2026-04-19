'use client'
import { useLocale } from 'next-intl'
import Link from 'next/link'
import React from 'react'

const LocaleLink = ({
    children,
    href,
    target,
    className,
    onClick
}: {
    children: React.ReactNode,
    href: string,
    target?: string,
    className?: string,
    onClick?: () => void,
}) => {
    const locale = useLocale()
    return (
        <Link
            href={`/${locale}${href}`}
            locale={locale}
            target={target}
            className={className || ""}
            onClick={onClick}
        >
            {children}
        </Link>
    )
}

export default LocaleLink
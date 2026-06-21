'use client'
import React from 'react'
import { Link } from '../../../navigation'

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
    return (
        <Link
            href={href as any}
            target={target}
            className={className || ""}
            onClick={onClick}
        >
            {children}
        </Link>
    )
}

export default LocaleLink
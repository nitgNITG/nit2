import React from 'react'
import { FacebookIcon, LinkedInIcon, ShareIcon, WhatSappIcon, XSocialIcon } from './icons'
import Link from 'next/link'

const SocialMedia = () => {
    const socailMedia = [
        {
            id: 2,
            icon: <FacebookIcon className='size-8 stroke-white fill-white' />,
            href: "https://www.facebook.com/successAcdmy?mibextid=JRoKGi",
            label: "Facebook"
        },
        {
            id: 3,
            icon: <WhatSappIcon className='size-8 stroke-white fill-white' />,
            href: "https://wa.me/+201091568240",
            label: "WhatsApp"
        },
        {
            id: 4,
            icon: <LinkedInIcon className='size-8 stroke-white fill-white' />,
            href: "https://www.linkedin.com/company/the-national-company-for-sw-engineering-and-information-technology---nit/",
            label: "LinkedIn"
        },
    ]
    return (
        <div className='fixed right-7 bottom-20 md:bottom-24 z-[999] hidden sm:block'>
            {/* The links open to the LEFT of the share button: the AI chat launcher sits right above it. */}
            <div className='group relative transition duration-200'>
                <div className='absolute bottom-0 right-full hidden group-hover:flex group-focus-within:flex flex-row-reverse gap-2 pr-3'>
                    {socailMedia.map((socail => {
                        return (
                            <Link href={socail.href} target='_blank' key={socail.id} aria-label={socail.label} className='bg-gradient-to-l from-[#1E7D67] to-[#0B2923] size-14 flex justify-center items-center rounded-full cursor-pointer'>
                                {socail.icon}
                            </Link>
                        )
                    }))}
                </div>
                <div className='bg-gradient-to-l from-[#1E7D67] to-[#0B2923] size-14 flex justify-center items-center rounded-full cursor-pointer'>
                    <ShareIcon />
                </div>
            </div>
        </div>
    )
}

export default SocialMedia
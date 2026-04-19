import React from 'react'
import { FacebookIcon, LinkedInIcon, ShareIcon, WhatSappIcon, XSocialIcon } from './icons'
import Link from 'next/link'

const SocialMedia = () => {
    const socailMedia = [
        {
            id: 2,
            icon: <FacebookIcon className='size-8 stroke-white fill-white' />,
            href: "https://www.facebook.com/successAcdmy?mibextid=JRoKGi"
        },
        {
            id: 3,
            icon: <WhatSappIcon className='size-8 stroke-white fill-white' />,
            href: "https://wa.me/+201091568240"
        },
        {
            id: 4,
            icon: <LinkedInIcon className='size-8 stroke-white fill-white' />,
            href: "https://www.linkedin.com/company/the-national-company-for-sw-engineering-and-information-technology---nit/"
        },
    ]
    return (
        <div className='fixed right-10 bottom-10 md:bottom-14 z-[999] hidden sm:block'>
            <div className='group space-y-3 transition duration-200'>
                <div className='hidden group-hover:block space-y-2'>
                    {socailMedia.map((socail => {
                        return (
                            <Link href={socail.href} target='_blank' key={socail.id} className='bg-gradient-to-l from-[#268F79] to-[#0B2923] size-14 flex justify-center items-center rounded-full cursor-pointer'>
                                {socail.icon}
                            </Link>
                        )
                    }))}
                </div>
                <div className='bg-gradient-to-l from-[#268F79] to-[#0B2923] size-14 flex justify-center items-center rounded-full cursor-pointer'>
                    <ShareIcon />
                </div>
            </div>
        </div>
    )
}

export default SocialMedia
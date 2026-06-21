import React from 'react'
import { LinkedInIcon, PhoneRingIcon, WhatSappIcon } from './icons'
import Link from 'next/link'

const DownSide = () => {
    const socailMedia = [
        {
            id: 4,
            icon: <LinkedInIcon className='size-8 stroke-blue-600 fill-blue-600' />,
            href: "https://www.linkedin.com/company/the-national-company-for-sw-engineering-and-information-technology---nit/",
            label: "LinkedIn"
        },
        {
            id: 3,
            icon: <WhatSappIcon className='size-8 stroke-green-500 fill-green-500' />,
            href: "https://wa.me/+201091568240",
            label: "WhatsApp"
        },
        {
            id: 1,
            icon: <PhoneRingIcon className='size-8 stroke-black fill-black' />,
            href: "tel:+201091568240",
            label: "اتصل بنا"
        },
    ]
    return (
        <div className='w-full fixed bottom-0 bg-white z-[999] sm:hidden border-t-2'>
            <div className='flex'>
                {
                    socailMedia.map((item) => {
                        return (
                            <Link className='w-full flex justify-center items-center py-3 hover:bg-black/20 duration-200' key={item.id} href={item.href} aria-label={item.label}>
                                {item.icon}
                            </Link>
                        )
                    })
                }
            </div>
        </div>
    )
}

export default DownSide
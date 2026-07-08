import React from 'react'
import ContactForm from './ContactForm'
import { EmailIcon, LocationIcon, PhoneIcon, WhatsappIcon } from './icons'
import { useTranslations } from 'next-intl'

const Contact = () => {
    const t = useTranslations('contact');
    const contacts = [
        {
            id: 1,
            icon: <PhoneIcon />,
            text: t('item1'),
            desc: "201091568240 - 201149830855",
        },
        {
            id: 1,
            icon: <LocationIcon />,
            text: t('item3.title'),
            desc: t('item3.desc'),
        },
        {
            id: 1,
            icon: <WhatsappIcon />,
            text: t('item4'),
            desc: "201091568240 - 201149830855",
        },
    ]
    return (
        <section className='p-container py-10'>
            <div className='grid grid-cols-12 space-y-10 lg:space-y-0 lg:gap-20 mt-10 lg:mt-20'>
                <div className='col-span-12 lg:col-span-6'>
                    <div className='flex flex-col gap-10 justify-end'>
                        <div className='flex flex-col items-end'>
                            <div>
                                <span className='text-6xl' role='img' aria-label='تواصل مع فريق تطوير شركة NIT'>📞</span>
                            </div>
                            <div>
                                <span className='text-xl lg:text-2xl font-bold text-[#1E7D67]'>{t('hint')}</span>
                            </div>
                        </div>
                        <div className='space-y-5'>
                            {
                                contacts.map((con, index) => {
                                    return (
                                        <div className='' key={con.id}>
                                            <div className='flex justify-end items-center gap-5'>
                                                <div>
                                                    <h6 className='text-lg font-semibold'>{con.text}</h6>
                                                    <h5 className='text-lg font-bold'>{con.desc}</h5>
                                                </div>
                                                <div>
                                                    {con.icon}
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })
                            }
                        </div>
                    </div>
                </div>
                <div className='col-span-12 lg:col-span-6'>
                    <ContactForm />
                </div>
            </div>
        </section>
    )
}

export default Contact
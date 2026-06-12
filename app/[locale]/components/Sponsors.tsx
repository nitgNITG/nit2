/* eslint-disable @next/next/no-img-element */
'use client'
import React, { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import sponsersImg from '../../assets/sponsors.webp'
import Marquee from 'react-fast-marquee'
import axios from 'axios'

const Sponsors = () => {
    const [sponsors, setSponsors] = useState<any[]>([])

    const fetchSponsors = useCallback(async () => {
        try {
            const { data } = await axios.get('/api/sponser')
            if (Array.isArray(data.sponsers)) {
                setSponsors(data.sponsers)
            }
        } catch (error: any) {
            console.error('[Sponsors] fetch error:', error.message)
        }
    }, [])

    useEffect(() => {
        fetchSponsors()
    }, [fetchSponsors])

    return (
        <section>
            {/* ── Marquee strip ── */}
            <div className='bg-gradient-to-l from-[#268F79] to-[#0B2923]'>
                <div dir='ltr' style={{ height: 120, display: 'flex', alignItems: 'center' }}>
                    {sponsors.length === 0 ? (
                        // Keep height even when empty so the green strip shows
                        <div style={{ width: '100%' }} />
                    ) : (
                        <Marquee direction='right' speed={40} gradient={false}>
                            {sponsors.map((sponsor: any) => (
                                <div
                                    key={sponsor.id}
                                    style={{
                                        background: '#ffffff',
                                        borderRadius: 16,
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.15)',
                                        width: 130,
                                        height: 80,
                                        margin: '0 20px',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        padding: '10px 14px',
                                        flexShrink: 0,
                                    }}
                                >
                                    <img
                                        src={sponsor.img}
                                        alt='Sponsor logo'
                                        style={{
                                            width: '100%',
                                            height: '100%',
                                            objectFit: 'contain',
                                        }}
                                    />
                                </div>
                            ))}
                        </Marquee>
                    )}
                </div>
            </div>

            {/* ── Static sponsors image below ── */}
            <div className='p-container bg-[#F2F3FA] pt-10 lg:pt-20'>
                <div className='w-full'>
                    <Image
                        src={sponsersImg}
                        alt='NIT Sponsors'
                        loading='lazy'
                        placeholder='blur'
                        quality={85}
                        sizes='(max-width: 768px) 100vw, 90vw'
                        height={1500}
                        width={1500}
                        className='w-full object-contain'
                    />
                </div>
            </div>
        </section>
    )
}

export default Sponsors

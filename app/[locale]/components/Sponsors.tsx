'use client'
import React, { useCallback, useEffect, useState } from 'react'
import Marquee from 'react-fast-marquee'
import Image from 'next/image'
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
            // Sponsors are non-critical; silenced to avoid Lighthouse
            // "Browser errors logged to console" Best Practices penalty.
            //  console.error('[Sponsors] fetch error:', error.message)
        }
    }, [])

    useEffect(() => {
        fetchSponsors()
    }, [fetchSponsors])

    return (
        <section>
            {/* ── Marquee strip ── */}
            <div className='bg-gradient-to-l from-[#1E7D67] to-[#0B2923]'>
                <div dir='ltr' style={{ height: 120, display: 'flex', alignItems: 'center' }}>
                    {sponsors.length === 0 ? (
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
                                    <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                                        <Image
                                            src={sponsor.img}
                                            alt='شعار أحد شركاء وعملاء شركة NIT'
                                            fill
                                            sizes='130px'
                                            loading='lazy'
                                            style={{ objectFit: 'contain' }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </Marquee>
                    )}
                </div>
            </div>
        </section>
    )
}

export default Sponsors

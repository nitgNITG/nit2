// import Image from 'next/image'
// import React, { useCallback, useEffect, useState } from 'react'
// import sponsersImg from '../../assets/sponsors.png'
// import Marquee from 'react-fast-marquee'
// import axios from 'axios'

// const Sponsors = async () => {
//     const fetchSponsors = async () => {
//         try {
//             const res = await fetch(`${process.env.BASE_URL}/api/sponser`, {
//                 method: "GET",
//             });
//             if (!res.ok) {
//                 console.error(`Error: ${res.status} ${res.statusText}`);
//             }
//             const data = await res.json();
//             return data.sponsers;
//         } catch (error) {
//             console.error('Fetch failed:', error);
//         }
//     }
//     const sponsers = await fetchSponsors()
//     return (
//         <section>
//             <div className='bg-gradient-to-l from-[#268F79] to-[#0B2923]'>
//                 <div className='h-44'>
//                     <Marquee direction='right' className='py-10 '>
//                         {
//                             sponsers?.reverse()?.map((sponsor: any) => (
//                                 <div className='mx-5 sm:mx-10 md:mx-16 lg:mx-28 h-full flex items-center' key={sponsor.id}>
//                                     <Image
//                                         src={sponsor.img}
//                                         alt=''
//                                         height={100}
//                                         width={100}
//                                         className=''
//                                     />
//                                 </div>
//                             ))
//                         }
//                     </Marquee>
//                 </div>
//             </div>
//             <div className='p-container bg-[#F2F3FA] pt-10 lg:pt-20'>
//                 <div className=' bg-[url("/bg_logo.png")] bg-center bg-no-repeat bg-contain'>
//                     <div className='w-full'>
//                         <Image
//                             src={sponsersImg}
//                             alt=''
//                             height={1500}
//                             width={1500}
//                             className='w-full object-contain'
//                         />
//                     </div>
//                 </div>
//             </div>
//         </section>
//     )
// }

// export default Sponsors
'use client'
import Image from 'next/image'
import React, { useCallback, useEffect, useState } from 'react'
import sponsersImg from '../../assets/sponsors.png'
import Marquee from 'react-fast-marquee'
import axios from 'axios'
import { cloudinaryOptimized } from '@/utils/cloudinaryUrl'

const Sponsors = () => {
    const [sponsors, setSponsers] = useState([])
    const fetchsponsers = useCallback(
        async () => {
            try {
                const { data } = await axios.get('/api/sponser')
                setSponsers(data.sponsers)
            } catch (error: any) {
                return { error: error.message, data: null }
            }
        }, []
    )
    useEffect(() => {
        fetchsponsers()
    }, [fetchsponsers])
    return (
        <section>
            <div className='bg-gradient-to-l from-[#268F79] to-[#0B2923]'>
                {/* <div className='p-container grid grid-cols-12 py-10  space-y-10 sm:space-y-0 sm:gap-5'>
                    {
                        sponsors.reverse().map(sponsor => (
                            <div className='col-span-12 sm:col-span-6 md:col-span-4 lg:col-span-3 xl:col-span-2 w-full flex justify-center' key={sponsor.id}>
                                <Image
                                    src={sponsor.img}
                                    alt=''
                                    height={100}
                                    width={100}
                                    className=''
                                />
                            </div>
                        ))
                    }
                </div> */}
                <div dir='ltr'>
                    <div className='h-44'>
                        <Marquee direction='right' className='py-10 '>
                            {
                                sponsors.reverse().map((sponsor: any) => (
                                    <div className='mx-5 sm:mx-10 md:mx-16 lg:mx-28 h-full flex items-center' key={sponsor.id}>
                                        <Image
                                            src={cloudinaryOptimized(sponsor.img, 100)}
                                            alt='Sponsor logo'
                                            height={100}
                                            width={100}
                                            quality={80}
                                            sizes="100px"
                                            loading='lazy'
                                            className=''
                                        />
                                    </div>
                                ))
                            }
                        </Marquee>
                    </div>
                </div>
            </div>
            <div className='p-container bg-[#F2F3FA] pt-10 lg:pt-20'>
                <div className='  bg-center bg-no-repeat bg-contain'>
                    <div className='w-full'>
                        <Image
                            src={sponsersImg}
                            alt='NIT Sponsors'
                            loading='lazy'
                            placeholder="blur"
                            quality={85}
                            sizes="(max-width: 768px) 100vw, 90vw"
                            height={1500}
                            width={1500}
                            className='w-full object-contain'
                        />
                    </div>
                </div>
            </div>
        </section>
    )
}

export default Sponsors
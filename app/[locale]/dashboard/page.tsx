'use client'
import axios from 'axios'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'
import { ArrowRight } from '../components/icons'
import { useStore } from '@/lib/zustand'
import LocaleLink from '../components/LocaleLink'

const Dashboard = () => {
    const [loading, setLoading] = useState(false)
    // const [data, setData] = useState([])
    const { dashboard, setDashboard }: any = useStore();
    const fetchData = useCallback(
        async () => {
            try {
                setLoading(true)
                const { data } = await axios.get('/api/dashboard')
                setDashboard(data.data)
                setLoading(false)
            }
            catch (error: any) {
                setLoading(false)
            }
        }, [setDashboard]
    )
    useEffect(() => {
        if (!dashboard?.length) {
            fetchData()
        }
    }, [dashboard?.length, fetchData])
    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className=''>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>
                    Dashboard
                </h4>
            </div>
            <div className='grid grid-cols-12 gap-5'>
                {
                    dashboard?.length
                        ?
                        dashboard.map((item: any) =>
                            <div className='col-span-12 sm:col-span-6 md:col-span-4 border bg-white shadow-md  rounded-lg h-44 flex flex-col justify-between overflow-hidden'
                                key={item.id}
                            >
                                <div className='flex items-center py-2 px-3'>
                                    <h3 className='font-bold text-2xl'>
                                        {item.name} :
                                    </h3>
                                    <div className='px-2'>
                                        <p className='font-bold text-blue-500 text-2xl'>
                                            {item.value}
                                        </p>
                                    </div>
                                </div>
                                <LocaleLink className='flex items-center gap-2 text-blue-500 font-semibold hover:bg-blue-50 py-2 px-3' href={item.link}>
                                    <p>
                                        View All
                                    </p>
                                    <ArrowRight className='size-5' />
                                </LocaleLink>
                            </div>
                        )
                        :
                        Array(5).fill('').map((_, i) =>
                            <div className='col-span-12 sm:col-span-6 md:col-span-4 border bg-slate-100 animate-pulse shadow-md  rounded-lg h-44 flex flex-col justify-between overflow-hidden'
                                key={i}
                            />)
                }
            </div>
        </div>
    )
}

export default Dashboard
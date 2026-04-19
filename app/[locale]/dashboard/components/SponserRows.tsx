/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import DailogDelete from './DailogDelete'
import toast from 'react-hot-toast'

const SponserRows = () => {
    const [sponserId, setSponserId] = useState('')
    const [loading, setLoading] = useState(false)
    const { sponsers, setSponsers, deleteSponser }: any = useStore()
    const fetchsponsers = useCallback(
        async () => {
            try {
                const { data } = await axios.get('/api/sponser')
                setSponsers(data.sponsers)
            } catch (error: any) {
                return { error: error.message, data: null }
            }
        }, [setSponsers]
    )
    useEffect(() => {
        if (!sponsers?.length) {
            fetchsponsers()
        }
    }, [fetchsponsers, sponsers?.length])
    const close = () => {
        setSponserId('')
        document.body.style.overflow = 'auto'
    }

    const handleDelete = async () => {
        try {
            setLoading(true)
            const { data } = await axios.delete(`/api/sponser/${sponserId}`)
            toast.success(data.message as string)
            setLoading(false)
            deleteSponser(sponserId)
            close()
        } catch (error: any) {
            console.error(error);
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }
    return (
        !sponsers.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b ">
                <td scope="row" colSpan={5} className="px-6 py-4 text-center">
                    No sponser Yet
                </td>
            </tr>
            :
            sponsers.map((sponser: any, index: number) =>
                <tr key={sponser.id} className="odd:bg-white even:bg-gray-50 border-b ">
                    <td scope="row" className="px-6 py-4  ">
                        <img
                            src={sponser.img}
                            alt={""}
                            width={100}
                            height={100}
                        />
                    </td>
                    <td className="px-6 py-4">
                        <button
                            onClick={() => {
                                document.body.style.overflow = 'hidden'
                                setSponserId(sponser.id)
                            }}
                            className="font-medium text-red-600 hover:underline">
                            Delete
                        </button>
                        {sponser.id == sponserId && <DailogDelete
                            title='Delete sponser'
                            message='Are you sure to delete this sponser?'
                            close={close}
                            handleDelete={handleDelete}
                            loading={loading}
                        />}
                    </td>
                </tr>
            )
    )
}

export default SponserRows
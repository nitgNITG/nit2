'use client';
import { useStore } from '@/lib/zustand'
import axios from 'axios';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useEffect, useState } from 'react'
import toast from 'react-hot-toast';
import DailogDelete from './DailogDelete';
import LocaleLink from '../../components/LocaleLink';

const ArticleSectionsData = ({ articleId }: { articleId: string }) => {
    const { sections, setSections, setEditSection, deleteSection }: any = useStore();
    const [loading, setLoading] = useState(false)
    const [sectionId, setSectionId] = useState('')
    const pathname = usePathname()
    const fetchSections = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/blog/section?articleId=${articleId}`)
                setSections(data.sections)
            } catch (error) {
                console.error(error);

            }
        }, [articleId, setSections]
    )
    useEffect(() => {
        fetchSections()
    }, [fetchSections])


    const colseDele = () => {
        setSectionId('')
        document.body.style.overflow = 'auto'
    }
    const handleDelete = async () => {
        try {
            setLoading(true)
            const { data } = await axios.delete(`/api/blog/section/${sectionId}`)
            toast.success(data.message as string)
            deleteSection(sectionId)
            colseDele()
            setLoading(false)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
            console.error(error);
        }
    }
    return (
        !sections.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b ">
                <td scope="row" colSpan={5} className="px-6 py-4 text-center">
                    No Sections Yet
                </td>
            </tr>
            :
            sections.map((section: any, index: number) => (
                <tr key={section.id} className="odd:bg-white even:bg-gray-50 border-b ">
                    <td scope="row" className="px-6 py-4  ">
                        {section.title}
                    </td>
                    <td className="px-6 py-4">
                        {section.content}
                    </td>
                    <td className="px-6 py-4">
                        {
                            section?.list?.length ?
                                <ul>
                                    {
                                        section.list.map((li: any, i: number) =>
                                            3 > i ?
                                                <li key={i}>
                                                    <div className='flex gap-1'>
                                                        <span>
                                                            {i + 1} -{" "}
                                                        </span>
                                                        <div>
                                                            <div className='flex font-semibold'>
                                                                <h6 className=''>Title :</h6>
                                                                <span>{li.title}</span>
                                                            </div>
                                                            <div className='flex font-semibold'>
                                                                <h6 className=''>content : </h6>
                                                                <span>{li.content}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </li>
                                                :
                                                <li key={"nest" + i}>...</li>
                                        )
                                    }
                                </ul> :
                                <p>No List Items</p>
                        }
                    </td>
                    <td className="px-6 py-4">
                        <div className='flex gap-2'>
                            <LocaleLink
                                href={`${pathname}?formSection=true`}
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setEditSection(section)
                                }}
                                className="font-medium text-blue-600 hover:underline">
                                Edit
                            </LocaleLink>
                            <button
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setSectionId(section.id)
                                }}
                                className="font-medium text-red-600 hover:underline">
                                Delete
                            </button>
                            {sectionId == section.id &&
                                <DailogDelete
                                    close={colseDele}
                                    loading={loading}
                                    handleDelete={handleDelete}
                                    message='Are you sure to delete this section?'
                                    title='Delete section'
                                />
                            }
                        </div>
                    </td>
                </tr>

            ))
    )
}

export default ArticleSectionsData
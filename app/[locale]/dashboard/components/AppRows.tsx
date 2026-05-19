/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import DeleteProject from './DeleteProject'
import LocaleLink from '../../components/LocaleLink'

const AppRows = () => {
    const [projectId, setProjectId] = useState('')
    const { apps, setEditProject, setApps }: any = useStore()

    const fetchApps = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/project?type=ecommerce&dashboard=true`)
            setApps(data.data)
        } catch (error: any) {
            console.error('[AppRows] fetch error:', error)
        }
    }, [setApps])

    useEffect(() => {
        if (!apps?.length) fetchApps()
    }, [apps?.length, fetchApps])

    return (
        !apps.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b">
                <td colSpan={6} className="px-6 py-4 text-center">No Apps Yet</td>
            </tr>
            :
            apps.map((project: any) => (
                <tr key={project.id} className="odd:bg-white even:bg-gray-50 border-b">
                    <td className="px-6 py-4">
                        <img src={project.img} alt={project.title} width={100} height={100} />
                    </td>
                    <td className="px-6 py-4">{project.title}</td>
                    <td className="px-6 py-4">{project.description}</td>
                    <td className="px-6 py-4">{project.titleEn}</td>
                    <td className="px-6 py-4">{project.descriptionEn}</td>
                    <td className="px-6 py-4">
                        <div className='flex flex-wrap gap-1 min-w-[100px] mb-1'>
                            {project.types?.map((t: string) => (
                                <span key={t} className='text-xs bg-indigo-100 text-indigo-700 rounded px-2 py-0.5 font-medium'>{t}</span>
                            ))}
                        </div>
                        <div className='flex flex-wrap gap-1 min-w-[120px]'>
                            {project.links?.length > 0
                                ? project.links.map((l: any, i: number) => (
                                    <a key={i} href={l.link} target='_blank' rel='noreferrer'
                                        className='text-xs bg-gray-100 hover:bg-blue-50 border border-gray-200 rounded px-2 py-0.5 text-blue-600 whitespace-nowrap'>
                                        {l.headerEn || l.link}
                                    </a>
                                ))
                                : <span className='text-xs text-gray-400'>—</span>
                            }
                        </div>
                    </td>
                    <td className="px-6 py-4">
                        <div className='flex gap-2'>
                            <LocaleLink
                                href='/dashboard/application?applicationform=true'
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setEditProject(project)
                                }}
                                className="font-medium text-blue-600 hover:underline"
                            >
                                Edit
                            </LocaleLink>
                            <button
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setProjectId(project.id)
                                }}
                                className="font-medium text-red-600 hover:underline"
                            >
                                Delete
                            </button>
                        </div>
                        {projectId === project.id &&
                            <DeleteProject projectId={projectId} setProjectId={setProjectId} storeKey='deleteApp' />
                        }
                    </td>
                </tr>
            ))
    )
}

export default AppRows

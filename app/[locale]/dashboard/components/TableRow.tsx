/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import DeleteProject from './DeleteProject'
import LocaleLink from '../../components/LocaleLink'

const TableRow = () => {
    const [projectId, setProjectId] = useState('')
    const { projects, setProjects, setEditProject }: any = useStore()

    const fetchProjects = useCallback(async () => {
        try {
            // No type filter — fetch ALL projects for the unified dashboard table
            const { data } = await axios.get(`/api/project?dashboard=true`)
            setProjects(data.data)
        } catch (error: any) {
            console.error('[TableRow] fetch error:', error)
        }
    }, [setProjects])

    // Always re-fetch on mount (avoid stale Zustand cache hiding real data)
    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    return (
        !projects.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b">
                <td colSpan={7} className="px-6 py-4 text-center text-gray-400">No Projects Yet</td>
            </tr>
            :
            projects.map((project: any) => (
                <tr key={project.id} className="odd:bg-white even:bg-gray-50 border-b align-top">
                    <td className="px-4 py-3">
                        <img src={project.img} alt={project.title} width={80} height={80} className='rounded object-cover' />
                    </td>
                    <td className="px-4 py-3">
                        <p className='font-medium text-gray-800'>{project.title}</p>
                        <p className='text-gray-500 text-xs mt-0.5'>{project.titleEn}</p>
                    </td>
                    <td className="px-4 py-3 max-w-[180px]">
                        <p className='text-xs text-gray-600 line-clamp-3'>{project.description}</p>
                        <p className='text-xs text-gray-400 line-clamp-2 mt-1'>{project.descriptionEn}</p>
                    </td>
                    <td className="px-4 py-3">
                        <div className='flex flex-wrap gap-1'>
                            {project.types?.map((t: string) => (
                                <span key={t} className='text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium whitespace-nowrap'>{t}</span>
                            ))}
                        </div>
                    </td>
                    <td className="px-4 py-3">
                        <div className='flex flex-wrap gap-1'>
                            {project.links?.length > 0
                                ? project.links.map((l: any, i: number) => (
                                    <a key={i} href={l.link} target='_blank' rel='noreferrer'
                                        className='text-xs bg-gray-100 hover:bg-blue-50 border border-gray-200 rounded px-2 py-0.5 text-blue-600 whitespace-nowrap'>
                                        {l.headerEn || '↗'}
                                    </a>
                                ))
                                : <span className='text-xs text-gray-300'>—</span>
                            }
                        </div>
                    </td>
                    <td className="px-4 py-3">
                        <div className='flex gap-2'>
                            <LocaleLink
                                href='/dashboard/projects?projectform=true'
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setEditProject(project)
                                }}
                                className="font-medium text-blue-600 hover:underline text-sm"
                            >
                                Edit
                            </LocaleLink>
                            <button
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setProjectId(project.id)
                                }}
                                className="font-medium text-red-600 hover:underline text-sm"
                            >
                                Delete
                            </button>
                        </div>
                        {projectId === project.id &&
                            <DeleteProject projectId={projectId} setProjectId={setProjectId} />
                        }
                    </td>
                </tr>
            ))
    )
}

export default TableRow

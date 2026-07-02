/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import DeleteProject from './DeleteProject'
import LocaleLink from '../../components/LocaleLink'

const TableRow = () => {
    const [projectId, setProjectId] = useState('')
    const [activeType, setActiveType] = useState<string>('All')
    const [reordering, setReordering] = useState(false)
    const { projects, setProjects, setEditProject }: any = useStore()

    const fetchProjects = useCallback(async () => {
        try {
            const { data } = await axios.get(`/api/project?dashboard=true`)
            setProjects(data.data)
        } catch (error: any) {
            console.error('[TableRow] fetch error:', error)
        }
    }, [setProjects])

    useEffect(() => {
        fetchProjects()
    }, [fetchProjects])

    // Unique types across all projects
    const allTypes: string[] = Array.from(
        new Set<string>(projects.flatMap((p: any) => p.types ?? []))
    ).sort()

    // Projects filtered by the active type tab
    const filteredProjects =
        activeType === 'All'
            ? [...projects].sort((a: any, b: any) => a.order - b.order)
            : projects
                  .filter((p: any) => p.types?.includes(activeType))
                  .sort((a: any, b: any) => a.order - b.order)

    const handleReorder = async (id: string, direction: 'up' | 'down', type: string) => {
        if (reordering) return
        setReordering(true)
        try {
            await axios.patch('/api/project/reorder', { id, direction, type })
            await fetchProjects()
        } catch (error: any) {
            console.error('[TableRow] reorder error:', error)
        } finally {
            setReordering(false)
        }
    }

    // For up/down button disabling: determine position within the filtered list for the active type
    const getPositionInType = (project: any): { isFirst: boolean; isLast: boolean } => {
        const typeKey = activeType === 'All' ? null : activeType
        const list = typeKey
            ? projects.filter((p: any) => p.types?.includes(typeKey)).sort((a: any, b: any) => a.order - b.order)
            : [...projects].sort((a: any, b: any) => a.order - b.order)
        const idx = list.findIndex((p: any) => p.id === project.id)
        return { isFirst: idx === 0, isLast: idx === list.length - 1 }
    }

    const tabs = ['All', ...allTypes]

    return (
        <>
            {/* Type filter tabs */}
            <tr>
                <td colSpan={7} className="px-4 pt-4 pb-2 bg-gray-50">
                    <div className="flex flex-wrap gap-2">
                        {tabs.map((tab) => (
                            <button
                                key={tab}
                                onClick={() => setActiveType(tab)}
                                className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                                    activeType === tab
                                        ? 'bg-indigo-600 text-white border-indigo-600'
                                        : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-400 hover:text-indigo-600'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                </td>
            </tr>

            {/* Project rows */}
            {filteredProjects.length === 0 ? (
                <tr className="odd:bg-white even:bg-gray-50 border-b">
                    <td colSpan={7} className="px-6 py-4 text-center text-gray-400">No Projects Yet</td>
                </tr>
            ) : (
                filteredProjects.map((project: any) => {
                    const { isFirst, isLast } = getPositionInType(project)
                    // Use activeType for reorder; if "All" use first type of the project
                    const reorderType = activeType !== 'All' ? activeType : (project.types?.[0] ?? '')

                    return (
                        <tr key={project.id} className="odd:bg-white even:bg-gray-50 border-b align-top">
                            <td className="px-4 py-3">
                                <img src={project.img} alt={project.title} width={80} height={80} className="rounded object-cover" />
                            </td>
                            <td className="px-4 py-3">
                                <p className="font-medium text-gray-800">{project.title}</p>
                                <p className="text-gray-500 text-xs mt-0.5">{project.titleEn}</p>
                            </td>
                            <td className="px-4 py-3 max-w-[180px]">
                                <p className="text-xs text-gray-600 line-clamp-3">{project.description}</p>
                                <p className="text-xs text-gray-400 line-clamp-2 mt-1">{project.descriptionEn}</p>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                    {project.types?.map((t: string) => (
                                        <span key={t} className="text-xs bg-indigo-100 text-indigo-700 rounded-full px-2 py-0.5 font-medium whitespace-nowrap">{t}</span>
                                    ))}
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-wrap gap-1">
                                    {project.links?.length > 0
                                        ? project.links.map((l: any, i: number) => (
                                            <a key={i} href={l.link} target="_blank" rel="noreferrer"
                                                className="text-xs bg-gray-100 hover:bg-blue-50 border border-gray-200 rounded px-2 py-0.5 text-blue-600 whitespace-nowrap">
                                                {l.headerEn || '↗'}
                                            </a>
                                        ))
                                        : <span className="text-xs text-gray-300">—</span>
                                    }
                                </div>
                            </td>
                            <td className="px-4 py-3">
                                <div className="flex flex-col gap-2">
                                    {/* Edit / Delete */}
                                    <div className="flex gap-2">
                                        <LocaleLink
                                            href="/dashboard/projects?projectform=true"
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
                                    {/* Up / Down reorder buttons */}
                                    <div className="flex gap-1">
                                        <button
                                            onClick={() => handleReorder(project.id, 'up', reorderType)}
                                            disabled={isFirst || reordering || !reorderType}
                                            title="Move up"
                                            className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            ↑
                                        </button>
                                        <button
                                            onClick={() => handleReorder(project.id, 'down', reorderType)}
                                            disabled={isLast || reordering || !reorderType}
                                            title="Move down"
                                            className="px-2 py-0.5 text-xs rounded border border-gray-300 bg-white hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                        >
                                            ↓
                                        </button>
                                    </div>
                                </div>
                                {projectId === project.id &&
                                    <DeleteProject projectId={projectId} setProjectId={setProjectId} />
                                }
                            </td>
                        </tr>
                    )
                })
            )}
        </>
    )
}

export default TableRow

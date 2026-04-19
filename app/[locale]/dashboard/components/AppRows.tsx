/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import Link from 'next/link'
import React, { useCallback, useEffect, useState } from 'react'
import DeleteProject from './DeleteProject'
import LocaleLink from '../../components/LocaleLink'

const AppRows = () => {
    const [projectId, setProjectId] = useState('')
    const { apps, setEditProject, setApps, deleteApp }: any = useStore()
    const fetchApps = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/project?type=app`)
                setApps(data.data)
            } catch (error: any) {
                console.error(error);
            }
        }, [setApps]
    )
    useEffect(() => {
        if (!apps?.length) {
            fetchApps()
        }
    }, [apps?.length, fetchApps])


    return (
        !apps.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b ">
                <td scope="row" colSpan={5} className="px-6 py-4 text-center">
                    No Apps Yet
                </td>
            </tr>
            :
            apps.map((project: any, index: number) => (
                <tr key={project.id} className="odd:bg-white even:bg-gray-50 border-b ">
                    <td scope="row" className="px-6 py-4  ">
                        <img
                            src={project.img}
                            alt={project.title}
                            width={100}
                            height={100}
                        />
                    </td>
                    <td className="px-6 py-4">
                        {project.title}
                    </td>
                    <td className="px-6 py-4">
                        {project.description}
                    </td>
                    <td className="px-6 py-4">
                        {project.titleEn}
                    </td>
                    <td className="px-6 py-4">
                        {project.descriptionEn}
                    </td>
                    <td className="px-6 py-4">
                        <div className='flex gap-2'>
                            <LocaleLink
                                href={'/dashboard/application?applicationform=true'}
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setEditProject(project)
                                }}
                                className="font-medium text-blue-600 hover:underline">
                                Edit
                            </LocaleLink>
                            <button
                                onClick={() => {
                                    document.body.style.overflow = 'hidden'
                                    setProjectId(project.id)
                                }}
                                className="font-medium text-red-600 hover:underline">
                                Delete
                            </button>
                        </div>
                        {projectId == project.id && <DeleteProject projectId={projectId} setProjectId={setProjectId} storeKey='deleteApp' />}
                    </td>
                </tr>
            ))
    )
}

export default AppRows
/* eslint-disable @next/next/no-img-element */
'use client'
import { useStore } from '@/lib/zustand'
import axios from 'axios'
import React, { useCallback, useEffect, useState } from 'react'
import DeleteProject from './DeleteProject'
import LocaleLink from '../../components/LocaleLink'

const TableRow = () => {
    const [projectId, setProjectId] = useState('')
    const { projects, setProjects, setEditProject, setApps }: any = useStore()
    const fetchProjects = useCallback(
        async () => {
            try {
                const { data } = await axios.get(`/api/project?type=project`)
                setProjects(data.data)
            } catch (error: any) {
                console.error(error);
            }
        }, [setProjects]
    )
    useEffect(() => {
        if (!projects?.length) {
            fetchProjects()
        }
    }, [fetchProjects, projects?.length])


    return (
        !projects.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b ">
                <td scope="row" colSpan={5} className="px-6 py-4 text-center">
                    No Project Yet
                </td>
            </tr>
            :
            projects.map((project: any, index: number) => (
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
                                href={'/dashboard/projects?projectform=true'}
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
                        {projectId == project.id && <DeleteProject projectId={projectId} setProjectId={setProjectId} />}
                    </td>
                </tr>
            ))
    )
}

export default TableRow
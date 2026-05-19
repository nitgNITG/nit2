'use client'
import axios from 'axios'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { LoadingIcon } from '../../components/icons'

type ProjectType = { id: string; value: string; labelEn: string; labelAr: string }

// ─── Add / Edit inline form ───────────────────────────────────────────────
const TypeForm = ({ editing, onDone }: { editing: ProjectType | null; onDone: () => void }) => {
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        defaultValues: {
            value: editing?.value || '',
            labelEn: editing?.labelEn || '',
            labelAr: editing?.labelAr || '',
        }
    })

    const onSubmit = async (form: any) => {
        setLoading(true)
        try {
            if (editing) {
                await axios.put(`/api/project-type/${editing.id}`, { labelEn: form.labelEn, labelAr: form.labelAr })
                toast.success('Type updated')
            } else {
                await axios.post('/api/project-type', form)
                toast.success('Type created')
            }
            reset()
            onDone()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Error saving type')
        }
        setLoading(false)
    }

    return (
        <form onSubmit={handleSubmit(onSubmit)} className='bg-white border-2 border-blue-200 rounded-lg p-5 space-y-3'>
            <h3 className='font-semibold text-gray-700'>{editing ? 'Edit Type' : 'Add New Type'}</h3>

            {/* Slug — only shown when creating; immutable on edit */}
            {!editing && (
                <div>
                    <label className='block text-xs text-gray-400 mb-1 uppercase'>Slug / Value</label>
                    <input
                        {...register('value', { required: 'Required' })}
                        placeholder='e.g. lms, ecommerce, vr-learning'
                        className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                    />
                    <p className='text-xs text-gray-400 mt-0.5'>Lowercase, use hyphens — this becomes the DB key (cannot be changed later)</p>
                    {errors.value && <p className='text-red-500 text-xs mt-0.5'>{errors.value.message as string}</p>}
                </div>
            )}

            <div className='grid grid-cols-2 gap-3'>
                <div>
                    <label className='block text-xs text-gray-400 mb-1 uppercase'>Name in English</label>
                    <input
                        {...register('labelEn', { required: 'Required' })}
                        placeholder='e.g. LMS / Moodle Platform'
                        className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                    />
                    {errors.labelEn && <p className='text-red-500 text-xs mt-0.5'>{errors.labelEn.message as string}</p>}
                </div>
                <div>
                    <label className='block text-xs text-gray-400 mb-1 uppercase'>الاسم بالعربية</label>
                    <input
                        {...register('labelAr', { required: 'Required' })}
                        placeholder='مثال: منصة تعليمية'
                        className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                        dir='rtl'
                    />
                    {errors.labelAr && <p className='text-red-500 text-xs mt-0.5'>{errors.labelAr.message as string}</p>}
                </div>
            </div>

            <div className='flex gap-2 pt-1'>
                <button type='submit' className='bg-blue-500 hover:bg-blue-600 text-white text-sm px-5 py-2 rounded-md flex items-center gap-2'>
                    {loading ? <LoadingIcon className='animate-spin size-4' /> : null}
                    {editing ? 'Update' : 'Create'}
                </button>
                <button type='button' onClick={onDone} className='text-sm text-gray-500 px-4 py-2 border rounded-md hover:bg-gray-50'>
                    Cancel
                </button>
            </div>
        </form>
    )
}

// ─── Main page ───────────────────────────────────────────────────────────
export default function TypesPage() {
    const [types, setTypes] = useState<ProjectType[]>([])
    const [loading, setLoading] = useState(true)
    const [editing, setEditing] = useState<ProjectType | null>(null)
    const [showAddForm, setShowAddForm] = useState(false)
    const [deletingId, setDeletingId] = useState<string | null>(null)

    const fetchTypes = async () => {
        setLoading(true)
        try {
            const { data } = await axios.get('/api/project-type')
            setTypes(data.types)
        } catch {
            toast.error('Failed to load types')
        }
        setLoading(false)
    }

    useEffect(() => { fetchTypes() }, [])

    const handleDelete = async (id: string) => {
        if (!confirm('Delete this type? Projects using it will keep the value but it won\'t appear in the type selector.')) return
        try {
            await axios.delete(`/api/project-type/${id}`)
            toast.success('Type deleted')
            fetchTypes()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Error deleting')
        }
    }

    const onFormDone = () => {
        setShowAddForm(false)
        setEditing(null)
        fetchTypes()
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-6'>
            <div className='flex justify-between items-center'>
                <div>
                    <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Project Types</h4>
                    <p className='text-sm text-gray-400 mt-0.5'>Manage the type labels shown in the project form and on the site</p>
                </div>
                {!showAddForm && !editing && (
                    <button
                        onClick={() => setShowAddForm(true)}
                        className='bg-blue-500 hover:bg-blue-600 text-white text-sm px-5 py-2 rounded-md transition-colors'
                    >
                        + Add Type
                    </button>
                )}
            </div>

            {/* Add form */}
            {showAddForm && !editing && (
                <TypeForm editing={null} onDone={onFormDone} />
            )}

            {/* Edit form */}
            {editing && (
                <TypeForm editing={editing} onDone={onFormDone} />
            )}

            {/* Types table */}
            <div className='overflow-auto bg-white rounded-lg shadow-sm'>
                <table className='w-full text-sm text-left text-gray-500'>
                    <thead className='text-xs text-gray-700 uppercase bg-gray-50'>
                        <tr>
                            <th className='px-5 py-3'>Slug (DB key)</th>
                            <th className='px-5 py-3'>Name — English</th>
                            <th className='px-5 py-3'>الاسم — عربي</th>
                            <th className='px-5 py-3'>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {loading ? (
                            <tr><td colSpan={4} className='px-5 py-8 text-center text-gray-400'>Loading…</td></tr>
                        ) : types.length === 0 ? (
                            <tr><td colSpan={4} className='px-5 py-8 text-center text-gray-400'>No types yet — add one above</td></tr>
                        ) : types.map((t) => (
                            <tr key={t.id} className='odd:bg-white even:bg-gray-50 border-b'>
                                <td className='px-5 py-4'>
                                    <span className='font-mono text-xs bg-indigo-50 text-indigo-700 rounded px-2 py-0.5'>{t.value}</span>
                                </td>
                                <td className='px-5 py-4 font-medium text-gray-700'>{t.labelEn}</td>
                                <td className='px-5 py-4 text-gray-700' dir='rtl'>{t.labelAr}</td>
                                <td className='px-5 py-4'>
                                    <div className='flex gap-3'>
                                        <button
                                            onClick={() => { setEditing(t); setShowAddForm(false) }}
                                            className='text-blue-600 hover:underline text-sm font-medium'
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => handleDelete(t.id)}
                                            className='text-red-500 hover:underline text-sm font-medium'
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>

            <div className='bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-700'>
                <strong>Note:</strong> The <em>Slug</em> is set once when creating and cannot be changed — it&#39;s the value stored in each project&#39;s types array. Changing the English/Arabic labels is safe at any time.
            </div>
        </div>
    )
}

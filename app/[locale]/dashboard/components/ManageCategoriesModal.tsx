'use client'
import React, { useState } from 'react'
import axios from 'axios'
import toast from 'react-hot-toast'
import { LuPlus, LuPencil, LuTrash2, LuCheck, LuX, LuLayers } from 'react-icons/lu'
import useClickOutside from '../../hook/useClickOutSide'
import { LoadingIcon } from '../../components/icons'
import type { CategoryItem } from '@/lib/videos'

interface ManageCategoriesModalProps {
    categories: CategoryItem[]
    close: () => void
    onUpdated: () => void
}

export default function ManageCategoriesModal({ categories, close, onUpdated }: ManageCategoriesModalProps) {
    const [list, setList] = useState<CategoryItem[]>(categories)
    const [newAr, setNewAr] = useState('')
    const [newEn, setNewEn] = useState('')
    const [adding, setAdding] = useState(false)
    const [editingId, setEditingId] = useState<string | null>(null)
    const [editAr, setEditAr] = useState('')
    const [editEn, setEditEn] = useState('')
    const [saving, setSaving] = useState(false)
    const eleRef = useClickOutside(close)

    const handleAdd = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!newAr.trim() || !newEn.trim()) {
            toast.error('Please enter both Arabic and English names')
            return
        }

        try {
            setAdding(true)
            const { data } = await axios.post('/api/video-categories', {
                labelAr: newAr.trim(),
                labelEn: newEn.trim(),
            })
            toast.success('Category added')
            setList((prev) => [...prev, data.category])
            setNewAr('')
            setNewEn('')
            onUpdated()
        } catch (err: any) {
            toast.error(err?.response?.data?.message || 'Failed to add category')
        } finally {
            setAdding(false)
        }
    }

    const startEdit = (item: CategoryItem) => {
        setEditingId(item.id || item.value)
        setEditAr(item.labelAr)
        setEditEn(item.labelEn)
    }

    const saveEdit = async (item: CategoryItem) => {
        if (!item.id) {
            toast.error('Default category cannot be edited directly, you can add a new one')
            setEditingId(null)
            return
        }
        try {
            setSaving(true)
            const { data } = await axios.put(`/api/video-categories/${item.id}`, {
                labelAr: editAr.trim(),
                labelEn: editEn.trim(),
            })
            toast.success('Category updated')
            setList((prev) => prev.map((c) => (c.id === item.id ? { ...c, labelAr: editAr, labelEn: editEn } : c)))
            setEditingId(null)
            onUpdated()
        } catch (err: any) {
            toast.error('Failed to update category')
        } finally {
            setSaving(false)
        }
    }

    const handleDelete = async (item: CategoryItem) => {
        if (!item.id) {
            toast.error('Default category cannot be deleted')
            return
        }
        if (!confirm(`Are you sure you want to delete category "${item.labelEn}"?`)) return
        try {
            await axios.delete(`/api/video-categories/${item.id}`)
            toast.success('Category deleted')
            setList((prev) => prev.filter((c) => c.id !== item.id))
            onUpdated()
        } catch (err: any) {
            toast.error('Failed to delete category')
        }
    }

    return (
        <div className='w-full h-full fixed bg-black/50 backdrop-blur-sm top-0 left-0 flex justify-center items-center px-4 z-50'>
            <div ref={eleRef} className='bg-white w-full sm:w-[500px] md:w-[560px] rounded-2xl max-h-[90svh] flex flex-col shadow-2xl border border-gray-100 overflow-hidden'>
                
                {/* Header */}
                <div className='p-5 border-b flex justify-between items-center bg-gray-50/60'>
                    <div className='flex items-center gap-2.5'>
                        <div className='p-2 bg-emerald-100 text-emerald-800 rounded-lg'>
                            <LuLayers className='size-5' />
                        </div>
                        <div>
                            <h4 className='font-bold text-gray-900 text-base'>
                                Manage Categories / إدارة التصنيفات
                            </h4>
                            <p className='text-xs text-gray-500'>
                                إضافة وتعديل أسماء تصنيفات الفيديوهات المعروضة
                            </p>
                        </div>
                    </div>
                    <button onClick={close} className='p-1 text-gray-400 hover:text-gray-700 rounded-lg'>
                        <LuX className='size-5' />
                    </button>
                </div>

                {/* Categories List */}
                <div className='p-5 overflow-y-auto flex-1 space-y-3'>
                    <div className='space-y-2'>
                        {list.map((item) => {
                            const isEditing = editingId === (item.id || item.value)

                            return (
                                <div
                                    key={item.id || item.value}
                                    className='p-3 bg-gray-50 rounded-xl border border-gray-200/80 flex items-center justify-between gap-3 text-sm'
                                >
                                    {isEditing ? (
                                        <div className='flex-1 grid grid-cols-2 gap-2'>
                                            <input
                                                type='text'
                                                value={editAr}
                                                onChange={(e) => setEditAr(e.target.value)}
                                                className='px-2.5 py-1.5 border rounded-lg bg-white text-xs text-right'
                                                placeholder='الاسم بالعربية'
                                                dir='rtl'
                                            />
                                            <input
                                                type='text'
                                                value={editEn}
                                                onChange={(e) => setEditEn(e.target.value)}
                                                className='px-2.5 py-1.5 border rounded-lg bg-white text-xs text-left'
                                                placeholder='English Name'
                                            />
                                        </div>
                                    ) : (
                                        <div className='flex-1 min-w-0 flex items-center justify-between'>
                                            <span className='font-semibold text-gray-900'>{item.labelEn}</span>
                                            <span className='text-gray-500 font-medium' dir='rtl'>{item.labelAr}</span>
                                        </div>
                                    )}

                                    {/* Action Buttons */}
                                    <div className='flex items-center gap-1 flex-shrink-0'>
                                        {isEditing ? (
                                            <>
                                                <button
                                                    onClick={() => saveEdit(item)}
                                                    disabled={saving}
                                                    className='p-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700'
                                                    title='Save'
                                                >
                                                    <LuCheck className='size-4' />
                                                </button>
                                                <button
                                                    onClick={() => setEditingId(null)}
                                                    className='p-1.5 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300'
                                                    title='Cancel'
                                                >
                                                    <LuX className='size-4' />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => startEdit(item)}
                                                    className='p-1.5 text-gray-500 hover:text-emerald-700 hover:bg-white rounded-lg transition-colors'
                                                    title='Edit Name'
                                                >
                                                    <LuPencil className='size-4' />
                                                </button>
                                                {item.id && (
                                                    <button
                                                        onClick={() => handleDelete(item)}
                                                        className='p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors'
                                                        title='Delete Category'
                                                    >
                                                        <LuTrash2 className='size-4' />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                </div>
                            )
                        })}
                    </div>

                    {/* Add New Category Box */}
                    <form onSubmit={handleAdd} className='mt-5 pt-4 border-t border-gray-200 space-y-3'>
                        <p className='text-xs font-semibold text-gray-700 uppercase tracking-wide'>
                            + Add New Category / إضافة تصنيف جديد
                        </p>
                        <div className='grid grid-cols-2 gap-2'>
                            <input
                                type='text'
                                value={newAr}
                                onChange={(e) => setNewAr(e.target.value)}
                                placeholder='الاسم بالعربية (مثال: لقاءات العملاء)'
                                className='px-3 py-2 border border-gray-300 focus:border-emerald-500 rounded-xl text-xs text-right outline-none'
                                dir='rtl'
                            />
                            <input
                                type='text'
                                value={newEn}
                                onChange={(e) => setNewEn(e.target.value)}
                                placeholder='Name in English (e.g. Client Interviews)'
                                className='px-3 py-2 border border-gray-300 focus:border-emerald-500 rounded-xl text-xs text-left outline-none'
                            />
                        </div>
                        <button
                            type='submit'
                            disabled={adding}
                            className='w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50'
                        >
                            {adding ? <LoadingIcon className='size-4 animate-spin' /> : <LuPlus className='size-4' />}
                            <span>Add Category / إضافة التصنيف</span>
                        </button>
                    </form>
                </div>

                {/* Footer */}
                <div className='p-4 border-t bg-gray-50 text-right'>
                    <button
                        type='button'
                        onClick={close}
                        className='px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 text-xs font-semibold rounded-lg transition-colors'
                    >
                        Close / إغلاق
                    </button>
                </div>

            </div>
        </div>
    )
}

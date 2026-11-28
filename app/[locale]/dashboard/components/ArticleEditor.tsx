/* eslint-disable @next/next/no-img-element */
'use client'
import axios from 'axios'
import { useLocale } from 'next-intl'
import React, { useCallback, useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import { useRouter } from '@/navigation'
import { slugify } from '@/utils/slugify'
import { isScheduled } from '@/lib/blog'
import LocaleLink from '../../components/LocaleLink'
import { ArrowDownIcon, DeleteIcon, ImageIcon, LoadingIcon, PlusIcon } from '../../components/icons'

// One page for creating and editing an article: cover, both languages, publishing time and
// every section (H2) with its items (H3). Nothing is sent until "Save".

type Lang = 'ar' | 'en'
type Item = { key: string; title: string; titleEn: string; content: string; contentEn: string }
type Sec = { key: string; id?: string; title: string; titleEn: string; content: string; contentEn: string; list: Item[]; open: boolean }
type Fields = { title: string; titleEn: string; content: string; contentEn: string; metaDesc: string; metaDescEn: string; slug: string }
type Errors = Record<string, string>

const EMPTY_FIELDS: Fields = { title: '', titleEn: '', content: '', contentEn: '', metaDesc: '', metaDescEn: '', slug: '' }

const s = (v: unknown) => (typeof v === 'string' ? v : '')
const words = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0)
const move = <T,>(arr: T[], i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= arr.length) return arr
    const next = [...arr]
    ;[next[i], next[j]] = [next[j], next[i]]
    return next
}
// datetime-local works in the browser's time zone; the API gets an ISO instant.
const toLocalInput = (d: Date) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16)

const sectionPayload = (sec: Sec, order: number) => ({
    title: sec.title.trim(),
    titleEn: sec.titleEn.trim(),
    content: sec.content.trim(),
    contentEn: sec.contentEn.trim(),
    list: sec.list.map((i) => ({ title: i.title.trim(), titleEn: i.titleEn.trim(), content: i.content.trim(), contentEn: i.contentEn.trim() })),
    order,
})

const input = 'w-full border-2 border-gray-200 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm bg-white'
const LINK_HINT = 'Add a link with [text](/ar/blog/slug) or [text](https://…)'

const Field = ({ id, label, hint, error, counter, children }: {
    id: string; label: string; hint?: string; error?: string; counter?: React.ReactNode; children: React.ReactNode
}) => (
    <div className='space-y-1'>
        <div className='flex items-baseline justify-between gap-2'>
            <label htmlFor={id} className='text-xs font-semibold text-gray-600 uppercase tracking-wide'>{label}</label>
            {counter}
        </div>
        {children}
        {error ? <p role='alert' className='text-xs text-red-600'>{error}</p> : hint ? <p className='text-xs text-gray-400'>{hint}</p> : null}
    </div>
)

const Counter = ({ value, max, unit = 'chars' }: { value: number; max: number; unit?: string }) => (
    <span className={`text-xs tabular-nums ${value > max ? 'text-red-500' : 'text-gray-400'}`}>{value}/{max} {unit}</span>
)

const IconBtn = ({ label, onClick, disabled, children, danger }: {
    label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode; danger?: boolean
}) => (
    <button type='button' aria-label={label} title={label} onClick={onClick} disabled={disabled}
        className={`p-1.5 rounded-md disabled:opacity-30 disabled:pointer-events-none ${danger ? 'text-red-600 hover:bg-red-50' : 'text-gray-500 hover:bg-gray-100'}`}>
        {children}
    </button>
)

const ArticleEditor = ({ articleId }: { articleId?: string }) => {
    const isNew = !articleId
    const locale = useLocale()
    const router = useRouter()
    const keyRef = useRef(0)
    const nextKey = () => `k${++keyRef.current}`

    const [status, setStatus] = useState<'loading' | 'error' | 'ready'>(isNew ? 'ready' : 'loading')
    const [saving, setSaving] = useState(false)
    const [dirty, setDirty] = useState(false)
    const [lang, setLang] = useState<Lang>('ar')
    const [fields, setFields] = useState<Fields>(EMPTY_FIELDS)
    const [savedSlug, setSavedSlug] = useState('')
    const [imgUrl, setImgUrl] = useState('')
    const [imgFile, setImgFile] = useState<File | null>(null)
    const [publishedAt, setPublishedAt] = useState<string | null>(null)
    const [schedule, setSchedule] = useState(false)
    const [publishAt, setPublishAt] = useState('')
    const [sections, setSections] = useState<Sec[]>([])
    const [removed, setRemoved] = useState<string[]>([])
    const [confirmDelete, setConfirmDelete] = useState('')
    const [errors, setErrors] = useState<Errors>({})
    const snapshot = useRef<Record<string, string>>({})

    const load = useCallback(async () => {
        if (!articleId) return
        setStatus('loading')
        try {
            const { data } = await axios.get(`/api/blog/article/${articleId}`)
            const a = data.article
            setFields({ title: s(a.title), titleEn: s(a.titleEn), content: s(a.content), contentEn: s(a.contentEn), metaDesc: s(a.metaDesc), metaDescEn: s(a.metaDescEn), slug: s(a.slug) })
            setSavedSlug(s(a.slug))
            setImgUrl(s(a.img))
            setImgFile(null)
            setPublishedAt(a.publishedAt ?? null)
            const scheduled = isScheduled(a.publishedAt)
            setSchedule(scheduled)
            setPublishAt(scheduled ? toLocalInput(new Date(a.publishedAt)) : '')
            const secs: Sec[] = (a.Section ?? []).map((sec: any) => ({
                key: nextKey(), id: sec.id, title: s(sec.title), titleEn: s(sec.titleEn), content: s(sec.content), contentEn: s(sec.contentEn), open: false,
                list: (sec.list ?? []).map((i: any) => ({ key: nextKey(), title: s(i.title), titleEn: s(i.titleEn), content: s(i.content), contentEn: s(i.contentEn) })),
            }))
            snapshot.current = Object.fromEntries(secs.map((sec, i) => [sec.id!, JSON.stringify(sectionPayload(sec, i))]))
            setSections(secs)
            setRemoved([])
            setErrors({})
            setDirty(false)
            setStatus('ready')
        } catch (error) {
            console.error(error)
            setStatus('error')
        }
    }, [articleId])

    useEffect(() => { load() }, [load])

    useEffect(() => {
        if (!dirty) return
        const warn = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = '' }
        window.addEventListener('beforeunload', warn)
        return () => window.removeEventListener('beforeunload', warn)
    }, [dirty])

    const touch = () => setDirty(true)
    const setField = (k: keyof Fields, v: string) => { setFields((f) => ({ ...f, [k]: v })); touch() }
    const updateSec = (key: string, patch: Partial<Sec>) => { setSections((all) => all.map((x) => (x.key === key ? { ...x, ...patch } : x))); touch() }
    const updateItem = (secKey: string, itemKey: string, patch: Partial<Item>) =>
        setSections((all) => all.map((x) => (x.key === secKey ? { ...x, list: x.list.map((i) => (i.key === itemKey ? { ...i, ...patch } : i)) } : x)))
    const addSection = () => {
        setSections((all) => [...all, { key: nextKey(), title: '', titleEn: '', content: '', contentEn: '', list: [], open: true }])
        touch()
    }
    const removeSection = (sec: Sec) => {
        setSections((all) => all.filter((x) => x.key !== sec.key))
        if (sec.id) setRemoved((r) => [...r, sec.id!])
        setConfirmDelete('')
        touch()
    }

    const pickImage = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return
        setImgFile(file)
        setImgUrl(URL.createObjectURL(file))
        touch()
    }

    const validate = (): Errors => {
        const e: Errors = {}
        if (!fields.title.trim()) e.title = 'The Arabic title is required'
        if (!fields.content.trim()) e.content = 'The Arabic intro is required'
        if (isNew && !imgFile) e.img = 'Upload a cover image'
        if (!isNew && !fields.slug.trim()) e.slug = 'The URL can’t be empty'
        if (schedule) {
            const when = publishAt ? new Date(publishAt) : null
            if (!when || Number.isNaN(when.getTime())) e.publishAt = 'Pick a date and time'
            else if (when.getTime() <= Date.now()) e.publishAt = 'Pick a time in the future, or turn scheduling off'
        }
        sections.forEach((sec) => {
            if (!sec.title.trim()) e[`sec-${sec.key}`] = 'Every section needs an Arabic H2 title'
            sec.list.forEach((i) => { if (!i.title.trim()) e[`item-${i.key}`] = 'Every item needs an Arabic H3 title' })
        })
        return e
    }

    // The publish time to send, if it changes: a scheduled time, "now" when a scheduled
    // article is switched back to immediate, or nothing to keep the current date.
    const publishValue = () => {
        if (schedule) return new Date(publishAt).toISOString()
        if (!isNew && isScheduled(publishedAt)) return new Date().toISOString()
        return null
    }

    const save = async () => {
        const e = validate()
        setErrors(e)
        if (Object.keys(e).length) {
            const firstKey = Object.keys(e)[0]
            if (firstKey.startsWith('sec-') || firstKey.startsWith('item-'))
                setSections((all) => all.map((x) => (e[`sec-${x.key}`] || x.list.some((i) => e[`item-${i.key}`]) ? { ...x, open: true } : x)))
            setLang('ar')
            toast.error('Fix the highlighted fields first')
            return
        }
        setSaving(true)
        try {
            const fd = new FormData()
            for (const k of ['title', 'titleEn', 'content', 'contentEn', 'metaDesc', 'metaDescEn'] as const) fd.append(k, fields[k].trim())
            if (!isNew && fields.slug.trim() !== savedSlug) fd.append('slug', fields.slug.trim())
            if (imgFile) fd.append('img', imgFile)
            const when = publishValue()
            if (when) fd.append('publishedAt', when)

            const { data } = isNew
                ? await axios.post('/api/blog/article', fd)
                : await axios.put(`/api/blog/article/${articleId}`, fd)
            const id: string = data.article.id

            const failed: string[] = []
            for (const sectionId of removed) {
                try { await axios.delete(`/api/blog/section/${sectionId}`) } catch { failed.push('a deleted section') }
            }
            for (let i = 0; i < sections.length; i++) {
                const sec = sections[i]
                const payload = sectionPayload(sec, i)
                try {
                    if (!sec.id) await axios.post('/api/blog/section', { ...payload, articleId: id })
                    else if (snapshot.current[sec.id] !== JSON.stringify(payload)) await axios.put(`/api/blog/section/${sec.id}`, payload)
                } catch {
                    failed.push(sec.title || `section ${i + 1}`)
                }
            }

            setDirty(false)
            if (failed.length) toast.error(`Article saved, but these didn't: ${failed.join(', ')}`)
            else toast.success(isNew ? 'Article created' : 'Changes saved')
            if (isNew) router.replace(`/dashboard/blog/article/${id}`)
            else await load()
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'Couldn’t save the article')
        } finally {
            setSaving(false)
        }
    }

    if (status === 'loading')
        return (
            <div role='status' className='dashboard-container py-10 flex items-center gap-3 text-gray-500'>
                <LoadingIcon className='animate-spin size-5' /> Loading article…
            </div>
        )
    if (status === 'error')
        return (
            <div role='alert' className='dashboard-container py-10 space-y-3'>
                <p className='text-gray-700'>Couldn&apos;t load this article.</p>
                <div className='flex gap-3'>
                    <button onClick={load} className='border border-blue-500 text-blue-600 px-4 py-1.5 rounded-md hover:bg-blue-50'>Try again</button>
                    <LocaleLink href='/dashboard/blog' className='px-4 py-1.5 rounded-md text-gray-600 hover:bg-gray-100'>Back to blog</LocaleLink>
                </div>
            </div>
        )

    const ar = lang === 'ar'
    const sfx = ar ? '' : 'En'
    const dir = ar ? 'rtl' : 'ltr'
    const langName = ar ? 'Arabic' : 'English'
    const titleKey = `title${sfx}` as keyof Fields
    const contentKey = `content${sfx}` as keyof Fields
    const metaKey = `metaDesc${sfx}` as keyof Fields
    const scheduledNow = !isNew && isScheduled(publishedAt)
    const liveHref = `/${locale}/blog/${savedSlug || articleId}`

    return (
        <div className='pb-16'>
            {/* ── Top bar ── */}
            <div className='sticky top-0 z-20 bg-white/95 backdrop-blur border-b'>
                <div className='dashboard-container py-3 flex flex-wrap items-center gap-3'>
                    <LocaleLink href='/dashboard/blog' className='text-sm text-gray-500 hover:text-gray-800'>← Blog</LocaleLink>
                    <h1 className='font-bold text-lg md:text-xl me-auto'>{isNew ? 'New article' : 'Edit article'}</h1>
                    {!isNew && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${scheduledNow ? 'bg-amber-100 text-amber-800' : 'bg-green-100 text-green-800'}`}>
                            {scheduledNow ? 'Scheduled' : 'Published'}
                        </span>
                    )}
                    {dirty && <span className='text-xs text-gray-500'>Unsaved changes</span>}
                    {!isNew && !scheduledNow && (
                        <a href={liveHref} target='_blank' rel='noopener noreferrer' className='text-sm text-blue-600 hover:underline'>View on site ↗</a>
                    )}
                    <button type='button' onClick={save} disabled={saving}
                        className='bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium px-5 py-2 rounded-lg inline-flex items-center gap-2'>
                        {saving && <LoadingIcon className='animate-spin size-4' />}
                        {isNew ? (schedule ? 'Schedule article' : 'Publish article') : 'Save changes'}
                    </button>
                </div>
            </div>

            <div className='dashboard-container pt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start'>
                {/* ── Main column ── */}
                <div className='lg:col-span-2 space-y-6 min-w-0'>
                    <div role='tablist' aria-label='Content language' className='inline-flex rounded-lg border bg-gray-50 p-1'>
                        {(['ar', 'en'] as Lang[]).map((l) => (
                            <button key={l} type='button' role='tab' aria-selected={lang === l} onClick={() => setLang(l)}
                                className={`px-4 py-1.5 text-sm rounded-md ${lang === l ? 'bg-white shadow-sm font-semibold text-gray-900' : 'text-gray-500'}`}>
                                {l === 'ar' ? 'العربية' : 'English'}
                            </button>
                        ))}
                    </div>
                    {!ar && <p className='text-xs text-gray-500 -mt-4'>English is optional — empty fields fall back to Arabic on the /en page.</p>}

                    <section aria-labelledby='article-heading' className='bg-white border rounded-xl p-5 space-y-4'>
                        <h2 id='article-heading' className='font-semibold text-gray-800'>Article</h2>
                        <Field id={`f-${titleKey}`} label={`H1 title (${langName})`} error={errors[titleKey]}
                            counter={<Counter value={fields[titleKey].length} max={60} />}>
                            <input id={`f-${titleKey}`} dir={dir} value={fields[titleKey]} onChange={(e) => setField(titleKey, e.target.value)} className={input} />
                        </Field>
                        <Field id={`f-${contentKey}`} label={`Intro (${langName})`} error={errors[contentKey]} hint={LINK_HINT}
                            counter={<Counter value={words(fields[contentKey])} max={200} unit='words' />}>
                            <textarea id={`f-${contentKey}`} dir={dir} rows={5} value={fields[contentKey]} onChange={(e) => setField(contentKey, e.target.value)} className={input} />
                        </Field>
                        <Field id={`f-${metaKey}`} label={`Meta description (${langName})`} hint='Shown in Google results. Leave empty to use the start of the intro.'
                            counter={<Counter value={fields[metaKey].length} max={155} />}>
                            <textarea id={`f-${metaKey}`} dir={dir} rows={2} value={fields[metaKey]} onChange={(e) => setField(metaKey, e.target.value)} className={input} />
                        </Field>
                    </section>

                    {/* ── Sections ── */}
                    <section aria-labelledby='sections-heading' className='space-y-3'>
                        <div className='flex items-center justify-between'>
                            <h2 id='sections-heading' className='font-semibold text-gray-800'>Sections <span className='text-gray-400 font-normal'>({sections.length})</span></h2>
                            <p className='text-xs text-gray-400'>Each section is an H2; its items are H3s.</p>
                        </div>

                        {!sections.length && (
                            <p className='text-sm text-gray-500 bg-white border border-dashed rounded-xl p-6 text-center'>No sections yet. Add the first one below.</p>
                        )}

                        {sections.map((sec, i) => {
                            const heading = (ar ? sec.title : sec.titleEn || sec.title) || 'Untitled section'
                            const secErr = errors[`sec-${sec.key}`]
                            return (
                                <div key={sec.key} role='group' aria-label={`Section ${i + 1}`}
                                    className={`bg-white border rounded-xl ${secErr ? 'border-red-300' : ''}`}>
                                    <div className='flex items-center gap-2 px-3 py-2'>
                                        <button type='button' aria-expanded={sec.open} onClick={() => setSections((all) => all.map((x) => (x.key === sec.key ? { ...x, open: !x.open } : x)))}
                                            className='flex-1 min-w-0 flex items-center gap-2 text-start py-1'>
                                            <ArrowDownIcon className={`size-4 shrink-0 transition-transform ${sec.open ? '' : '-rotate-90'}`} />
                                            <span className='text-xs text-gray-400 tabular-nums'>{i + 1}</span>
                                            <span dir={dir} className='font-medium truncate'>{heading}</span>
                                            <span className='text-xs text-gray-400 shrink-0'>· {sec.list.length} items</span>
                                        </button>
                                        <IconBtn label={`Move section ${i + 1} up`} disabled={i === 0} onClick={() => { setSections((all) => move(all, i, -1)); touch() }}>↑</IconBtn>
                                        <IconBtn label={`Move section ${i + 1} down`} disabled={i === sections.length - 1} onClick={() => { setSections((all) => move(all, i, 1)); touch() }}>↓</IconBtn>
                                        <IconBtn label={`Delete section ${i + 1}`} danger onClick={() => setConfirmDelete(sec.key)}><DeleteIcon className='size-4 stroke-current' /></IconBtn>
                                    </div>

                                    {confirmDelete === sec.key && (
                                        <div role='alertdialog' aria-label='Confirm delete' className='mx-3 mb-3 flex flex-wrap items-center gap-2 bg-red-50 text-red-800 text-sm rounded-lg px-3 py-2'>
                                            <span className='me-auto'>Delete this section and its {sec.list.length} items?</span>
                                            <button type='button' onClick={() => removeSection(sec)} className='bg-red-600 text-white px-3 py-1 rounded-md'>Delete</button>
                                            <button type='button' onClick={() => setConfirmDelete('')} className='px-3 py-1 rounded-md hover:bg-red-100'>Cancel</button>
                                        </div>
                                    )}

                                    {sec.open && (
                                        <div className='border-t p-4 space-y-4'>
                                            <Field id={`s-${sec.key}-t${sfx}`} label={`H2 title (${langName})`} error={ar ? secErr : undefined}>
                                                <input id={`s-${sec.key}-t${sfx}`} dir={dir} value={ar ? sec.title : sec.titleEn}
                                                    onChange={(e) => updateSec(sec.key, ar ? { title: e.target.value } : { titleEn: e.target.value })} className={input} />
                                            </Field>
                                            <Field id={`s-${sec.key}-c${sfx}`} label={`Paragraph (${langName})`} hint={LINK_HINT}>
                                                <textarea id={`s-${sec.key}-c${sfx}`} dir={dir} rows={4} value={ar ? sec.content : sec.contentEn}
                                                    onChange={(e) => updateSec(sec.key, ar ? { content: e.target.value } : { contentEn: e.target.value })} className={input} />
                                            </Field>

                                            <div className='space-y-2'>
                                                <p className='text-xs font-semibold text-gray-600 uppercase tracking-wide'>H3 items</p>
                                                {sec.list.map((item, j) => {
                                                    const itemErr = errors[`item-${item.key}`]
                                                    return (
                                                        <div key={item.key} role='group' aria-label={`Section ${i + 1} item ${j + 1}`}
                                                            className={`rounded-lg border bg-gray-50 p-3 space-y-2 ${itemErr ? 'border-red-300' : ''}`}>
                                                            <div className='flex items-center gap-1'>
                                                                <span className='text-xs text-gray-400 me-auto'>Item {j + 1}</span>
                                                                <IconBtn label={`Move item ${j + 1} up`} disabled={j === 0}
                                                                    onClick={() => updateSec(sec.key, { list: move(sec.list, j, -1) })}>↑</IconBtn>
                                                                <IconBtn label={`Move item ${j + 1} down`} disabled={j === sec.list.length - 1}
                                                                    onClick={() => updateSec(sec.key, { list: move(sec.list, j, 1) })}>↓</IconBtn>
                                                                <IconBtn label={`Remove item ${j + 1}`} danger
                                                                    onClick={() => updateSec(sec.key, { list: sec.list.filter((x) => x.key !== item.key) })}>✕</IconBtn>
                                                            </div>
                                                            <Field id={`i-${item.key}-t${sfx}`} label={`H3 title (${langName})`} error={ar ? itemErr : undefined}>
                                                                <input id={`i-${item.key}-t${sfx}`} dir={dir} value={ar ? item.title : item.titleEn}
                                                                    onChange={(e) => { updateItem(sec.key, item.key, ar ? { title: e.target.value } : { titleEn: e.target.value }); touch() }} className={input} />
                                                            </Field>
                                                            <Field id={`i-${item.key}-c${sfx}`} label={`Description (${langName})`}>
                                                                <textarea id={`i-${item.key}-c${sfx}`} dir={dir} rows={2} value={ar ? item.content : item.contentEn}
                                                                    onChange={(e) => { updateItem(sec.key, item.key, ar ? { content: e.target.value } : { contentEn: e.target.value }); touch() }} className={input} />
                                                            </Field>
                                                        </div>
                                                    )
                                                })}
                                                <button type='button'
                                                    onClick={() => updateSec(sec.key, { list: [...sec.list, { key: nextKey(), title: '', titleEn: '', content: '', contentEn: '' }] })}
                                                    className='inline-flex items-center gap-1 text-sm text-blue-600 hover:bg-blue-50 px-2 py-1 rounded-md'>
                                                    <PlusIcon className='size-4 stroke-current' /> Add item
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        <button type='button' onClick={addSection}
                            className='w-full border-2 border-dashed border-gray-300 hover:border-blue-400 hover:text-blue-600 text-gray-500 rounded-xl py-3 inline-flex justify-center items-center gap-2'>
                            <PlusIcon className='size-5 stroke-current' /> Add section
                        </button>
                    </section>
                </div>

                {/* ── Sidebar ── */}
                <aside className='space-y-6 lg:sticky lg:top-20'>
                    <section aria-labelledby='cover-heading' className='bg-white border rounded-xl p-5 space-y-3'>
                        <h2 id='cover-heading' className='font-semibold text-gray-800'>Cover image</h2>
                        {imgUrl
                            ? <img src={imgUrl} alt='' className='w-full aspect-[1200/630] object-cover rounded-lg bg-gray-100' />
                            : <div className='w-full aspect-[1200/630] rounded-lg bg-gray-100 border-2 border-dashed flex flex-col items-center justify-center text-gray-400 gap-1'>
                                <ImageIcon className='size-8 stroke-current' />
                                <span className='text-xs'>1200×630 recommended</span>
                            </div>}
                        <label className='block'>
                            <span className='inline-block cursor-pointer text-sm text-blue-600 border border-blue-200 hover:bg-blue-50 px-3 py-1.5 rounded-md'>
                                {imgUrl ? 'Replace image' : 'Upload image'}
                            </span>
                            <input type='file' accept='image/*' onChange={pickImage} className='sr-only' aria-label='Cover image file' />
                        </label>
                        {errors.img && <p role='alert' className='text-xs text-red-600'>{errors.img}</p>}
                    </section>

                    <section aria-labelledby='publish-heading' className='bg-white border rounded-xl p-5 space-y-3'>
                        <h2 id='publish-heading' className='font-semibold text-gray-800'>Publishing</h2>
                        {!isNew && !scheduledNow && publishedAt && (
                            <p className='text-sm text-gray-600'>Published {new Date(publishedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
                        )}
                        <label className='flex items-center gap-2 text-sm'>
                            <input type='checkbox' checked={schedule} onChange={(e) => {
                                setSchedule(e.target.checked)
                                if (e.target.checked && !publishAt) setPublishAt(toLocalInput(new Date(Date.now() + 24 * 3600 * 1000)))
                                touch()
                            }} />
                            Schedule for later
                        </label>
                        {schedule ? (
                            <Field id='publish-at' label='Publish at (your local time)' error={errors.publishAt}
                                hint='The article stays hidden from the site, Google and the sitemap until then.'>
                                <input id='publish-at' type='datetime-local' value={publishAt} onChange={(e) => { setPublishAt(e.target.value); touch() }} className={input} />
                            </Field>
                        ) : (
                            <p className='text-xs text-gray-500'>
                                {isNew ? 'Goes live as soon as you publish.' : scheduledNow ? 'Saving now publishes it immediately.' : 'Stays live with its current date.'}
                            </p>
                        )}
                    </section>

                    <section aria-labelledby='url-heading' className='bg-white border rounded-xl p-5 space-y-3'>
                        <h2 id='url-heading' className='font-semibold text-gray-800'>URL</h2>
                        {isNew ? (
                            <p className='text-xs text-gray-500 break-all'>
                                Made from the Arabic title: <span className='font-mono text-blue-700'>/blog/{slugify(fields.title) || '…'}</span>
                            </p>
                        ) : (
                            <Field id='f-slug' label='Slug' error={errors.slug}
                                hint={fields.slug.trim() !== savedSlug ? 'Changing the URL breaks links people already shared.' : undefined}>
                                <input id='f-slug' dir='auto' value={fields.slug} onChange={(e) => setField('slug', e.target.value)} className={`${input} font-mono`} />
                            </Field>
                        )}
                    </section>
                </aside>
            </div>
        </div>
    )
}

export default ArticleEditor

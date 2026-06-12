/* eslint-disable @next/next/no-img-element */
'use client';
import ErrorMsg from "@/app/[locale]/components/ErrorMsg";
import { ImageIcon, LoadingIcon } from "@/app/[locale]/components/icons";
import { useStore } from "@/lib/zustand";
import { slugify } from "@/utils/slugify";
import axios from "axios";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import toast from "react-hot-toast";

const Blog = () => {
    const { setArticle }: any = useStore();
    const { register, formState: { errors }, handleSubmit, reset, watch } = useForm();
    const [image, setImage] = useState('')
    const [loading, setLoading] = useState(false)
    const router = useRouter()
    const btnRef = useRef<any>(null);

    const titleAr = watch('title', '')
    const titleEn = watch('titleEn', '')

    useEffect(() => {
        const input = document.getElementById('input-article-img');
        const btn = btnRef.current;
        const fn = (e: any) => { e.preventDefault(); input?.click() }
        btn?.addEventListener('click', fn)
        return () => btn?.removeEventListener('click', fn)
    }, [])

    const onSubmit = async (dataForm: any) => {
        try {
            setLoading(true)
            const formData = new FormData();
            formData.append('img', dataForm.file[0]);
            formData.append('title', dataForm.title);
            formData.append('content', dataForm.content);
            formData.append('metaDesc', dataForm.metaDesc || dataForm.content.slice(0, 155));
            if (dataForm.titleEn) formData.append('titleEn', dataForm.titleEn);
            if (dataForm.contentEn) formData.append('contentEn', dataForm.contentEn);
            if (dataForm.metaDescEn) formData.append('metaDescEn', dataForm.metaDescEn);

            const { data } = await axios.post(`/api/blog/article`, formData);
            toast.success(data.message as string)
            setArticle(data.article)
            URL.revokeObjectURL(image)
            setImage("")
            reset()
            setLoading(false)
            router.push(`/dashboard/blog/article/${data.article.id}`)
        } catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-8'>
            <div>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>New Article</h4>
                <p className='text-sm text-gray-400 mt-1'>After saving, you&apos;ll be redirected to add sections (H2 headings with paragraphs and H3 list items)</p>
            </div>

            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">

                {/* ── Hero Image ── */}
                <div>
                    <label className='block text-xs text-gray-400 mb-2 uppercase tracking-wide'>Hero Image <span className='text-red-400'>*</span></label>
                    {!image
                        ? <button ref={btnRef} type='button' className='w-full h-64 bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg flex flex-col justify-center items-center gap-2 text-gray-400 hover:border-blue-400 hover:text-blue-500 transition-colors'>
                            <ImageIcon className='size-8 stroke-current' />
                            <span className='text-sm'>Click to upload hero image (recommended: 1200×630px)</span>
                        </button>
                        : <img src={image} className='w-full h-64 rounded-lg object-cover cursor-pointer' alt='' onClick={() => document.getElementById('input-article-img')?.click()} />
                    }
                    <input
                        id='input-article-img'
                        {...register('file', {
                            required: "Please upload an image",
                            onChange: (e) => setImage(URL.createObjectURL(e.target.files[0])),
                        })}
                        type="file" accept="image/*" className='hidden'
                    />
                    <ErrorMsg message={errors?.file?.message as string} />
                </div>

                {/* ══════════════════════════════════════════
                    ARABIC SECTION
                ══════════════════════════════════════════ */}
                <div className='border-2 border-gray-100 rounded-xl p-5 space-y-4'>
                    <p className='font-semibold text-gray-600 flex items-center gap-2'>
                        🇪🇬 <span>Arabic Content (عربي)</span>
                    </p>

                    {/* H1 Arabic */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>
                            H1 Title — Arabic <span className='text-red-400'>*</span>
                            <span className='ml-2 normal-case text-gray-400'>This is the main &lt;h1&gt; tag — make it keyword-rich</span>
                        </label>
                        <input
                            {...register('title', { required: "Arabic title is required" })}
                            placeholder='مثال: كيف تبني متجرًا إلكترونيًا ناجحًا في مصر 2025'
                            className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3'
                            dir='rtl'
                        />
                        <div className='flex justify-between mt-0.5'>
                            <ErrorMsg message={errors?.title?.message as string} />
                            <span className={`text-xs ${titleAr.length > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                                {titleAr.length}/60 chars ideal
                            </span>
                        </div>
                        {titleAr && (
                            <div className='mt-1.5 flex items-center gap-2 text-xs text-gray-400 bg-gray-50 rounded px-2 py-1'>
                                <span className='font-medium text-gray-500'>URL slug:</span>
                                <span className='font-mono text-blue-600'>/blog/{slugify(titleAr)}</span>
                            </div>
                        )}
                    </div>

                    {/* Meta description Arabic */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>
                            Meta Description — Arabic
                            <span className='ml-2 normal-case text-gray-400'>Shown in Google results — 120-155 chars ideal</span>
                        </label>
                        <textarea
                            {...register('metaDesc')}
                            placeholder='وصف قصير يظهر في نتائج جوجل — مثال: تعرف على أفضل خطوات بناء متجر إلكتروني ناجح في مصر من الاختيار الصحيح للتقنية حتى الإطلاق'
                            className='w-full h-16 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                            dir='rtl'
                        />
                        <p className='text-xs text-gray-400 mt-0.5'>Leave blank to auto-generate from intro paragraph</p>
                    </div>

                    {/* Intro paragraph Arabic */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>
                            Intro Paragraph — Arabic <span className='text-red-400'>*</span>
                            <span className='ml-2 normal-case text-gray-400'>First paragraph after H1 — 100-200 words</span>
                        </label>
                        <textarea
                            {...register('content', { required: "Arabic intro paragraph is required" })}
                            placeholder='اكتب المقدمة هنا — الفقرة الأولى بعد العنوان الرئيسي. يجب أن تشمل الكلمة المفتاحية الرئيسية وتعطي القارئ سببًا للاستمرار في القراءة.'
                            className='w-full h-28 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                            dir='rtl'
                        />
                        <ErrorMsg message={errors?.content?.message as string} />
                    </div>
                </div>

                {/* ══════════════════════════════════════════
                    ENGLISH SECTION
                ══════════════════════════════════════════ */}
                <div className='border-2 border-gray-100 rounded-xl p-5 space-y-4'>
                    <p className='font-semibold text-gray-600 flex items-center gap-2'>
                        🇬🇧 <span>English Content (Optional but recommended for SEO)</span>
                    </p>

                    {/* H1 English */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>
                            H1 Title — English
                            <span className='ml-2 normal-case text-gray-400'>Keep under 60 chars</span>
                        </label>
                        <input
                            {...register('titleEn')}
                            placeholder='e.g. How to Build a Successful eCommerce App in Egypt 2025'
                            className='w-full border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3'
                        />
                        <div className='flex justify-end mt-0.5'>
                            <span className={`text-xs ${titleEn.length > 60 ? 'text-red-400' : 'text-gray-400'}`}>
                                {titleEn.length}/60 chars ideal
                            </span>
                        </div>
                    </div>

                    {/* Meta description English */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>
                            Meta Description — English
                            <span className='ml-2 normal-case text-gray-400'>120-155 chars</span>
                        </label>
                        <textarea
                            {...register('metaDescEn')}
                            placeholder='e.g. Learn how to build a successful eCommerce app in Egypt from tech stack selection to launch. Expert guide by N.I.T Egypt since 2013.'
                            className='w-full h-16 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                        />
                    </div>

                    {/* Intro paragraph English */}
                    <div>
                        <label className='block text-xs text-gray-400 mb-1 uppercase tracking-wide'>
                            Intro Paragraph — English
                            <span className='ml-2 normal-case text-gray-400'>100-200 words</span>
                        </label>
                        <textarea
                            {...register('contentEn')}
                            placeholder='Write the opening paragraph in English here. Include your primary keyword naturally in the first 100 words.'
                            className='w-full h-28 resize-none border-2 focus:border-blue-500 rounded-md outline-none py-2 px-3 text-sm'
                        />
                    </div>
                </div>

                {/* SEO tips reminder */}
                <div className='bg-blue-50 border border-blue-100 rounded-xl p-4 text-sm text-blue-700 space-y-1'>
                    <p className='font-semibold'>📋 SEO checklist for a great article:</p>
                    <ul className='list-disc list-inside space-y-0.5 text-xs'>
                        <li>H1 title contains your main keyword (e.g. &ldquo;تطبيق تجارة إلكترونية مصر&rdquo;)</li>
                        <li>Meta description is 120-155 chars and includes a call to action</li>
                        <li>Intro paragraph mentions the keyword in the first 2 sentences</li>
                        <li>After saving, add 4-6 sections (H2 headings) with 2-4 list items (H3) each</li>
                        <li>Target article length: 800-1500 words total</li>
                        <li>Hero image alt text = article title (set automatically)</li>
                    </ul>
                </div>

                <button type='submit' className='bg-blue-500 hover:bg-blue-600 py-3 rounded-lg w-full text-white flex justify-center font-medium transition-colors'>
                    {loading ? <LoadingIcon className='animate-spin size-5' /> : "Save & Add Sections →"}
                </button>
            </form>
        </div>
    )
}

export default Blog

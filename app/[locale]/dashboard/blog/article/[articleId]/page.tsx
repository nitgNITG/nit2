import React from 'react'
import ButtonAddSection from '../../../components/ButtonAddSection';
import ArticleSectionsData from '../../../components/ArticleSectionsData';
import AddArticleSection from '../../../components/AddArticleSection';

const ArticleSections = ({ params, searchParams }: { params: { articleId: string }, searchParams: any }) => {
    const { formSection } = searchParams;
    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Article section</h4>
                <ButtonAddSection />
            </div>
            <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                    <tr>
                        <th scope="col" className="px-6 py-3">
                            Title
                        </th>
                        <th scope="col" className="px-6 py-3">
                            content
                        </th>
                        <th scope="col" className="px-6 py-3">
                            list
                        </th>
                        <th scope="col" className="px-6 py-3">
                            Action
                        </th>
                    </tr>
                </thead>
                <tbody>
                    <ArticleSectionsData articleId={params.articleId} />
                </tbody>
            </table>
            {
                formSection == "true" && <AddArticleSection articleId={params.articleId} />
            }
        </div>
    )
}

export default ArticleSections
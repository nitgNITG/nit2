import Link from 'next/link'
import AddEditProject from '../components/AddEditProject'
import AppRows from '../components/AppRows'
import LocaleLink from '../../components/LocaleLink'

const Projects = ({ searchParams }: { searchParams: any }) => {
    const { applicationform } = searchParams

    return (
        <div className='dashboard-container py-5 lg:py-10 '>
            <div className='space-y-10'>
                <div className='flex justify-between items-center'>
                    <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Application</h4>
                    <LocaleLink href={'/dashboard/application?applicationform=true'} className='bg-blue-500 text-white px-5 py-2 rounded-md uppercase'>
                        ADD App
                    </LocaleLink>
                </div>
                <div className=' overflow-auto bg-white'>
                    <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                        <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                            <tr>
                                <th scope="col" className="px-6 py-3">
                                    Image
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Title
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    description
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Title English
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    description English
                                </th>
                                <th scope="col" className="px-6 py-3">
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <AppRows />
                        </tbody>
                    </table>
                </div>
            </div>
            {
                applicationform == "true" && <AddEditProject type='app' />
            }
        </div>
    )
}

export default Projects
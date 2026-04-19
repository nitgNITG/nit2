import AddSponser from '../components/AddSponser'
import SponserRows from '../components/SponserRows'
import LocaleLink from '../../components/LocaleLink'

const Projects = ({ searchParams }: { searchParams: any }) => {
    const { sponserform } = searchParams

    return (
        <div className='dashboard-container py-5 lg:py-10 '>
            <div className='space-y-10'>
                <div className='flex justify-between items-center'>
                    <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Sponsers</h4>
                    <LocaleLink href={'/dashboard/sponsers?sponserform=true'} className='bg-blue-500 text-white px-5 py-2 rounded-md uppercase'>
                        ADD Sponser
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
                                    Action
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            <SponserRows />
                        </tbody>
                    </table>
                </div>
            </div>
            {
                sponserform == "true" && <AddSponser />
            }
        </div>
    )
}

export default Projects
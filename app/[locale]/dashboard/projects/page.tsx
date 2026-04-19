import AddEditProject from '../components/AddEditProject'
import TableRows from '../components/TableRow'
import ButtonDashboard from '../components/ButtonDashboard'

const Projects = ({ searchParams }: { searchParams: any }) => {
    const { projectform } = searchParams

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Projects</h4>
                <ButtonDashboard href='/dashboard/projects?projectform=true' >
                    ADD PROJECT
                </ButtonDashboard>
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
                        <TableRows />
                    </tbody>
                </table>
            </div>
            {
                projectform == "true" && <AddEditProject type='project' />
            }
        </div>
    )
}

export default Projects
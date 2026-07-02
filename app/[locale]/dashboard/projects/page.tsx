import AddEditProject from '../components/AddEditProject'
import TableRows from '../components/TableRow'
import ButtonDashboard from '../components/ButtonDashboard'

const Projects = ({ searchParams }: { searchParams: any }) => {
    const { projectform } = searchParams

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>
                    All Projects
                    <span className='block text-sm font-normal text-gray-500 mt-0.5'>المشاريع</span>
                </h4>
                <ButtonDashboard href='/dashboard/projects?projectform=true'>
                    ADD PROJECT
                </ButtonDashboard>
            </div>
            <div className='overflow-auto bg-white rounded-lg shadow-sm'>
                <table className="w-full text-sm text-left text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th className="px-4 py-3">Image</th>
                            <th className="px-4 py-3">Title (AR / EN)</th>
                            <th className="px-4 py-3">Description</th>
                            <th className="px-4 py-3">Types</th>
                            <th className="px-4 py-3">Links</th>
                            <th className="px-4 py-3">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        <TableRows />
                    </tbody>
                </table>
            </div>
            {projectform === 'true' && <AddEditProject />}
        </div>
    )
}

export default Projects

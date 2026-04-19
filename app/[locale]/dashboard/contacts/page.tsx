import ContactRows from "../components/ContactRows";

const Contacts = () => {

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Contacts</h4>
            </div>
            <div className=' overflow-auto bg-white'>
                <table className="w-full text-sm text-left rtl:text-right text-gray-500">
                    <thead className="text-xs text-gray-700 uppercase bg-gray-50">
                        <tr>
                            <th scope="col" className="px-6 py-3">
                                No
                            </th>
                            <th scope="col" className="px-6 py-3">
                                Name
                            </th>
                            <th scope="col" className="px-6 py-3">
                                Email
                            </th>
                            <th scope="col" className="px-6 py-3">
                                Subject
                            </th>
                            <th scope="col" className="px-6 py-3">
                                Message
                            </th>
                        </tr>
                    </thead>
                    <tbody className="">
                        <ContactRows />
                    </tbody>
                </table>
            </div>
        </div>
    )
}

export default Contacts
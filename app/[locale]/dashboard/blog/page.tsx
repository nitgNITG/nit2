import Link from "next/link"
import Articles from "../components/Articles"
import LocaleLink from "../../components/LocaleLink"

const Blog = () => {

    return (
        <div className='dashboard-container py-5 lg:py-10 space-y-10'>
            <div className='flex justify-between items-center'>
                <h4 className='font-bold text-lg md:text-xl lg:text-2xl'>Blog</h4>
                <LocaleLink
                    className='bg-blue-500 text-white px-5 py-2 rounded-md uppercase'
                    href='/dashboard/blog/article' >
                    Add article
                </LocaleLink>
            </div>
            <div className=' '>
                <Articles />
            </div>
        </div>
    )
}

export default Blog
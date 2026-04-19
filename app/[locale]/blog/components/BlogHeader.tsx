import { useTranslations } from "next-intl";
import { Logo } from "../../components/icons"
import Navbar from "../../components/Navbar"

const BlogHeader = () => {
    const t = useTranslations('blog');
    return (
        <header className=''>
            <div className='bg-[url("/our_projects.jpg")] bg-[-250px] md:bg-top bg-cover bg-no-repeat min-h-svh lg:min-h-[77svh] p-container'>
                <div className='py-10 '>
                    <Navbar />
                </div>
                <div className='h-full p-container relative flex justify-center'>
                    <div className='absolute lg:right-0 top-56 lg:top-10'>
                        <Logo className='size-56' />
                    </div>
                    <div className='lg:absolute top-20 left-0 lg:w-[600px]'>
                        <div className='relative flex justify-center items-center py-10 lg:py-10 px-5'>
                            <div className='w-full absolute text-white bg-white/10 py-8 rounded-lg blur-[2px] ' />
                            <p className='text-white font-bold text-lg text-center'>
                                {t('title')}
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </header>
    )
}

export default BlogHeader
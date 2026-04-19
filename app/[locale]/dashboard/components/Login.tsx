import React from 'react'
import FormData from './FormData'
import { Logo } from '../../components/icons'

const Login = () => {
    return (
        <div className='w-full min-h-svh'>
            <div>
                <section className="bg-gray-50">
                    <div className="flex flex-col items-center justify-center px-6 py-8 mx-auto min-h-svh lg:py-0">
                        <div className='pb-5'>
                            <Logo className='size-32' />
                        </div>
                        <div className="w-full bg-white rounded-lg shadow md:mt-0 sm:max-w-md xl:p-0 ">
                            <div className="p-6 space-y-4 md:space-y-6 sm:p-8">
                                <h1 className="text-xl font-bold leading-tight tracking-tight text-gray-900 md:text-2xl ">
                                    Sign in to your account
                                </h1>
                                <FormData />
                            </div>
                        </div>
                    </div>
                </section>
            </div>
        </div>
    )
}

export default Login
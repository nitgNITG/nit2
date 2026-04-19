'use client'
import axios from 'axios';
import React, { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast';
import ErrorMsg from '../../components/ErrorMsg';
import { LoadingIcon } from '../../components/icons';

const FormData = () => {
    const [loading, setLoading] = useState(false)
    const { register, handleSubmit, formState: { errors }, reset } = useForm();
    const onSubmit = async (formData: any) => {
        try {
            setLoading(true)
            const { data } = await axios.post('/api/sign-in', { ...formData })
            toast.success(data.message as string)
            reset()
            setLoading(false)
            window.location.reload();
        }
        catch (error: any) {
            toast.error(error?.response?.data?.message || 'There is an Error')
            setLoading(false)
        }
    }
    return (
        <form
            onSubmit={handleSubmit(onSubmit)}
            className="space-y-4 md:space-y-6" >
            <div>
                <label htmlFor="email" className="block mb-2 text-sm font-medium text-gray-900 ">Your email</label>
                <input
                    {...register('email', { required: "Please Enter the email." })}
                    id="email"
                    type="email"
                    placeholder="admin@company.com"
                    className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5 " />
                <ErrorMsg message={errors?.email?.message as string} />
            </div>
            <div>
                <label htmlFor="password" className="block mb-2 text-sm font-medium text-gray-900 ">Password</label>
                <input
                    {...register('password', { required: "Please Enter the password." })}
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    className="bg-gray-50 border border-gray-300 text-gray-900 rounded-lg focus:ring-blue-600 focus:border-blue-600 block w-full p-2.5 "
                />
                <ErrorMsg message={errors?.password?.message as string} />
            </div>
            <button
                disabled={loading}
                className="w-full text-white bg-blue-500 disabled:bg-blue-300 hover:bg-blue-700 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm px-5 py-2.5 text-center flex justify-center items-center">
                {loading ? <LoadingIcon className='animate-spin size-5' /> : "Sign in"}
            </button>
        </form>
    )
}

export default FormData
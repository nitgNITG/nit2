import React from 'react'
import useClickOutside from '../../hook/useClickOutSide'
import { CloseIcon, LoadingIcon } from '../../components/icons'

const DailogDelete = ({
    title,
    message,
    close,
    loading,
    handleDelete
}:
    {
        title: string,
        message: string,
        close: () => void,
        loading: boolean,
        handleDelete: () => void
    }) => {
    const eleRef = useClickOutside(close)

    return (
        <div className='w-full h-full fixed bg-black/20 top-0 left-0 flex justify-center items-center px-5 z-50'>
            <div ref={eleRef} className='bg-white w-full sm:w-[420px] md:w-[500px] lg:w-[550px] rounded-md max-h-[95svh] overflow-auto'>
                <div className='space-y-3'>
                    <div className='w-full flex justify-between py-3 border-b-2 px-2'>
                        <h6>
                            {title}
                        </h6>
                        <button
                            onClick={close}
                        >
                            <CloseIcon className='w-5 h-5' />
                        </button>
                    </div>
                    <div className='py-5 px-3'>
                        <p className=''>{message}</p>
                    </div>
                    <div className='flex justify-start px-3 py-2 gap-3 bg-gray-100'>
                        <button
                            disabled={loading}
                            className='px-3 py-2 rounded-md text-white disabled:bg-black/20 disabled:px-10 bg-red-500'
                            onClick={handleDelete}
                        >
                            {loading ? <LoadingIcon className='w-6 h-6 animate-spin' /> : "Delete"}
                        </button>
                        <button
                            disabled={loading}
                            className='px-3 py-2 rounded-md bg-gray-300'
                            onClick={close}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}

export default DailogDelete
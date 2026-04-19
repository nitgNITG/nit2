import React from 'react'

const LoadingCard = ({ number }: { number: number }) => {
    return (
        Array(number).fill("").map((_, i) => (
            <div
                key={i}
                className="col-span-12 md:col-span-6 lg:col-span-4 border bg-slate-50 animate-pulse overflow-hidden rounded-xl h-full relative group"
            >
                <div className='block space-y-3'>
                    <div
                        className='w-full h-52 bg-slate-200 animate-pulse '
                    />
                    <div className='p-3 text-right h-32 space-y-3'>
                        {
                            Array(3).fill("").map((_, i) => {
                                return <div key={i} className='space-y-2'>
                                    <h2 className="w-full bg-slate-200 h-2 animate-pulse"></h2>
                                    <p className="w-full bg-slate-200 h-1 animate-pulse"></p>
                                </div>
                            })
                        }
                    </div>
                </div>
            </div>
        ))
    )
}

export default LoadingCard
import React from 'react'

const loading = () => {
    return (
        <div className='min-h-svh w-full flex justify-center items-center'>
            <div className="loader">
                <div className="cube">
                    <div className="face"></div>
                    <div className="face"></div>
                    <div className="face"></div>
                    <div className="face"></div>
                    <div className="face"></div>
                    <div className="face"></div>
                </div>
            </div>
        </div>
    )
}

export default loading
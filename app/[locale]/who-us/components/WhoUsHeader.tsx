import React from 'react'
import Navbar from '../../components/Navbar'

const WhoUsHeader = () => {
    return (
        <header className=''>
            <div className='bg-[url("/header_whous.jpg")] bg-[-250px] md:bg-center bg-cover bg-no-repeat min-h-svh p-container'>
                <div className='py-10 '>
                    <Navbar />
                </div>
            </div>
        </header>
    )
}

export default WhoUsHeader
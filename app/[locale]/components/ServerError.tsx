'use client'
import React, { useEffect } from 'react'
import toast from 'react-hot-toast'

const ServerError = ({ message }: { message: string }) => {
    useEffect(() => {
        toast.error(message)
    })
    return (
        <></>
    )
}

export default ServerError
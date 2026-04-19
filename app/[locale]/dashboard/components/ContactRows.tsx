'use client'
import React, { useCallback, useEffect, useState } from 'react'
import axios from 'axios'
import { useStore } from '@/lib/zustand'

const ContactRows = () => {
    const { contacts, setContacts, setContact, setUnReadContact, unReadContact }: any = useStore();
    const [skip, setSkip] = useState(0);
    const [loading, setLoading] = useState(false);
    const [hasMoreData, setHasMoreData] = useState(true); // Track if more data is available

    useEffect(() => {
        const handleScroll = () => {
            const scrollTop = window.scrollY || document.documentElement.scrollTop;
            const viewportHeight = window.innerHeight;
            const documentHeight = document.documentElement.scrollHeight;
            if (scrollTop + viewportHeight >= documentHeight - 10) {
                if (hasMoreData && !loading) {
                    setSkip((prevSkip) => prevSkip + 17);
                }
            }
        };

        window.addEventListener('scroll', handleScroll);
        return () => {
            window.removeEventListener('scroll', handleScroll);
        };
    }, [hasMoreData, loading]);

    const fetchContacts = useCallback(async () => {
        try {
            setLoading(true);
            const { data } = await axios.get(`/api/contact?skip=${skip}`);

            if (data.contacts.length === 0) {
                setHasMoreData(false); // No more data to load
            } else {
                if (skip > 0) {
                    data.contacts.forEach((ele: any) => {
                        setContact(ele);
                    });
                } else {
                    setContacts(data.contacts);
                }
            }

            setLoading(false);
        } catch (error: any) {
            console.error(error);
            setLoading(false);
        }
    }, [setContact, setContacts, skip]);

    useEffect(() => {
        if (hasMoreData) {
            fetchContacts();
        }
    }, [fetchContacts, hasMoreData]);

    useEffect(() => {
        if (unReadContact) {
            axios.put('/api/contact').then((data) => {
                console.log(data.data.message);
                setUnReadContact(0)
            })
        }
    }, [setUnReadContact, unReadContact])
    return (
        !contacts?.length ?
            <tr className="odd:bg-white even:bg-gray-50 border-b ">
                <td scope="row" colSpan={5} className="px-6 py-4 text-center">
                    {loading ? "Loading...." : "No Project Yet"}
                </td>
            </tr>
            :
            <>
                {
                    contacts?.map((contact: any, index: number) => (
                        <tr key={contact.id} className="odd:bg-white even:bg-gray-50 border-b ">
                            <td scope="row" className="px-6 py-4  ">
                                {index + 1}
                            </td>
                            <td scope="row" className="px-6 py-4  ">
                                {contact.name}
                            </td>
                            <td className="px-6 py-4">
                                {contact.email}
                            </td>
                            <td className="px-6 py-4">
                                {contact.subject}
                            </td>
                            <td className="px-6 py-4">
                                {contact.message}
                            </td>
                        </tr>
                    ))
                }
            </>
    )
}

export default ContactRows
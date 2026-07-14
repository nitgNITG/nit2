import type { Metadata } from "next";
import Sidebar from "./components/Sidebar";
import './style.css'
import { cookies } from "next/headers";
import Login from "./components/Login";
import prisma from "@/prisma/client";

export const metadata: Metadata = {
    title: { absolute: "Dashboard | N.I.T Egypt" },
    description: "N.I.T Egypt admin dashboard.",
    robots: { index: false, follow: false },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const token = cookies().get('token')?.value
    return (
        <div dir="ltr" >
            {
                token ?
                    <div className="text-left">
                        <div className=" bg-gray-100 lg:flex min-h-svh">
                            <Sidebar />
                            <div className="flex-1 min-w-0">
                                {children}
                            </div>
                        </div>
                    </div>
                    :
                    <div className="text-left">
                        <Login />
                    </div>
            }
        </div>
    );
}

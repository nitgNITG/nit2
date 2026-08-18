import type { Metadata } from "next";
import Sidebar from "./components/Sidebar";
import './style.css'
import Login from "./components/Login";
import { getCurrentUser } from "@/lib/auth";
import { redirect } from "@/navigation";

export const metadata: Metadata = {
    title: { absolute: "Dashboard | N.I.T Egypt" },
    description: "N.I.T Egypt admin dashboard.",
    robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const user = await getCurrentUser();

    // Not signed in → show the admin login.
    if (!user) {
        return (
            <div dir="ltr" className="text-left">
                <Login />
            </div>
        );
    }

    // Signed in as a client → this is the admin area; send them to their own space.
    if (user.role === 'client') {
        redirect('/account');
    }

    return (
        <div dir="ltr">
            <div className="text-left">
                <div className="bg-gray-100 lg:flex min-h-svh">
                    <Sidebar />
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

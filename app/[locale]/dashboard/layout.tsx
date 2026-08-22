import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Sidebar from "./components/Sidebar";
import './style.css'
import Login from "./components/Login";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
    title: { absolute: "Dashboard | N.I.T Egypt" },
    description: "N.I.T Egypt admin dashboard.",
    robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic"; // uses cookies() → always per-request

export default async function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    const user = await getCurrentUser();

    // Not signed in → show the admin login.
    if (!user) {
        return (
            <div dir="ltr">
                <div className="text-left">
                    <Login />
                </div>
            </div>
        );
    }

    // Signed in but not an admin → the dashboard is admins-only; send clients to their area.
    if (user.role !== "admin") {
        redirect("/account");
    }

    return (
        <div dir="ltr">
            <div className="text-left">
                <div className=" bg-gray-100 lg:flex min-h-svh">
                    <Sidebar />
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

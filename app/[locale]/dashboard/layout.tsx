import type { Metadata } from "next";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import Sidebar from "./components/Sidebar";
import './style.css'
import Login from "./components/Login";
import { getCurrentUser } from "@/lib/auth";
import { getAgentStaff } from "@/lib/agent";
import { agentNav, dashboardPathAllowed, staffLandingPage } from "@/lib/agent/admin";

export const metadata: Metadata = {
    title: { absolute: "Dashboard | N.I.T Egypt" },
    description: "N.I.T Egypt admin dashboard.",
    robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic"; // uses cookies() → always per-request

export default async function RootLayout({
    children,
    params,
}: Readonly<{
    children: React.ReactNode;
    params: { locale: string };
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

    const locale = params?.locale === "ar" ? "ar" : "en";
    const staff = await getAgentStaff();
    if (!staff) redirect(`/${locale}/account`);

    // Clients reach the dashboard only as AI-agent staff (sales / support / viewer),
    // and then only the agent pages their permissions allow (SRS §13.14). Everyone
    // else goes to their own area. Unknown path (no header) → fail closed.
    if (!staff.isAdmin) {
        const landing = staffLandingPage(staff);
        if (!landing) redirect(`/${locale}/account`);
        const path = (headers().get("x-nit-pathname") ?? "").replace(/^\/(ar|en)(?=\/|$)/, "");
        if (!dashboardPathAllowed(path, staff)) redirect(`/${locale}${landing}`);
    }

    return (
        <div dir="ltr">
            <div className="text-left">
                <div className=" bg-gray-100 lg:flex min-h-svh">
                    <Sidebar isAdmin={staff.isAdmin} agentItems={agentNav(staff)} />
                    <div className="flex-1 min-w-0">
                        {children}
                    </div>
                </div>
            </div>
        </div>
    );
}

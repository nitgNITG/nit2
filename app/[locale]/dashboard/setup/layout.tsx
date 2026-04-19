// Setup page is always accessible (no auth required) so you can fix problems
// even when you can't log in yet
export default function SetupLayout({ children }: { children: React.ReactNode }) {
    return (
        <div dir="ltr" className="text-left bg-gray-100 min-h-svh p-5 lg:p-10">
            {children}
        </div>
    )
}

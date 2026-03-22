import Link from "next/link";
import Image from "next/image";
import { ReactNode } from "react";
import { redirect } from "next/navigation";

import { isAuthenticated } from "@/lib/actions/auth.action";
import SignOutButton from "@/components/SignOutButton";

const Layout = async ({ children }: { children: ReactNode }) => {
    const isUserAuthenticated = await isAuthenticated();
    if (!isUserAuthenticated) redirect("/sign-in");

    return (
        <div className="root-layout">
            <nav>
                <div className="flex w-full items-center justify-between gap-4">
                    <Link href="/" className="flex items-center gap-2">
                        <Image src="/logo.svg" alt="PrepYou Logo" width={38} height={32} />
                        <h2 className="text-primary-100">PrepYou</h2>
                    </Link>

                    <SignOutButton />
                </div>
            </nav>

            <main className="page-enter">
                {children}
            </main>
        </div>
    );
};

export default Layout;

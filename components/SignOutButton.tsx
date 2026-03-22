"use client";

import { useRouter } from "next/navigation";

import { auth } from "@/firebase/client";
import { signOut } from "@/lib/actions/auth.action";
import { Button } from "@/components/ui/button";

const SignOutButton = () => {
    const router = useRouter();

    const handleSignOut = async () => {
        await auth.signOut();
        await signOut();
        router.replace("/sign-in");
        router.refresh();
    };

    return (
        <Button className="btn-secondary" onClick={() => void handleSignOut()}>
            Sign Out
        </Button>
    );
};

export default SignOutButton;

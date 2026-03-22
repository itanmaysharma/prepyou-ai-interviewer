"use client";

import { z } from "zod";
import Link from "next/link";
import Image from "next/image";
import { toast } from "sonner";
import { auth } from "@/firebase/client";
import { FirebaseError } from "firebase/app";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";

import {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    sendPasswordResetEmail,
    signOut as firebaseSignOut,
} from "firebase/auth";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";

import { signIn, signUp } from "@/lib/actions/auth.action";
import FormField from "./FormField";

const AUTH_ERROR_MESSAGES: Record<string, string> = {
    "auth/email-already-in-use": "This email is already in use.",
    "auth/invalid-credential": "Invalid email or password.",
    "auth/invalid-email": "Enter a valid email address.",
    "auth/network-request-failed": "Network error. Please try again.",
    "auth/too-many-requests": "Too many attempts. Please try again later.",
    "auth/user-not-found": "User does not exist. Create an account.",
    "auth/weak-password": "Password should be at least 6 characters.",
    "auth/wrong-password": "Invalid email or password.",
};

const authFormSchema = (type: FormType) => {
    return z.object({
        name: type === "sign-up" ? z.string().min(3) : z.string().optional(),
        email: z.string().email(),
        password: z.string().min(3),
    });
};

const AuthForm = ({ type }: { type: FormType }) => {
    const router = useRouter();

    const formSchema = authFormSchema(type);
    const form = useForm<z.infer<typeof formSchema>>({
        resolver: zodResolver(formSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
        },
    });

    const getErrorMessage = (error: unknown) => {
        if (error instanceof FirebaseError) {
            return AUTH_ERROR_MESSAGES[error.code] || "Authentication failed.";
        }

        if (error instanceof Error) return error.message;

        return "Something went wrong. Please try again.";
    };

    const onSubmit = async (data: z.infer<typeof formSchema>) => {
        try {
            if (type === "sign-up") {
                const { name, email, password } = data;

                const userCredential = await createUserWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                const result = await signUp({
                    uid: userCredential.user.uid,
                    name: name!,
                    email,
                    password,
                });

                if (!result.success) {
                    await firebaseSignOut(auth);
                    toast.error(result.message);
                    return;
                }

                toast.success(result.message);
                router.replace("/sign-in");
                router.refresh();
            } else {
                const { email, password } = data;

                const userCredential = await signInWithEmailAndPassword(
                    auth,
                    email,
                    password
                );

                const idToken = await userCredential.user.getIdToken();
                if (!idToken) {
                    toast.error("Sign in Failed. Please try again.");
                    return;
                }

                const result = await signIn({
                    email,
                    idToken,
                });

                if (!result.success) {
                    await firebaseSignOut(auth);
                    toast.error(result.message);
                    return;
                }

                toast.success(result.message);
                router.replace("/");
                router.refresh();
            }
        } catch (error) {
            console.error(error);
            toast.error(getErrorMessage(error));
        }
    };

    const handleForgotPassword = async () => {
        const email = form.getValues("email");

        if (!email) {
            toast.error("Enter your email first to receive a reset link.");
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            toast.success("Password reset email sent.");
        } catch (error) {
            toast.error(getErrorMessage(error));
        }
    };

    const isSignIn = type === "sign-in";
    const isSubmitting = form.formState.isSubmitting;

    return (
        <div className="card-border lg:min-w-[566px]">
            <div className="flex flex-col gap-6 card py-14 px-10">
                <div className="flex flex-row gap-2 justify-center">
                    <Image src="/logo.svg" alt="logo" height={32} width={38} />
                    <h2 className="text-primary-100">PrepYou</h2>
                </div>

                <h3>Practice job interviews with AI</h3>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="w-full space-y-6 mt-4 form"
                    >
                        {!isSignIn && (
                            <FormField
                                control={form.control}
                                name="name"
                                label="Name"
                                placeholder="Your Name"
                                type="text"
                            />
                        )}

                        <FormField
                            control={form.control}
                            name="email"
                            label="Email"
                            placeholder="Your email address"
                            type="email"
                        />

                        <FormField
                            control={form.control}
                            name="password"
                            label="Password"
                            placeholder="Enter your password"
                            type="password"
                        />

                        {isSignIn && (
                            <div className="flex justify-end">
                                <button
                                    type="button"
                                    onClick={() => void handleForgotPassword()}
                                    className="text-sm font-medium text-user-primary cursor-pointer"
                                >
                                    Forgot password?
                                </button>
                            </div>
                        )}

                        <Button className="btn" type="submit" disabled={isSubmitting}>
                            {isSubmitting
                                ? isSignIn
                                    ? "Signing In..."
                                    : "Creating Account..."
                                : isSignIn
                                  ? "Sign In"
                                  : "Create an Account"}
                        </Button>
                    </form>
                </Form>

                <p className="text-center">
                    {isSignIn ? "No account yet?" : "Have an account already?"}
                    <Link
                        href={!isSignIn ? "/sign-in" : "/sign-up"}
                        className="font-bold text-user-primary ml-1"
                    >
                        {!isSignIn ? "Sign In" : "Sign Up"}
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default AuthForm;

"use server";

import { auth, db } from "@/firebase/admin";
import { cookies } from "next/headers";

// Session duration (1 week)
const SESSION_DURATION = 60 * 60 * 24 * 7;
const SESSION_COOKIE_NAME = "session";

// Set session cookie
export async function setSessionCookie(idToken: string) {
    const cookieStore = await cookies();

    // Create session cookie
    const sessionCookie = await auth.createSessionCookie(idToken, {
        expiresIn: SESSION_DURATION * 1000, // milliseconds
    });

    // Set cookie in the browser
    cookieStore.set(SESSION_COOKIE_NAME, sessionCookie, {
        maxAge: SESSION_DURATION,
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        path: "/",
        sameSite: "lax",
    });
}

async function clearSessionCookie() {
    const cookieStore = await cookies();
    cookieStore.delete(SESSION_COOKIE_NAME);
}

export async function signUp(
    params: SignUpParams
): Promise<AuthActionResult> {
    const { uid, name, email } = params;

    try {
        // check if user exists in db
        const userRecord = await db.collection("users").doc(uid).get();
        if (userRecord.exists)
            return {
                success: false,
                message: "User already exists. Please sign in.",
            };

        // save user to db
        await db.collection("users").doc(uid).set({
            name,
            email,
            // profileURL,
            // resumeURL,
        });

        return {
            success: true,
            message: "Account created successfully. Please sign in.",
        };
    } catch (error: any) {
        console.error("Error creating user:", error);

        // Handle Firebase specific errors
        if (error.code === "auth/email-already-exists") {
            return {
                success: false,
                message: "This email is already in use",
            };
        }

        return {
            success: false,
            message: "Failed to create account. Please try again.",
        };
    }
}

export async function signIn(
    params: SignInParams
): Promise<AuthActionResult> {
    const { email, idToken } = params;

    try {
        const authUser = await auth.getUserByEmail(email);
        const appUser = await db.collection("users").doc(authUser.uid).get();

        if (!appUser.exists) {
            return {
                success: false,
                message: "Account setup is incomplete. Please sign up again.",
            };
        }

        await setSessionCookie(idToken);

        return {
            success: true,
            message: "Signed in successfully.",
        };
    } catch (error: any) {
        console.error("Error signing in:", error);

        return {
            success: false,
            message: "Failed to log into account. Please try again.",
        };
    }
}

// Sign out user by clearing the session cookie
export async function signOut() {
    await clearSessionCookie();
}

// Get current user from session cookie
export async function getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();

    const sessionCookie = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!sessionCookie) return null;

    try {
        const decodedClaims = await auth.verifySessionCookie(sessionCookie, true);

        // get user info from db
        const userRecord = await db
            .collection("users")
            .doc(decodedClaims.uid)
            .get();
        if (!userRecord.exists) return null;

        return {
            ...userRecord.data(),
            id: userRecord.id,
        } as User;
    } catch (error) {
        console.error("Error verifying session:", error);
        await clearSessionCookie();

        // Invalid or expired session
        return null;
    }
}

// Check if user is authenticated
export async function isAuthenticated() {
    const user = await getCurrentUser();
    return !!user;
}

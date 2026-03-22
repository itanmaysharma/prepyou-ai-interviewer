import Link from "next/link";
import Image from "next/image";
import { redirect } from "next/navigation";

import { Button } from "@/components/ui/button";
import InterviewCard from "@/components/InterviewCard";

import { getCurrentUser } from "@/lib/actions/auth.action";
import { getInterviewsByUserId } from "@/lib/actions/general.action";

async function Home() {
    const user = await getCurrentUser();
    if (!user) redirect("/sign-in");

    const [userInterviews] = await Promise.all([getInterviewsByUserId(user.id)]);

    const interviewsByUser = userInterviews ?? [];
    const hasGeneratedInterviews = interviewsByUser.length > 0;

    return (
        <>
            <section className="card-cta">
                <div className="flex flex-col gap-6 max-w-lg">
                    <h2>Get Interview-Ready with AI-Powered Practice & Feedback</h2>
                    <p className="text-lg">
                        Just click the button 👇🏻 and give the details to generate personalized interview
                    </p>

                    <Button asChild className="btn-primary max-sm:w-full">
                        <Link href="/interview">Start an Interview</Link>
                    </Button>
                </div>

                <Image
                    src="/robot.png"
                    alt="robo-dude"
                    width={400}
                    height={300}
                    className="max-sm:hidden"
                />
            </section>

            <section className="flex flex-col gap-6 mt-8">
                <h2>Your Interviews</h2>

                <div className="interviews-section">
                    {hasGeneratedInterviews ? (
                        interviewsByUser.map((interview) => (
                            <InterviewCard
                                key={interview.id}
                                userId={user.id}
                                interviewId={interview.id}
                                role={interview.role}
                                type={interview.type}
                                techstack={interview.techstack}
                                createdAt={interview.createdAt}
                                coverImage={interview.coverImage}
                                visibilityMode="completed-only"
                            />
                        ))
                    ) : (
                        <p>You haven&apos;t completed any interviews yet</p>
                    )}
                </div>
            </section>

            <section className="flex flex-col gap-6 mt-8">
                <h2>Take Interviews</h2>

                <div className="interviews-section">
                    {hasGeneratedInterviews ? (
                        interviewsByUser.map((interview) => (
                            <InterviewCard
                                key={interview.id}
                                userId={user.id}
                                interviewId={interview.id}
                                role={interview.role}
                                type={interview.type}
                                techstack={interview.techstack}
                                createdAt={interview.createdAt}
                                coverImage={interview.coverImage}
                                actionMode="take"
                            />
                        ))
                    ) : (
                        <p>You haven&apos;t generated any interviews yet</p>
                    )}
                </div>
            </section>
        </>
    );
}

export default Home;

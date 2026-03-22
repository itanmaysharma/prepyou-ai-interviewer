import Image from "next/image";
import { redirect } from "next/navigation";

import Agent from "@/components/Agent";

import {
    getFeedbackByInterviewId,
    getInterviewById,
} from "@/lib/actions/general.action";
import { getCurrentUser } from "@/lib/actions/auth.action";
import DisplayTechIcons from "@/components/DisplayTechIcons";

const InterviewDetails = async ({ params }: RouteParams) => {
    const { id } = await params;

    const user = await getCurrentUser();
    if (!user) redirect("/sign-in");

    const interview = await getInterviewById(id);
    if (!interview) redirect("/");

    const safeTechstack = Array.isArray(interview.techstack)
        ? interview.techstack.filter(
              (tech): tech is string => typeof tech === "string" && tech.trim().length > 0
          )
        : [];

    if (!Array.isArray(interview.techstack)) {
        console.warn("Interview details received an invalid techstack value.", {
            interviewId: id,
            techstack: interview.techstack,
        });
    }

    const feedback = await getFeedbackByInterviewId({
        interviewId: id,
        userId: user.id,
    });

    return (
        <>
            <div className="flex flex-row gap-4 justify-between">
                <div className="flex flex-row gap-4 items-center max-sm:flex-col">
                    <div className="flex flex-row gap-4 items-center">
                        <Image
                            src={interview.coverImage || "/covers/adobe.png"}
                            alt="cover-image"
                            width={40}
                            height={40}
                            className="rounded-full object-cover size-[40px]"
                        />
                        <h3 className="capitalize">{interview.role} Interview</h3>
                    </div>
                    <DisplayTechIcons techStack={safeTechstack} />
                </div>

                <p className="bg-dark-200 px-4 py-2 rounded-lg h-fit">
                    {interview.type}
                </p>
            </div>

            <div className="mt-4">
                <Agent
                    userName={user.name}
                    userId={user.id}
                    interviewId={id}
                    type="interview"
                    questions={interview.questions}
                    feedbackId={feedback?.id}
                />
            </div>
        </>
    );
};

export default InterviewDetails;

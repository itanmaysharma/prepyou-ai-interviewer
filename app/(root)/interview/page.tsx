import InterviewGenerationForm from "@/components/InterviewGenerationForm";
import { getCurrentUser } from "@/lib/actions/auth.action";
import { redirect } from "next/navigation";

const Page = async () => {
    const user = await getCurrentUser();
    if (!user) redirect("/sign-in");

    return (
        <div className="flex flex-col gap-6">
            <h3>Interview Generation</h3>

            <InterviewGenerationForm userId={user.id} />
        </div>
    );
};

export default Page;

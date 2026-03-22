"use client";

import { z } from "zod";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";

import { Form } from "@/components/ui/form";
import { Button } from "@/components/ui/button";
import FormField from "@/components/FormField";

const generationFormSchema = z.object({
    role: z.string().trim().min(2, "Enter the target role."),
    type: z.enum(["Technical", "Behavioral", "Mixed"]),
    level: z.string().trim().min(2, "Enter the target level."),
    amount: z
        .string()
        .trim()
        .regex(/^\d+$/, "Enter a number between 1 and 20.")
        .refine((value) => {
            const amount = Number(value);
            return amount >= 1 && amount <= 20;
        }, "Question count must be between 1 and 20."),
    techstack: z.string().trim().min(2, "Enter at least one technology."),
});

type GenerationFormValues = z.infer<typeof generationFormSchema>;

const InterviewGenerationForm = ({
    userId,
}: {
    userId: string;
}) => {
    const router = useRouter();
    const form = useForm<GenerationFormValues>({
        resolver: zodResolver(generationFormSchema),
        defaultValues: {
            role: "",
            type: "Technical",
            level: "",
            amount: "5",
            techstack: "",
        },
    });

    const onSubmit = async (values: GenerationFormValues) => {
        try {
            const response = await fetch("/api/vapi/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...values,
                    userId,
                }),
            });

            const result = await response.json();

            if (response.ok && result.success && result.interviewId) {
                router.replace(`/interview/${result.interviewId}`);
                return;
            }

            const fieldError =
                result?.fieldErrors && typeof result.fieldErrors === "object"
                    ? Object.values(result.fieldErrors)[0]
                    : null;
            form.setError("root", {
                message:
                    typeof fieldError === "string"
                        ? fieldError
                        : "Interview generation failed. Review the details and try again.",
            });
        } catch {
            form.setError("root", {
                message: "Interview generation failed. Please try again.",
            });
        }
    };

    return (
        <div className="card-border w-full max-w-[720px] mx-auto form-reveal-shell">
            <div className="card py-10 px-8 flex flex-col gap-6">
                <div className="flex flex-col gap-2 form-reveal-step form-reveal-step-1">
                    <h3>Create an interview</h3>
                    <p>
                        Enter the target role, interview style, level, question count,
                        and tech stack to generate a tailored mock interview.
                    </p>
                </div>

                <Form {...form}>
                    <form
                        onSubmit={form.handleSubmit(onSubmit)}
                        className="grid gap-4 sm:grid-cols-2 form form-reveal-step form-reveal-step-2"
                    >
                        <FormField
                            control={form.control}
                            name="role"
                            label="Role"
                            placeholder="e.g. Frontend developer"
                        />

                        <div className="flex flex-col gap-2">
                            <label className="label">Interview Type</label>
                            <select
                                className="input"
                                {...form.register("type")}
                            >
                                <option value="Technical">Technical</option>
                                <option value="Behavioral">Behavioral</option>
                                <option value="Mixed">Mixed</option>
                            </select>
                        </div>

                        <FormField
                            control={form.control}
                            name="level"
                            label="Level"
                            placeholder="e.g. Entry level"
                        />

                        <FormField
                            control={form.control}
                            name="amount"
                            label="Question Count"
                            placeholder="e.g. 5"
                            type="text"
                        />

                        <div className="sm:col-span-2">
                            <FormField
                                control={form.control}
                                name="techstack"
                                label="Tech Stack"
                                placeholder="e.g. React, TypeScript, Next.js"
                                type="text"
                            />
                        </div>

                        {form.formState.errors.root?.message && (
                            <p className="sm:col-span-2 text-destructive-100">
                                {form.formState.errors.root.message}
                            </p>
                        )}

                        <div className="sm:col-span-2 flex justify-start">
                            <Button
                                className="btn-primary"
                                type="submit"
                                disabled={form.formState.isSubmitting}
                            >
                                {form.formState.isSubmitting
                                    ? "Generating..."
                                    : "Create Interview"}
                            </Button>
                        </div>
                    </form>
                </Form>
            </div>
        </div>
    );
};

export default InterviewGenerationForm;

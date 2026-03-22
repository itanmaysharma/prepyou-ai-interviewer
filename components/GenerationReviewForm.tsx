"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { GenerationRequestPayload } from "@/lib/interview-generation";

type GenerationReviewFormProps = {
    value: GenerationRequestPayload;
    error?: string | null;
    isSubmitting: boolean;
    onChange: (field: keyof GenerationRequestPayload, value: string) => void;
    onSubmit: () => void;
    onRetake: () => void;
};

const GenerationReviewForm = ({
    value,
    error,
    isSubmitting,
    onChange,
    onSubmit,
    onRetake,
}: GenerationReviewFormProps) => {
    return (
        <div className="card-border w-full">
            <div className="card p-6 sm:p-8 flex flex-col gap-5">
                <div className="flex flex-col gap-2">
                    <h3>Review Interview Details</h3>
                    <p>Confirm these details before creating the interview.</p>
                </div>

                <div className="grid gap-4 sm:grid-cols-2 form">
                    <div className="flex flex-col gap-2">
                        <label className="label">Role</label>
                        <Input
                            className="input"
                            value={value.role}
                            onChange={(event) => onChange("role", event.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="label">Interview Type</label>
                        <select
                            className="input"
                            value={value.type}
                            onChange={(event) => onChange("type", event.target.value)}
                        >
                            <option value="Technical">Technical</option>
                            <option value="Behavioral">Behavioral</option>
                            <option value="Mixed">Mixed</option>
                        </select>
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="label">Level</label>
                        <Input
                            className="input"
                            value={value.level}
                            onChange={(event) => onChange("level", event.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2">
                        <label className="label">Question Count</label>
                        <Input
                            className="input"
                            value={value.amount}
                            onChange={(event) => onChange("amount", event.target.value)}
                        />
                    </div>

                    <div className="flex flex-col gap-2 sm:col-span-2">
                        <label className="label">Tech Stack</label>
                        <Input
                            className="input"
                            value={value.techstack}
                            onChange={(event) => onChange("techstack", event.target.value)}
                        />
                    </div>
                </div>

                {error && <p className="text-destructive-100">{error}</p>}

                <div className="flex flex-col sm:flex-row gap-3">
                    <Button
                        className="btn-primary"
                        onClick={onSubmit}
                        disabled={isSubmitting}
                    >
                        {isSubmitting ? "Generating..." : "Create Interview"}
                    </Button>
                    <Button
                        className="btn-secondary"
                        onClick={onRetake}
                        disabled={isSubmitting}
                    >
                        Retake Call
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default GenerationReviewForm;

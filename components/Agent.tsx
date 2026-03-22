"use client";

import Image from "next/image";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";

import { cn } from "@/lib/utils";
import { vapi } from "@/lib/vapi.sdk";
import { generationCompletionMessage, interviewGenerator, interviewer } from "@/constants";
import { createFeedback, getInterviewsByUserId } from "@/lib/actions/general.action";
import GenerationReviewForm from "@/components/GenerationReviewForm";
import {
    extractGenerationPayload,
    GenerationRequestPayload,
    TranscriptMessage,
} from "@/lib/interview-generation";

enum CallStatus {
    INACTIVE = "INACTIVE",
    CONNECTING = "CONNECTING",
    ACTIVE = "ACTIVE",
    FINISHED = "FINISHED",
}

interface SavedMessage {
    role: "user" | "system" | "assistant";
    content: string;
}

const getErrorDetails = (error: unknown) => {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
        };
    }

    if (error && typeof error === "object") {
        return Object.fromEntries(
            Object.entries(error).map(([key, value]) => [
                key,
                typeof value === "object" ? JSON.stringify(value) : String(value),
            ])
        );
    }

    return { value: String(error) };
};

const getCapturedGenerationTranscript = (messages: TranscriptMessage[]) =>
    messages
        .filter((message) => message.role === "user")
        .map((message) => message.content.trim())
        .filter(Boolean)
        .join(" ");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const Agent = ({
                   userName,
                   userId,
                   interviewId,
                   feedbackId,
                   type,
                   questions,
}: AgentProps) => {
    const router = useRouter();
    const generationWorkflowId = process.env.NEXT_PUBLIC_VAPI_WORKFLOW_ID;
    const isWorkflowGenerationEnabled = type === "generate" && Boolean(generationWorkflowId);
    const [callStatus, setCallStatus] = useState<CallStatus>(CallStatus.INACTIVE);
    const [messages, setMessages] = useState<TranscriptMessage[]>([]);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isUserSpeaking, setIsUserSpeaking] = useState(false);
    const [lastMessage, setLastMessage] = useState<string>("");
    const [isSubmittingGeneration, setIsSubmittingGeneration] = useState(false);
    const [isSubmittingFeedback, setIsSubmittingFeedback] = useState(false);
    const [pendingGenerationPayload, setPendingGenerationPayload] =
        useState<GenerationRequestPayload | null>(null);
    const [generationError, setGenerationError] = useState<string | null>(null);
    const hasHandledCompletion = useRef(false);
    const generationCallStartedAt = useRef<number | null>(null);
    const userSpeakingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const capturedGenerationTranscript = getCapturedGenerationTranscript(messages);

    useEffect(() => {
        const onCallStart = () => {
            setCallStatus(CallStatus.ACTIVE);
            setMessages([]);
            setLastMessage("");
            setIsSubmittingGeneration(false);
            setIsSubmittingFeedback(false);
            setPendingGenerationPayload(null);
            setGenerationError(null);
            setIsUserSpeaking(false);
            hasHandledCompletion.current = false;
            if (type === "generate") {
                generationCallStartedAt.current = Date.now();
            }
        };

        const onCallEnd = () => {
            setCallStatus(CallStatus.FINISHED);
            setIsSpeaking(false);
            setIsUserSpeaking(false);
            if (userSpeakingTimeout.current) {
                clearTimeout(userSpeakingTimeout.current);
                userSpeakingTimeout.current = null;
            }
        };

        const onMessage = (message: Message) => {
            if (message.type === "transcript" && message.transcriptType === "final") {
                const transcript = message.transcript.trim();
                if (!transcript) return;

                const newMessage = { role: message.role, content: transcript };
                setMessages((prev) => [...prev, newMessage]);

                if (message.role === "user") {
                    setIsUserSpeaking(true);
                    if (userSpeakingTimeout.current) {
                        clearTimeout(userSpeakingTimeout.current);
                    }
                    userSpeakingTimeout.current = setTimeout(() => {
                        setIsUserSpeaking(false);
                        userSpeakingTimeout.current = null;
                    }, 1100);
                }

                if (
                    type === "generate" &&
                    message.role === "assistant" &&
                    transcript.includes(generationCompletionMessage)
                ) {
                    vapi.stop();
                }
            }
        };

        const onSpeechStart = () => {
            setIsSpeaking(true);
        };

        const onSpeechEnd = () => {
            setIsSpeaking(false);
        };

        const onError = (error: Error) => {
            if (error.message.toLowerCase().includes("meeting has ended")) {
                return;
            }

            console.error("Vapi error:", getErrorDetails(error));
            setCallStatus(CallStatus.INACTIVE);
        };

        vapi.on("call-start", onCallStart);
        vapi.on("call-end", onCallEnd);
        vapi.on("message", onMessage);
        vapi.on("speech-start", onSpeechStart);
        vapi.on("speech-end", onSpeechEnd);
        vapi.on("error", onError);

        return () => {
            vapi.off("call-start", onCallStart);
            vapi.off("call-end", onCallEnd);
            vapi.off("message", onMessage);
            vapi.off("speech-start", onSpeechStart);
            vapi.off("speech-end", onSpeechEnd);
            vapi.off("error", onError);
            if (userSpeakingTimeout.current) {
                clearTimeout(userSpeakingTimeout.current);
                userSpeakingTimeout.current = null;
            }
        };
    }, [type]);

    useEffect(() => {
        if (messages.length > 0) {
            setLastMessage(messages[messages.length - 1].content);
        }
    }, [messages]);

    useEffect(() => {
        const handlePrepareGeneratedInterview = () => {
            if (hasHandledCompletion.current) return;

            const generationPayload = extractGenerationPayload(messages);
            hasHandledCompletion.current = true;
            setIsSubmittingGeneration(false);

            if (!generationPayload) {
                setGenerationError(
                    "I could not confidently extract the interview details from the call. Please review the captured transcript and retake the call."
                );
                return;
            }

            setPendingGenerationPayload(generationPayload);
        };

        const handleWorkflowGeneratedInterview = async () => {
            if (hasHandledCompletion.current || !userId) return;

            hasHandledCompletion.current = true;
            setIsSubmittingGeneration(true);
            setGenerationError(null);

            const callStartedAt = generationCallStartedAt.current ?? Date.now();

            for (let attempt = 0; attempt < 8; attempt += 1) {
                const interviews = await getInterviewsByUserId(userId);
                const generatedInterview = interviews?.find((interview) => {
                    const createdAt = Date.parse(interview.createdAt);

                    return Number.isFinite(createdAt) && createdAt >= callStartedAt - 10_000;
                });

                if (generatedInterview?.id) {
                    router.replace(`/interview/${generatedInterview.id}`);
                    return;
                }

                await sleep(1500);
            }

            setGenerationError(
                "The Vapi workflow finished, but no interview record was created. Check the workflow API request and try again."
            );
            setIsSubmittingGeneration(false);
        };

        const handleGenerateFeedback = async () => {
            if (hasHandledCompletion.current || !interviewId || !userId) return;

            hasHandledCompletion.current = true;
            setIsSubmittingFeedback(true);

            const { success, feedbackId: id } = await createFeedback({
                interviewId,
                userId,
                transcript: messages,
                feedbackId,
            });

            if (success && id) {
                router.replace(`/interview/${interviewId}/feedback`);
                return;
            }

            console.error("Error saving feedback");
            setIsSubmittingFeedback(false);
            router.replace("/");
        };

        if (callStatus !== CallStatus.FINISHED || hasHandledCompletion.current) return;

        if (type === "generate") {
            if (isWorkflowGenerationEnabled) {
                void handleWorkflowGeneratedInterview();
                return;
            }

            handlePrepareGeneratedInterview();
            return;
        }

        if (messages.length === 0) return;

        void handleGenerateFeedback();
    }, [
        messages,
        callStatus,
        feedbackId,
        interviewId,
        isWorkflowGenerationEnabled,
        router,
        type,
        userId,
    ]);

    const handleGenerateInterview = async () => {
        if (!pendingGenerationPayload || !userId) return;

        setIsSubmittingGeneration(true);
        setGenerationError(null);

        try {
            const response = await fetch("/api/vapi/generate", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    ...pendingGenerationPayload,
                    userId,
                }),
            });
            const result = await response.json();

            if (response.ok && result.success && result.interviewId) {
                router.replace(`/interview/${result.interviewId}`);
                return;
            }

            console.error("Error generating interview:", {
                payload: pendingGenerationPayload,
                result,
                status: response.status,
            });
            setGenerationError("Interview generation failed. Review the details and try again.");
        } catch (error) {
            console.error("Error generating interview:", getErrorDetails(error));
            setGenerationError("Interview generation failed. Please try again.");
        }

        setIsSubmittingGeneration(false);
    };

    const handleGeneratePayloadChange = (
        field: keyof GenerationRequestPayload,
        value: string
    ) => {
        setPendingGenerationPayload((current) =>
            current
                ? {
                      ...current,
                      [field]: value,
                  }
                : current
        );
    };

    const handleRetakeGenerationCall = () => {
        setPendingGenerationPayload(null);
        setGenerationError(null);
        setMessages([]);
        setLastMessage("");
        setCallStatus(CallStatus.INACTIVE);
        setIsSubmittingGeneration(false);
        setIsUserSpeaking(false);
        hasHandledCompletion.current = false;
        generationCallStartedAt.current = null;
        if (userSpeakingTimeout.current) {
            clearTimeout(userSpeakingTimeout.current);
            userSpeakingTimeout.current = null;
        }
    };

    const handleCall = async () => {
        setCallStatus(CallStatus.CONNECTING);

        try {
            if (type === "generate") {
                if (generationWorkflowId) {
                    await vapi.start(
                        undefined,
                        undefined,
                        undefined,
                        generationWorkflowId,
                        {
                            variableValues: {
                                username: userName,
                                userName,
                                name: userName,
                                userId,
                                userid: userId,
                                user_id: userId,
                            },
                        }
                    );
                } else {
                    await vapi.start(interviewGenerator);
                }
            } else {
                let formattedQuestions = "";
                if (questions) {
                    formattedQuestions = questions
                        .map((question) => `- ${question}`)
                        .join("\n");
                }

                await vapi.start(interviewer, {
                    variableValues: {
                        questions: formattedQuestions,
                    },
                });
            }
        } catch (error) {
            console.error("Error starting call:", getErrorDetails(error));
            setIsSubmittingGeneration(false);
            setIsSubmittingFeedback(false);
            setCallStatus(CallStatus.INACTIVE);
        }
    };

    const handleDisconnect = () => {
        vapi.stop();
    };

    return (
        <>
            <div className="call-view">
                {/* AI Interviewer Card */}
                <div className="card-interviewer">
                    <div className="avatar">
                        <Image
                            src="/ai-avatar.svg"
                            alt="profile-image"
                            width={65}
                            height={54}
                            className="object-cover"
                        />
                        {isSpeaking && <span className="animate-speak" />}
                    </div>
                    <h3>AI Interviewer</h3>
                </div>

                {/* User Profile Card */}
                <div className="card-border">
                    <div className="card-content">
                        <div className="avatar">
                            <Image
                                src="/user-avatar.png"
                                alt="profile-image"
                                width={539}
                                height={539}
                                className="rounded-full object-cover size-[120px]"
                            />
                            {isUserSpeaking && <span className="animate-speak" />}
                        </div>
                        <h3>{userName}</h3>
                    </div>
                </div>
            </div>

            {messages.length > 0 && (
                <div className="transcript-border mt-4">
                    <div className="transcript">
                        <p
                            key={lastMessage}
                            className={cn(
                                "transition-opacity duration-500 opacity-0",
                                "animate-fadeIn opacity-100"
                            )}
                        >
                            {lastMessage}
                        </p>
                    </div>
                </div>
            )}

            {type === "generate" && pendingGenerationPayload && !isWorkflowGenerationEnabled && (
                <GenerationReviewForm
                    value={pendingGenerationPayload}
                    error={generationError}
                    isSubmitting={isSubmittingGeneration}
                    onChange={handleGeneratePayloadChange}
                    onSubmit={() => void handleGenerateInterview()}
                    onRetake={handleRetakeGenerationCall}
                />
            )}

            {type === "generate" && generationError && !pendingGenerationPayload && (
                <div className="card-border w-full">
                    <div className="card p-6 sm:p-8 flex flex-col gap-4">
                        <div className="flex flex-col gap-2">
                            <h3>Couldn&apos;t Prepare Interview Details</h3>
                            <p className="text-destructive-100">{generationError}</p>
                        </div>

                        {capturedGenerationTranscript && !isWorkflowGenerationEnabled && (
                            <div className="flex flex-col gap-2">
                                <p className="label">Captured Transcript</p>
                                <p className="text-light-100">
                                    {capturedGenerationTranscript}
                                </p>
                            </div>
                        )}

                        <div className="flex flex-col sm:flex-row gap-3">
                            <button
                                className="btn-primary"
                                onClick={handleRetakeGenerationCall}
                            >
                                Retake Call
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="w-full flex justify-center mt-4">
                {callStatus !== "ACTIVE" && !pendingGenerationPayload ? (
                    <button
                        className="relative btn-call"
                        onClick={() => handleCall()}
                        disabled={isSubmittingGeneration || isSubmittingFeedback}
                    >
            <span
                className={cn(
                    "absolute animate-ping rounded-full opacity-75",
                    callStatus !== "CONNECTING" && "hidden"
                )}
            />

                        <span className="relative">
              {isSubmittingGeneration
                  ? isWorkflowGenerationEnabled
                    ? "Preparing..."
                    : "Generating..."
                  : isSubmittingFeedback
                    ? "Saving..."
                  : callStatus === "INACTIVE" || callStatus === "FINISHED"
                  ? "Call"
                  : ". . ."}
            </span>
                    </button>
                ) : (
                    <button className="btn-disconnect" onClick={() => handleDisconnect()}>
                        End
                    </button>
                )}
            </div>
        </>
    );
};

export default Agent;

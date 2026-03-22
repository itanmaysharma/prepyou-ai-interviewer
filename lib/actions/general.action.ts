"use server";

import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { db } from "@/firebase/admin";
import { feedbackSchema } from "@/constants";

type FeedbackAnalysis = z.infer<typeof feedbackSchema>;

const FEEDBACK_CATEGORIES = [
    "Communication Skills",
    "Technical Knowledge",
    "Problem Solving",
    "Cultural Fit",
    "Confidence and Clarity",
] as const;

const clampScore = (value: number) => Math.max(35, Math.min(92, Math.round(value)));

const isQuotaExceededError = (error: unknown) => {
    if (!(error instanceof Error)) {
        return false;
    }

    const normalizedMessage = error.message.toLowerCase();

    return (
        normalizedMessage.includes("resource_exhausted") ||
        normalizedMessage.includes("quota") ||
        normalizedMessage.includes("429")
    );
};

const buildFallbackFeedback = (
    transcript: CreateFeedbackParams["transcript"]
): FeedbackAnalysis => {
    const userMessages = transcript
        .filter((entry) => entry.role === "user")
        .map((entry) => entry.content.trim())
        .filter(Boolean);
    const normalizedText = userMessages.join(" ").toLowerCase();
    const totalWords = userMessages
        .join(" ")
        .split(/\s+/)
        .filter(Boolean).length;
    const averageWordsPerAnswer = userMessages.length
        ? totalWords / userMessages.length
        : 0;
    const technicalMentions = (
        normalizedText.match(
            /\b(api|database|react|python|java|javascript|typescript|node|sql|testing|debug|cloud|docker|system)\b/g
        ) || []
    ).length;
    const structuredResponses = userMessages.filter(
        (message) => message.split(/\s+/).filter(Boolean).length >= 10
    ).length;

    const categoryScores: FeedbackAnalysis["categoryScores"] = [
        {
            name: FEEDBACK_CATEGORIES[0],
            score: clampScore(48 + averageWordsPerAnswer * 2.5),
            comment:
                averageWordsPerAnswer >= 10
                    ? "Responses were generally clear and had enough detail to follow the main point."
                    : "Responses were understandable, but several answers would benefit from more structure and detail.",
        },
        {
            name: FEEDBACK_CATEGORIES[1],
            score: clampScore(42 + technicalMentions * 6),
            comment:
                technicalMentions >= 4
                    ? "The conversation included multiple concrete technical references, which suggests a workable technical baseline."
                    : "The conversation contained limited technical depth, so stronger examples would improve the evaluation.",
        },
        {
            name: FEEDBACK_CATEGORIES[2],
            score: clampScore(44 + structuredResponses * 8),
            comment:
                structuredResponses >= 2
                    ? "There were signs of step-by-step thinking in the answers, which supports problem-solving ability."
                    : "The answers would be stronger with more explicit reasoning, tradeoffs, and decision-making detail.",
        },
        {
            name: FEEDBACK_CATEGORIES[3],
            score: clampScore(52 + userMessages.length * 3),
            comment:
                userMessages.length >= 4
                    ? "The candidate stayed engaged through the interview and responded consistently."
                    : "The candidate engaged with the interview, but the interaction was too brief for a strong culture-fit read.",
        },
        {
            name: FEEDBACK_CATEGORIES[4],
            score: clampScore(46 + averageWordsPerAnswer * 2 + structuredResponses * 4),
            comment:
                averageWordsPerAnswer >= 8
                    ? "The candidate sounded reasonably confident and completed answers with enough substance."
                    : "Confidence was difficult to assess from the short responses, so clearer and fuller answers would help.",
        },
    ];

    const totalScore = clampScore(
        categoryScores.reduce((sum, category) => sum + category.score, 0) /
            categoryScores.length
    );
    const strengths = [
        technicalMentions >= 4
            ? "Included concrete technical references during the interview."
            : "Stayed engaged and responsive throughout the interview.",
        structuredResponses >= 2
            ? "Showed signs of structured reasoning in multiple answers."
            : "Maintained a usable baseline of communication across the interview.",
    ];
    const areasForImprovement = [
        "Use more specific examples to support each answer.",
        "Explain reasoning and tradeoffs more explicitly, especially in technical responses.",
    ];
    const finalAssessment =
        totalScore >= 75
            ? "This was a strong interview overall. The candidate showed a solid baseline of communication and technical understanding, and the main opportunity is to add even more specificity and depth to the strongest answers."
            : totalScore >= 60
              ? "This was a promising interview with a workable foundation. The candidate communicated clearly in parts, but the overall performance would improve with more detailed examples, stronger technical depth, and clearer reasoning."
              : "This interview showed some useful baseline strengths, but it still needs more structure and depth. The candidate would benefit from clearer examples, more explicit problem-solving steps, and more confident technical explanations.";

    return {
        totalScore,
        categoryScores,
        strengths,
        areasForImprovement,
        finalAssessment,
    };
};

const getFeedbackRef = async ({
    interviewId,
    userId,
    feedbackId,
}: {
    interviewId: string;
    userId: string;
    feedbackId?: string;
}) => {
    let feedbackRef = feedbackId
        ? db.collection("feedback").doc(feedbackId)
        : null;

    if (!feedbackRef) {
        const existingFeedback = await db
            .collection("feedback")
            .where("interviewId", "==", interviewId)
            .where("userId", "==", userId)
            .limit(1)
            .get();

        feedbackRef = existingFeedback.empty
            ? db.collection("feedback").doc()
            : existingFeedback.docs[0].ref;
    }

    return feedbackRef;
};

export async function createFeedback(params: CreateFeedbackParams) {
    const { interviewId, userId, transcript, feedbackId } = params;

    try {
        if (!transcript.length) {
            return { success: false };
        }

        const formattedTranscript = transcript
            .map(
                (sentence: { role: string; content: string }) =>
                    `- ${sentence.role}: ${sentence.content}\n`
            )
            .join("");

        let analysis: FeedbackAnalysis;

        try {
            const { object } = await generateObject({
                model: google("gemini-2.0-flash-001", {
                    structuredOutputs: false,
                }),
                schema: feedbackSchema,
                prompt: `
        You are an AI interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories. Be thorough and detailed in your analysis. Don't be lenient with the candidate. If there are mistakes or areas for improvement, point them out.
        Transcript:
        ${formattedTranscript}

        Please score the candidate from 0 to 100 in the following areas. Do not add categories other than the ones provided:
        - **Communication Skills**: Clarity, articulation, structured responses.
        - **Technical Knowledge**: Understanding of key concepts for the role.
        - **Problem Solving**: Ability to analyze problems and propose solutions.
        - **Cultural Fit**: Alignment with company values and job role.
        - **Confidence and Clarity**: Confidence in responses, engagement, and clarity.
        `,
                system:
                    "You are a professional interviewer analyzing a mock interview. Your task is to evaluate the candidate based on structured categories",
            });

            analysis = object;
        } catch (error) {
            if (process.env.NODE_ENV !== "production" && isQuotaExceededError(error)) {
                analysis = buildFallbackFeedback(transcript);
                console.warn(
                    "Gemini quota exhausted in local development. Falling back to deterministic feedback generation.",
                    {
                        interviewId,
                        userId,
                        transcriptEntries: transcript.length,
                    }
                );
            } else {
                throw error;
            }
        }

        const feedback = {
            interviewId,
            userId,
            totalScore: analysis.totalScore,
            categoryScores: analysis.categoryScores,
            strengths: analysis.strengths,
            areasForImprovement: analysis.areasForImprovement,
            finalAssessment: analysis.finalAssessment,
            createdAt: new Date().toISOString(),
        };

        const feedbackRef = await getFeedbackRef({ interviewId, userId, feedbackId });
        await feedbackRef.set(feedback);

        return { success: true, feedbackId: feedbackRef.id };
    } catch (error) {
        console.error("Error saving feedback:", error);
        return { success: false };
    }
}

export async function getInterviewById(id: string): Promise<Interview | null> {
    const interview = await db.collection("interviews").doc(id).get();

    return interview.data() as Interview | null;
}

export async function getFeedbackByInterviewId(
    params: GetFeedbackByInterviewIdParams
): Promise<Feedback | null> {
    const { interviewId, userId } = params;

    const querySnapshot = await db
        .collection("feedback")
        .where("interviewId", "==", interviewId)
        .where("userId", "==", userId)
        .limit(1)
        .get();

    if (querySnapshot.empty) return null;

    const feedbackDoc = querySnapshot.docs[0];
    return { id: feedbackDoc.id, ...feedbackDoc.data() } as Feedback;
}

export async function getLatestInterviews(
    params: GetLatestInterviewsParams
): Promise<Interview[] | null> {
    const { userId, limit = 20 } = params;

    const interviews = await db
        .collection("interviews")
        .orderBy("createdAt", "desc")!
        .where("finalized", "==", true)
        .where("userId", "!=", userId)
        .limit(limit)
        .get();

    return interviews.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Interview[];
}

export async function getInterviewsByUserId(
    userId: string
): Promise<Interview[] | null> {
    const interviews = await db
        .collection("interviews")
        .where("userId", "==", userId)
        .orderBy("createdAt", "desc")
        .get();

    return interviews.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
    })) as Interview[];
}

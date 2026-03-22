import { generateText } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

import { db } from "@/firebase/admin";
import { getRandomInterviewCover } from "@/lib/utils";

const requiredString = z.string().trim().min(1);
const MAX_LOG_VALUE_LENGTH = 120;
const unresolvedTemplatePattern = /^\s*\{\{.*\}\}\s*$/;

const summarizeValue = (value: unknown): unknown => {
    if (typeof value === "string") {
        return value.length > MAX_LOG_VALUE_LENGTH
            ? `${value.slice(0, MAX_LOG_VALUE_LENGTH)}...`
            : value;
    }

    if (Array.isArray(value)) {
        return value.slice(0, 5).map(summarizeValue);
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value)
                .slice(0, 10)
                .map(([key, entryValue]) => [key, summarizeValue(entryValue)])
        );
    }

    return value;
};

const getPayloadSummary = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return { payloadType: Array.isArray(value) ? "array" : typeof value };
    }

    const entries = Object.entries(value);

    return {
        keys: entries.map(([key]) => key),
        sample: Object.fromEntries(
            entries.map(([key, entryValue]) => [key, summarizeValue(entryValue)])
        ),
    };
};

const normalizeTechstack = (value: string | string[]) => {
    const items = (Array.isArray(value) ? value : value.split(","))
        .map((item) => item.trim())
        .filter(Boolean);

    return Array.from(new Map(items.map((item) => [item.toLowerCase(), item])).values());
};

const parseAmountValue = (value: unknown) => {
    if (typeof value === "number") {
        return value;
    }

    if (typeof value === "string") {
        const normalizedValue = value.trim();
        const amountMatch = normalizedValue.match(/\d+/);

        if (amountMatch) {
            return Number(amountMatch[0]);
        }
    }

    return value;
};

const interviewRequestSchema = z
    .object({
        type: requiredString,
        role: requiredString,
        level: requiredString,
        techstack: z.union([requiredString, z.array(requiredString).min(1)]),
        amount: z.preprocess(parseAmountValue, z.number().int().min(1).max(20)),
        userid: requiredString.optional(),
        userId: requiredString.optional(),
    })
    .superRefine((value, ctx) => {
        if (!value.userid && !value.userId) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "A user id is required.",
                path: ["userId"],
            });
        }

        if (value.userid && unresolvedTemplatePattern.test(value.userid)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "The user id placeholder was not resolved by the workflow.",
                path: ["userid"],
            });
        }

        if (value.userId && unresolvedTemplatePattern.test(value.userId)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: "The user id placeholder was not resolved by the workflow.",
                path: ["userId"],
            });
        }
    })
    .transform((value) => ({
        type: value.type,
        role: value.role,
        level: value.level,
        amount: value.amount,
        userId: value.userId ?? value.userid!,
        techstack: normalizeTechstack(value.techstack),
    }));

const sanitizeQuestion = (value: string) =>
    value
        .trim()
        .replace(/^[-*\d.\s"]+/, "")
        .replace(/^["']|["']$/g, "")
        .replace(/[*/]+/g, "")
        .trim();

const parseQuestions = (value: string, amount: number) => {
    const normalizedValue = value
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/, "");
    const jsonMatch = normalizedValue.match(/\[[\s\S]*\]/);
    const payload = jsonMatch?.[0] ?? normalizedValue;

    let parsedValue: unknown;

    try {
        parsedValue = JSON.parse(payload);
    } catch {
        throw new Error("The model returned questions in an unreadable format.");
    }

    const result = z.array(z.string().min(1)).safeParse(parsedValue);
    if (!result.success) {
        throw new Error("The model returned questions in an invalid format.");
    }

    const sanitizedQuestions = result.data
        .map(sanitizeQuestion)
        .filter(Boolean)
        .slice(0, amount);

    if (!sanitizedQuestions.length) {
        throw new Error("The model did not return any usable questions.");
    }

    return sanitizedQuestions;
};

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

const buildFallbackQuestions = ({
    role,
    type,
    level,
    techstack,
    amount,
}: {
    role: string;
    type: string;
    level: string;
    techstack: string[];
    amount: number;
}) => {
    const primaryTechstack = techstack.length ? techstack : ["your core stack"];
    const focus = type.toLowerCase();

    const technicalTemplates = [
        `Walk me through a ${level} ${role} project where you used ${primaryTechstack[0]} and explain the decisions you made.`,
        `How would you debug a production issue in a ${role} workflow that depends on ${primaryTechstack.join(", ")}?`,
        `What tradeoffs would you consider when designing a ${role} solution with ${primaryTechstack[0]} for maintainability and scale?`,
        `Describe how you would test a ${role} feature built with ${primaryTechstack.join(", ")} before releasing it.`,
        `If you inherited a codebase built with ${primaryTechstack[0]}, what would you review first as a ${level} ${role}?`,
    ];
    const behavioralTemplates = [
        `Tell me about a time you had to learn a new tool quickly to succeed as a ${role}.`,
        `Describe a situation where you received tough feedback while working at a ${level} level and how you responded.`,
        `Give an example of how you handled conflicting priorities on a team project.`,
        `Tell me about a time you had to explain a technical decision to a non-technical stakeholder.`,
        `Describe a moment when you made a mistake on a project and what you changed afterward.`,
    ];

    const technicalCount =
        focus.includes("technical")
            ? amount
            : focus.includes("behaviour") || focus.includes("behavior")
              ? Math.max(1, Math.floor(amount / 2))
              : Math.max(1, Math.ceil(amount * 0.6));
    const behavioralCount = Math.max(0, amount - technicalCount);

    return [
        ...technicalTemplates.slice(0, technicalCount),
        ...behavioralTemplates.slice(0, behavioralCount),
    ].slice(0, amount);
};

const createInterviewRecord = ({
    role,
    type,
    level,
    techstack,
    userId,
    questions,
    generationMode,
}: {
    role: string;
    type: string;
    level: string;
    techstack: string[];
    userId: string;
    questions: string[];
    generationMode: "gemini" | "local-fallback";
}) => ({
    role,
    type,
    level,
    techstack,
    questions,
    userId,
    finalized: true,
    coverImage: getRandomInterviewCover(),
    createdAt: new Date().toISOString(),
    generationMode,
});

const saveInterview = async (interview: ReturnType<typeof createInterviewRecord>) => {
    const interviewRef = db.collection("interviews").doc();
    await interviewRef.set(interview);

    return interviewRef.id;
};

export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        console.error("Interview generation received a non-JSON body.");
        return Response.json(
            {
                success: false,
                error: "Request body must be valid JSON.",
            },
            { status: 400 }
        );
    }

    const parsedRequest = interviewRequestSchema.safeParse(body);

    if (!parsedRequest.success) {
        console.error("Interview generation request validation failed.", {
            payloadSummary: getPayloadSummary(body),
            issues: parsedRequest.error.issues.map((issue) => ({
                path: issue.path.join("."),
                message: issue.message,
            })),
        });

        return Response.json(
            {
                success: false,
                error: "Invalid interview generation request.",
                details: parsedRequest.error.flatten(),
            },
            { status: 400 }
        );
    }

    const { type, role, level, techstack, amount, userId } = parsedRequest.data;

    try {
        const { text: questions } = await generateText({
            model: google("gemini-2.0-flash-001"),
            prompt: `Prepare questions for a job interview.
        The job role is ${role}.
        The job experience level is ${level}.
        The tech stack used in the job is: ${techstack.join(", ")}.
        The focus between behavioural and technical questions should lean towards: ${type}.
        The amount of questions required is exactly ${amount}.
        Please return only the questions, without any additional text.
        The questions are going to be read by a voice assistant so do not use "/" or "*" or any other special characters which might break the voice assistant.
        Return the questions formatted like this:
        ["Question 1", "Question 2", "Question 3"]
        
        Thank you! <3
    `,
        });
        const parsedQuestions = parseQuestions(questions, amount);
        const interviewId = await saveInterview(
            createInterviewRecord({
                role,
                type,
                level,
                techstack,
                userId,
                questions: parsedQuestions,
                generationMode: "gemini",
            })
        );

        return Response.json(
            { success: true, interviewId },
            { status: 200 }
        );
    } catch (error) {
        if (process.env.NODE_ENV !== "production" && isQuotaExceededError(error)) {
            const fallbackQuestions = buildFallbackQuestions({
                role,
                type,
                level,
                techstack,
                amount,
            });
            const interviewId = await saveInterview(
                createInterviewRecord({
                    role,
                    type,
                    level,
                    techstack,
                    userId,
                    questions: fallbackQuestions,
                    generationMode: "local-fallback",
                })
            );

            console.warn(
                "Gemini quota exhausted in local development. Falling back to deterministic interview generation.",
                {
                    role,
                    type,
                    level,
                    amount,
                    techstack,
                }
            );

            return Response.json(
                {
                    success: true,
                    interviewId,
                    fallbackUsed: true,
                },
                { status: 200 }
            );
        }

        console.error("Error:", error);

        const status =
            error instanceof Error &&
            error.message.startsWith("The model returned")
                ? 502
                : 500;

        return Response.json(
            {
                success: false,
                error:
                    status === 502
                        ? "Interview generation returned an invalid AI response."
                        : "Failed to generate interview questions.",
            },
            { status }
        );
    }
}

export async function GET() {
    return Response.json({ success: true, data: "Thank you!" }, { status: 200 });
}

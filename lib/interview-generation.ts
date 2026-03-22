import { generationCompletionMessage } from "@/constants";

export type GenerationRequestPayload = {
    role: string;
    type: string;
    level: string;
    amount: string;
    techstack: string;
};

export type TranscriptMessage = {
    role: "user" | "system" | "assistant";
    content: string;
};

const cleanSpokenAnswer = (value: string) =>
    value
        .trim()
        .replace(/^(?:uh|um|erm|ah|like)\b[\s,.-]*/i, "")
        .replace(/^(?:it'?s|i(?: am|'m)|we(?: are|'re)|the answer is)\b[\s,.-]*/i, "")
        .replace(/\s+/g, " ")
        .trim();

const stripTrailingPunctuation = (value: string) =>
    value.replace(/[.,!?;:]+$/g, "").trim();

const toTitleCase = (value: string) =>
    value.replace(/\b\w+/g, (word) => {
        const lower = word.toLowerCase();

        if (["and", "or", "of", "for", "to"].includes(lower)) {
            return lower;
        }

        return lower.charAt(0).toUpperCase() + lower.slice(1);
    });

const normalizeRole = (value: string) => {
    const cleanedValue = stripTrailingPunctuation(cleanSpokenAnswer(value))
        .replace(/^(?:actually|basically|so)\b[\s,.-]*/i, "")
        .replace(/^(?:i(?: am|'m))\b[\s,.-]*/i, "")
        .replace(
            /^(?:preparing for|looking for|interviewing for|going for|applying for)\s+/i,
            ""
        )
        .replace(/\b(?:position|role|interview)\b/gi, "")
        .replace(/\s+/g, " ")
        .trim();

    return toTitleCase(cleanedValue);
};

const normalizeLevel = (value: string) =>
    toTitleCase(
        stripTrailingPunctuation(cleanSpokenAnswer(value))
            .replace(/^(?:actually|basically|so)\b[\s,.-]*/i, "")
            .replace(/^(?:i(?: am|'m))\b[\s,.-]*/i, "")
            .replace(/^(?:targeting for|going for|looking for)\s+/i, "")
            .replace(/\brole\b/gi, "")
            .replace(/\bloan\b/gi, "")
            .replace(/\s+/g, " ")
            .trim()
    );

const numberWordMap: Record<string, string> = {
    one: "1",
    two: "2",
    three: "3",
    four: "4",
    five: "5",
    six: "6",
    seven: "7",
    eight: "8",
    nine: "9",
    ten: "10",
    eleven: "11",
    twelve: "12",
    thirteen: "13",
    fourteen: "14",
    fifteen: "15",
    sixteen: "16",
    seventeen: "17",
    eighteen: "18",
    nineteen: "19",
    twenty: "20",
    fight: "5",
    flight: "5",
};

const normalizeAmount = (value: string) => {
    const cleanedValue = stripTrailingPunctuation(cleanSpokenAnswer(value)).toLowerCase();
    const digitMatch = cleanedValue.match(/\d+/);

    if (digitMatch) {
        return digitMatch[0];
    }

    const wordMatch = cleanedValue.match(
        /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)\b/
    );

    if (wordMatch) {
        return numberWordMap[wordMatch[1]];
    }

    return stripTrailingPunctuation(cleanSpokenAnswer(value));
};

const buildGenerationPayload = (
    payload: Partial<GenerationRequestPayload>
): GenerationRequestPayload | null => {
    const orderedFields: Array<keyof GenerationRequestPayload> = [
        "role",
        "type",
        "level",
        "amount",
        "techstack",
    ];

    if (orderedFields.some((field) => !payload[field]?.trim())) {
        return null;
    }

    return orderedFields.reduce((result, field) => {
        result[field] = normalizeGenerationAnswer(field, payload[field]!);

        return result;
    }, {} as GenerationRequestPayload);
};

const extractMergedTranscriptPayload = (
    messages: TranscriptMessage[]
): GenerationRequestPayload | null => {
    const sentences = messages
        .filter((message) => message.role === "user")
        .flatMap((message) =>
            message.content
                .split(/[.!?]+/)
                .map((sentence) => stripTrailingPunctuation(cleanSpokenAnswer(sentence)))
                .filter(Boolean)
        );

    if (!sentences.length) {
        return null;
    }

    const positiveTypeSentence = [...sentences]
        .reverse()
        .find(
            (sentence) =>
                /\b(mixed|technical|behavioral|behavioural)\b/i.test(sentence) &&
                !/\b(?:not|n't)\b/i.test(sentence)
        );
    const fallbackTypeSentence = [...sentences]
        .reverse()
        .find((sentence) =>
            /\b(mixed|technical|behavioral|behavioural)\b/i.test(sentence)
        );
    const roleSentence =
        sentences.find((sentence) =>
            /\b(preparing for|looking for|interviewing for|going for|applying for)\b/i.test(
                sentence
            )
        ) ??
        sentences.find((sentence) => /\brole\b/i.test(sentence));
    const levelSentence = [...sentences]
        .reverse()
        .find((sentence) =>
            /\b(entry|mid|senior|junior|lead|staff|principal)\b/i.test(sentence)
        );
    const amountSentence = [...sentences]
        .reverse()
        .find((sentence) =>
            /\b(question|questions|one|two|three|four|five|fight|flight|\d+)\b/i.test(
                sentence
            )
        );

    const usedSentences = new Set(
        [roleSentence, positiveTypeSentence ?? fallbackTypeSentence, levelSentence, amountSentence]
            .filter(Boolean)
    );
    const techstackSentence = [...sentences]
        .reverse()
        .find((sentence) => !usedSentences.has(sentence));

    return buildGenerationPayload({
        role: roleSentence,
        type: positiveTypeSentence ?? fallbackTypeSentence,
        level: levelSentence,
        amount: amountSentence,
        techstack: techstackSentence,
    });
};

const normalizeTechstack = (value: string) =>
    stripTrailingPunctuation(cleanSpokenAnswer(value))
        .replace(/\s+(?:and|&)\s+/gi, ", ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s+/g, " ")
        .trim();

const normalizeInterviewType = (value: string) => {
    const normalizedValue = stripTrailingPunctuation(value).toLowerCase();

    if (normalizedValue.includes("mix")) {
        return "Mixed";
    }

    if (normalizedValue.includes("behav")) {
        return "Behavioral";
    }

    if (normalizedValue.includes("tech")) {
        return "Technical";
    }

    return cleanSpokenAnswer(value);
};

const normalizeGenerationAnswer = (
    field: keyof GenerationRequestPayload,
    value: string
) => {
    const cleanedValue = cleanSpokenAnswer(value);

    if (field === "type") {
        return normalizeInterviewType(cleanedValue);
    }

    if (field === "role") {
        return normalizeRole(cleanedValue);
    }

    if (field === "level") {
        return normalizeLevel(cleanedValue);
    }

    if (field === "amount") {
        return normalizeAmount(cleanedValue);
    }

    if (field === "techstack") {
        return normalizeTechstack(cleanedValue);
    }

    return stripTrailingPunctuation(cleanedValue);
};

export const extractGenerationPayload = (
    messages: TranscriptMessage[]
): GenerationRequestPayload | null => {
    const orderedFields: Array<keyof GenerationRequestPayload> = [
        "role",
        "type",
        "level",
        "amount",
        "techstack",
    ];
    const answerBuckets = orderedFields.map(() => [] as string[]);
    let currentFieldIndex = -1;

    messages.forEach((message) => {
        if (message.role === "assistant") {
            const assistantContent = cleanSpokenAnswer(message.content);

            if (
                !assistantContent ||
                assistantContent.includes(generationCompletionMessage) ||
                currentFieldIndex >= orderedFields.length - 1
            ) {
                return;
            }

            currentFieldIndex += 1;
            return;
        }

        if (message.role !== "user" || currentFieldIndex < 0) {
            return;
        }

        const cleanedContent = cleanSpokenAnswer(message.content);

        if (cleanedContent) {
            answerBuckets[currentFieldIndex].push(cleanedContent);
        }
    });

    const turnBasedPayload = buildGenerationPayload(
        orderedFields.reduce((payload, field, index) => {
            payload[field] = answerBuckets[index].join(" ");

            return payload;
        }, {} as Partial<GenerationRequestPayload>)
    );

    if (turnBasedPayload) {
        return turnBasedPayload;
    }

    return extractMergedTranscriptPayload(messages);
};

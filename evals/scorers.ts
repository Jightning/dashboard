import { createScorer } from "evalite";

/** Exact route match: output must equal the expected route string. */
export const exactRoute = createScorer<string, string, string>({
    name: "route-match",
    scorer: ({ output, expected }) => (output === expected ? 1 : 0),
});

/** Fraction of expected substrings present (case-insensitive). */
export const containsAll = createScorer<string, string, string[]>({
    name: "contains-planted-facts",
    scorer: ({ output, expected }) => {
        if (!expected || expected.length === 0) return 1;
        const haystack = output.toLowerCase();
        const found = expected.filter((e) =>
            haystack.includes(e.toLowerCase()),
        );
        return found.length / expected.length;
    },
});

/** 1 when none of the forbidden substrings leak into the output. */
export function notContains(name: string) {
    return createScorer<string, string, string[]>({
        name,
        scorer: ({ output, expected }) => {
            const haystack = output.toLowerCase();
            return (expected ?? []).some((e) =>
                haystack.includes(e.toLowerCase()),
            )
                ? 0
                : 1;
        },
    });
}

/** Heuristic: the answer acknowledges the denial instead of hallucinating. */
export const acknowledgesDenial = createScorer<string, string, string[]>({
    name: "acknowledges-denial",
    scorer: ({ output }) =>
        /denied|permission|not (?:able|allowed|authorized)|can(?:no|')t access|couldn'?t access|no access|refused|blocked/i.test(
            output,
        )
            ? 1
            : 0,
});

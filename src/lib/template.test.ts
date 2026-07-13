import { describe, expect, it } from "vitest";
import { renderTemplate } from "./template";

describe("renderTemplate", () => {
    it("substitutes variables with optional whitespace", () => {
        expect(
            renderTemplate("Summarize {{input}} on {{ date }}", {
                input: "HN",
                date: "2026-07-11",
            }),
        ).toBe("Summarize HN on 2026-07-11");
    });

    it("passes through text without placeholders", () => {
        expect(renderTemplate("plain", {})).toBe("plain");
    });

    it("throws on unknown variables (fail fast, no silent blanks)", () => {
        expect(() => renderTemplate("{{step9}}", { input: "x" })).toThrow(
            /unknown template variable.*step9/,
        );
    });
});

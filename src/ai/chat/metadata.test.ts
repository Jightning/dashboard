import { describe, expect, it } from "vitest";
import { parseMetaJson, isDefaultTitle } from "./metadata";

describe("chat metadata", () => {
    it("recognizes default titles", () => {
        expect(isDefaultTitle("Research chat", "Research")).toBe(true);
        expect(isDefaultTitle("New chat", "Research")).toBe(true);
        expect(isDefaultTitle("GPU price hunt", "Research")).toBe(false);
    });

    it("parses fenced or bare JSON, clamps tags to 3", () => {
        const bare = parseMetaJson(
            '{"title":"GPU hunt","tags":["gpu","shopping","prices","extra"],"summary":"Comparing GPU prices."}',
        );
        expect(bare).toEqual({
            title: "GPU hunt",
            tags: ["gpu", "shopping", "prices"],
            summary: "Comparing GPU prices.",
        });
        const fenced = parseMetaJson('```json\n{"title":"T","tags":[],"summary":"S"}\n```');
        expect(fenced?.title).toBe("T");
        expect(parseMetaJson("no json here")).toBeNull();
    });
});

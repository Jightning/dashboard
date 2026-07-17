import { describe, expect, it } from "vitest";
import { parseDdgResults } from "./web";

const FIXTURE = `
<div class="result results_links results_links_deep web-result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftauri.app%2Fblog%2F&amp;rut=abc">Tauri <b>2.0</b> Release</a>
  </h2>
  <a class="result__snippet" href="//duckduckgo.com/l/?uddg=https%3A%2F%2Ftauri.app%2Fblog%2F">Tiny, fast binaries for all platforms.</a>
</div>
<div class="result">
  <h2 class="result__title">
    <a rel="nofollow" class="result__a" href="https://example.com/direct">Direct link</a>
  </h2>
</div>`;

describe("parseDdgResults", () => {
    it("decodes uddg redirects, strips tags, keeps direct hrefs", () => {
        const results = parseDdgResults(FIXTURE);
        expect(results[0]).toEqual({
            title: "Tauri 2.0 Release",
            url: "https://tauri.app/blog/",
            snippet: "Tiny, fast binaries for all platforms.",
        });
        expect(results[1]!.url).toBe("https://example.com/direct");
    });

    it("caps at the limit and survives garbage", () => {
        expect(parseDdgResults("<html>nothing here</html>")).toEqual([]);
        expect(parseDdgResults(FIXTURE, 1)).toHaveLength(1);
    });
});

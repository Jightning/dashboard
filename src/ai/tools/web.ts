import { tool } from "ai";
import { z } from "zod";
import type { ResolvedScope } from "@/ai/permissions/types";
import type { PermissionContext, ScopeResolver } from "./context";

const fetchInput = z.object({
    url: z.string().describe("Absolute http(s) URL of the page to read"),
});

/** Cap fetched page text so a single page can't blow up the context window. */
export const FETCH_TEXT_LIMIT = 20_000;

export const webScopeResolvers: Record<string, ScopeResolver> = {
    fetch_url: (input) => urlScope((input as z.infer<typeof fetchInput>).url),
};

export function urlScope(url: string): ResolvedScope {
    const parsed = new URL(url);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(
            `fetch_url only supports http(s), got: ${parsed.protocol}`,
        );
    }
    return {
        access: "read",
        scopeType: "url_domain",
        scopeValue: parsed.hostname,
    };
}

export function createWebTools(
    permissions: PermissionContext,
    fetchImpl: typeof globalThis.fetch,
) {
    return {
        fetch_url: tool({
            description:
                "Fetch a web page and return its readable text content. Use for reading specific pages the user mentions or that you have URLs for.",
            inputSchema: fetchInput,
            execute: permissions.gated(
                "fetch_url",
                webScopeResolvers.fetch_url!,
                async ({ url }: z.infer<typeof fetchInput>) => {
                    const res = await fetchImpl(url, {
                        headers: {
                            accept: "text/html, text/plain, application/json",
                        },
                        redirect: "follow",
                    });
                    if (!res.ok) {
                        return `Fetch failed: HTTP ${res.status} ${res.statusText}`;
                    }
                    const contentType = res.headers.get("content-type") ?? "";
                    const body = await res.text();
                    const text = contentType.includes("html")
                        ? htmlToText(body)
                        : body;
                    return text.length > FETCH_TEXT_LIMIT
                        ? `${text.slice(0, FETCH_TEXT_LIMIT)}\n[truncated at ${FETCH_TEXT_LIMIT} characters]`
                        : text;
                },
            ),
        }),
    };
}

/** Crude but dependency-free HTML → text. Good enough for reading articles/docs. */
export function htmlToText(html: string): string {
    return html
        .replace(/<script[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[\s\S]*?<\/style>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<(br|\/p|\/div|\/li|\/h[1-6]|\/tr)[^>]*>/gi, "\n")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;/g, " ")
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/[ \t]+/g, " ")
        .replace(/ *\n */g, "\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

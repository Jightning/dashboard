import { describe, expect, it } from "vitest";
import {
    SessionGrants,
    domainMatches,
    evaluateToolCall,
    folderContains,
    grantMatches,
} from "./engine";
import type { ResolvedScope, ScopedGrant } from "./types";

const readDoc = (folder: string): ResolvedScope => ({
    access: "read",
    scopeType: "doc_folder",
    scopeValue: folder,
});
const fetchDomain = (domain: string): ResolvedScope => ({
    access: "read",
    scopeType: "url_domain",
    scopeValue: domain,
});

function decide(
    tool: string,
    scope: ResolvedScope,
    levelGrants: ScopedGrant[],
    sessionGrants = new SessionGrants(),
) {
    return evaluateToolCall({ tool, scope, levelGrants, sessionGrants });
}

describe("grant matching decision table", () => {
    const cases: Array<{
        name: string;
        grant: ScopedGrant;
        tool: string;
        scope: ResolvedScope;
        expected: boolean;
    }> = [
        {
            name: "any-scope read grant allows any folder",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "any",
                scopeValue: null,
            },
            tool: "read_document",
            scope: readDoc("/personal"),
            expected: true,
        },
        {
            name: "different tool never matches",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "any",
                scopeValue: null,
            },
            tool: "search_documents",
            scope: readDoc("/personal"),
            expected: false,
        },
        {
            name: "read grant does not cover write access",
            grant: {
                tool: "create_document",
                access: "read",
                scopeType: "any",
                scopeValue: null,
            },
            tool: "create_document",
            scope: {
                access: "write",
                scopeType: "doc_folder",
                scopeValue: "/x",
            },
            expected: false,
        },
        {
            name: "write grant does not cover read access (strict equality)",
            grant: {
                tool: "read_document",
                access: "write",
                scopeType: "any",
                scopeValue: null,
            },
            tool: "read_document",
            scope: readDoc("/x"),
            expected: false,
        },
        {
            name: "folder grant covers exact folder",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
            tool: "read_document",
            scope: readDoc("/school"),
            expected: true,
        },
        {
            name: "folder grant covers subfolders",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
            tool: "read_document",
            scope: readDoc("/school/ece"),
            expected: true,
        },
        {
            name: "folder grant does not cover sibling prefix (/schoolwork)",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
            tool: "read_document",
            scope: readDoc("/schoolwork"),
            expected: false,
        },
        {
            name: "folder grant does not cover parent folder",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school/ece",
            },
            tool: "read_document",
            scope: readDoc("/school"),
            expected: false,
        },
        {
            name: "root folder grant covers everything",
            grant: {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/",
            },
            tool: "read_document",
            scope: readDoc("/anything/here"),
            expected: true,
        },
        {
            name: "domain grant covers exact domain",
            grant: {
                tool: "fetch_url",
                access: "read",
                scopeType: "url_domain",
                scopeValue: "example.com",
            },
            tool: "fetch_url",
            scope: fetchDomain("example.com"),
            expected: true,
        },
        {
            name: "domain grant covers subdomains",
            grant: {
                tool: "fetch_url",
                access: "read",
                scopeType: "url_domain",
                scopeValue: "example.com",
            },
            tool: "fetch_url",
            scope: fetchDomain("docs.example.com"),
            expected: true,
        },
        {
            name: "domain grant rejects lookalike suffix (notexample.com)",
            grant: {
                tool: "fetch_url",
                access: "read",
                scopeType: "url_domain",
                scopeValue: "example.com",
            },
            tool: "fetch_url",
            scope: fetchDomain("notexample.com"),
            expected: false,
        },
        {
            name: "scope-type mismatch never matches",
            grant: {
                tool: "fetch_url",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
            tool: "fetch_url",
            scope: fetchDomain("example.com"),
            expected: false,
        },
    ];

    for (const c of cases) {
        it(c.name, () => {
            expect(grantMatches(c.grant, c.tool, c.scope)).toBe(c.expected);
        });
    }
});

describe("evaluateToolCall", () => {
    it("asks when there are no grants at all (Ask everything level)", () => {
        expect(decide("read_document", readDoc("/school"), [])).toBe("ask");
    });

    it("allows via level grant", () => {
        const grants: ScopedGrant[] = [
            {
                tool: "read_document",
                access: "read",
                scopeType: "doc_folder",
                scopeValue: "/school",
            },
        ];
        expect(decide("read_document", readDoc("/school/hw"), grants)).toBe(
            "allow",
        );
        expect(decide("read_document", readDoc("/personal"), grants)).toBe(
            "ask",
        );
    });

    it("allows via session grant added from an approval", () => {
        const session = new SessionGrants();
        expect(decide("fetch_url", fetchDomain("arxiv.org"), [], session)).toBe(
            "ask",
        );

        session.addFrom("fetch_url", fetchDomain("arxiv.org"));
        expect(decide("fetch_url", fetchDomain("arxiv.org"), [], session)).toBe(
            "allow",
        );
        // The session grant is scoped: another domain still asks.
        expect(decide("fetch_url", fetchDomain("evil.com"), [], session)).toBe(
            "ask",
        );
    });

    it("session grants clear when the session resets", () => {
        const session = new SessionGrants();
        session.addFrom("read_document", readDoc("/school"));
        session.clear();
        expect(decide("read_document", readDoc("/school"), [], session)).toBe(
            "ask",
        );
    });
});

describe("matching helpers", () => {
    it("folderContains handles root and boundaries", () => {
        expect(folderContains("/", "/x")).toBe(true);
        expect(folderContains("/a", "/a/b")).toBe(true);
        expect(folderContains("/a", "/ab")).toBe(false);
    });

    it("domainMatches is case-insensitive", () => {
        expect(domainMatches("Example.COM", "docs.example.com")).toBe(true);
    });
});

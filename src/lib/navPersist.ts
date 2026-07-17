import type { NavTarget, Page } from "@/app/Sidebar";

const KEY = "hugh.nav.v1";
// Exhaustively checked so adding a Page member without updating this list is
// a compile error, unlike an easily-forgotten array literal.
const PAGES: Record<Page, true> = {
    home: true,
    agents: true,
    categories: true,
    notes: true,
    planner: true,
    presets: true,
    permissions: true,
    settings: true,
};

/** Last nav position, or null when unset/corrupt. Never throws. */
export function loadNav(): NavTarget | null {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw) as Record<string, unknown>;
        if (typeof parsed.page !== "string" || !(parsed.page in PAGES))
            return null;
        const nav: NavTarget = { page: parsed.page as Page };
        if (typeof parsed.tab === "string") nav.tab = parsed.tab;
        if (typeof parsed.sessionId === "string") nav.sessionId = parsed.sessionId;
        if (typeof parsed.projectId === "string") nav.projectId = parsed.projectId;
        return nav;
    } catch {
        return null;
    }
}

export function saveNav(t: NavTarget): void {
    try {
        localStorage.setItem(KEY, JSON.stringify(t));
    } catch {
        // storage full/blocked — losing persistence is fine, breaking nav isn't
    }
}

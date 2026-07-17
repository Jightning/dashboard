import {
    CalendarCheck,
    LayoutDashboard,
    Network,
    NotebookPen,
    Settings,
    Shield,
    SlidersHorizontal,
    Tags,
} from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

export type Page =
    | "home"
    | "agents"
    | "categories"
    | "notes"
    | "planner"
    | "presets"
    | "permissions"
    | "settings";

export interface NavTarget {
    page: Page;
    tab?: string;
    sessionId?: string;
    projectId?: string;
}

interface NavItem {
    page: Page;
    label: string;
    icon: typeof Network;
}

const SECTIONS: { heading: string; items: NavItem[] }[] = [
    {
        heading: "Command",
        items: [
            { page: "home", label: "Home", icon: LayoutDashboard },
            { page: "agents", label: "Agents", icon: Network },
        ],
    },
    {
        heading: "Workspace",
        items: [
            { page: "categories", label: "Categories", icon: Tags },
            { page: "notes", label: "Notes", icon: NotebookPen },
            { page: "planner", label: "Planner", icon: CalendarCheck },
        ],
    },
    {
        heading: "Config",
        items: [
            { page: "presets", label: "Presets", icon: SlidersHorizontal },
            { page: "permissions", label: "Permissions", icon: Shield },
            { page: "settings", label: "Settings", icon: Settings },
        ],
    },
];

export function Sidebar({
    page,
    onNavigate,
}: {
    page: Page;
    onNavigate: (p: Page) => void;
}) {
    return (
        <nav className="flex w-52 shrink-0 flex-col border-r border-border bg-background/85">
            <div className="px-4 pb-4 pt-5">
                <div className="flex items-center gap-2">
                    <svg
                        aria-hidden
                        viewBox="0 0 12 12"
                        className="h-3 w-3 text-primary"
                    >
                        {/* Four-point star — the app's mark, echoing the globe's spikes */}
                        <path
                            fill="currentColor"
                            d="M6 0 L7.1 4.9 L12 6 L7.1 7.1 L6 12 L4.9 7.1 L0 6 L4.9 4.9 Z"
                        />
                    </svg>
                    <div className="font-display text-lg font-semibold tracking-[0.25em] text-primary">
                        HUGH
                    </div>
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    personal observatory
                </div>
            </div>

            {SECTIONS.map(({ heading, items }) => (
                <div key={heading} className="flex flex-col gap-0.5 px-2 pb-3">
                    <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                        {heading}
                    </div>
                    {items.map(({ page: p, label, icon: Icon }) => (
                        <button
                            key={p}
                            onClick={() => onNavigate(p)}
                            aria-current={page === p ? "page" : undefined}
                            className={cn(
                                "relative flex cursor-pointer items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors duration-(--dur-fast) hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring",
                                page === p
                                    ? "text-primary"
                                    : "text-muted-foreground",
                            )}
                        >
                            {page === p && (
                                <motion.span
                                    layoutId="nav-active"
                                    className="absolute inset-0 rounded-md border border-primary/30 bg-primary/10 glow-sm"
                                    transition={{
                                        type: "spring",
                                        stiffness: 500,
                                        damping: 38,
                                    }}
                                />
                            )}
                            <Icon aria-hidden className="relative h-4 w-4" />
                            <span className="relative">{label}</span>
                        </button>
                    ))}
                </div>
            ))}
        </nav>
    );
}

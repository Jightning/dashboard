import {
    Bookmark,
    Briefcase,
    CalendarCheck,
    LayoutDashboard,
    MessageSquare,
    Network,
    NotebookPen,
    ScrollText,
    Settings,
    Shield,
    SlidersHorizontal,
} from "lucide-react";
import { motion } from "motion/react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type Page =
    | "home"
    | "chat"
    | "agents"
    | "notes"
    | "tasks"
    | "applications"
    | "presets"
    | "permissions"
    | "settings";

interface NavItem {
    page: Page;
    label: string;
    icon: typeof MessageSquare;
}

const SECTIONS: { heading: string; items: NavItem[] }[] = [
    {
        heading: "Command",
        items: [
            { page: "home", label: "Home", icon: LayoutDashboard },
            { page: "chat", label: "Chat", icon: MessageSquare },
            { page: "agents", label: "Agents", icon: Network },
        ],
    },
    {
        heading: "Workspace",
        items: [
            { page: "notes", label: "Notes", icon: NotebookPen },
            { page: "tasks", label: "Tasks", icon: CalendarCheck },
            { page: "applications", label: "Applications", icon: Briefcase },
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

/** Roadmap features that only exist as designed stubs — see StubPanel. */
const SOON: { label: string; phase: string; icon: typeof MessageSquare }[] = [
    { label: "Bookmarks", phase: "P3", icon: Bookmark },
    { label: "Snippets", phase: "P3", icon: ScrollText },
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
                <div className="font-display text-glow text-lg font-bold tracking-[0.2em] text-primary">
                    Hugh
                </div>
                <div className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                    personal dashboard
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

            <div className="mt-auto flex flex-col gap-0.5 px-2 pb-3">
                <div className="px-3 pb-1 font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground/70">
                    Soon
                </div>
                {SOON.map(({ label, phase, icon: Icon }) => (
                    <div
                        key={label}
                        title={`${label} arrives in roadmap ${phase}`}
                        className="flex items-center gap-2.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground/50"
                    >
                        <Icon aria-hidden className="h-4 w-4" />
                        <span className="flex-1">{label}</span>
                        <Badge>{phase}</Badge>
                    </div>
                ))}
            </div>
        </nav>
    );
}

import {
    MessageSquare,
    SlidersHorizontal,
    Shield,
    Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type Page = "chat" | "presets" | "permissions" | "settings";

const items: { page: Page; label: string; icon: typeof MessageSquare }[] = [
    { page: "chat", label: "Chat", icon: MessageSquare },
    { page: "presets", label: "Presets", icon: SlidersHorizontal },
    { page: "permissions", label: "Permissions", icon: Shield },
    { page: "settings", label: "Settings", icon: Settings },
];

export function Sidebar({
    page,
    onNavigate,
}: {
    page: Page;
    onNavigate: (p: Page) => void;
}) {
    return (
        <nav className="flex w-48 shrink-0 flex-col gap-1 border-r border-border p-2">
            <div className="px-3 py-2 text-sm font-semibold">Dashboard</div>
            {items.map(({ page: p, label, icon: Icon }) => (
                <button
                    key={p}
                    onClick={() => onNavigate(p)}
                    className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-left text-sm hover:bg-accent",
                        page === p && "bg-accent font-medium",
                    )}
                >
                    <Icon className="h-4 w-4" />
                    {label}
                </button>
            ))}
        </nav>
    );
}

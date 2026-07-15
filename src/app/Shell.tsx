import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar, type Page, type NavTarget } from "./Sidebar";
import { HomePage } from "./home/HomePage";
import { ChatPage } from "./chat/ChatPage";
import { AgentsPage } from "./agents/AgentsPage";
import { NotesPage } from "./notes/NotesPage";
import { PlannerPage } from "./planner/PlannerPage";
import { SettingsPage } from "./settings/SettingsPage";
import { PresetsPage } from "./presets/PresetsPage";
import { PermissionsPage } from "./permissions/PermissionsPage";
import { GridBackground } from "@/components/hud/GridBackground";
import { StatusBar } from "@/components/hud/StatusBar";
import { CommandPalette } from "@/components/palette/CommandPalette";
import { useRuntime } from "./runtime";

const PAGES: Record<Page, () => React.JSX.Element> = {
    home: HomePage,
    chat: ChatPage,
    agents: AgentsPage,
    notes: NotesPage,
    planner: PlannerPage,
    presets: PresetsPage,
    permissions: PermissionsPage,
    settings: SettingsPage,
};

export function Shell() {
    const [nav, setNav] = useState<NavTarget>({ page: "home" });
    const { settings } = useRuntime();
    const Active = PAGES[nav.page];

    return (
        <div className="flex h-screen flex-col">
            <GridBackground />
            <div className="flex min-h-0 flex-1">
                <Sidebar
                    page={nav.page}
                    onNavigate={(p) => setNav({ page: p })}
                />
                <main className="min-w-0 flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={nav.page}
                            className="h-full"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{
                                duration: 0.25,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            {nav.page === "notes" ? (
                                <NotesPage tab={nav.tab} />
                            ) : nav.page === "planner" ? (
                                <PlannerPage tab={nav.tab} />
                            ) : (
                                <Active />
                            )}
                        </motion.div>
                    </AnimatePresence>
                </main>
            </div>
            <StatusBar>
                <span>db linked</span>
                <span>
                    {settings.defaultProvider}/{settings.defaultModel}
                </span>
            </StatusBar>
            <CommandPalette onNavigate={setNav} />
        </div>
    );
}

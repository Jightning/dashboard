import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Sidebar, type Page } from "./Sidebar";
import { HomePage } from "./home/HomePage";
import { ChatPage } from "./chat/ChatPage";
import { AgentsPage } from "./agents/AgentsPage";
import { NotesPage } from "./notes/NotesPage";
import { TasksPage } from "./tasks/TasksPage";
import { ApplicationsPage } from "./applications/ApplicationsPage";
import { ReviewPage } from "./review/ReviewPage";
import { LibraryPage } from "./library/LibraryPage";
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
    tasks: TasksPage,
    applications: ApplicationsPage,
    review: ReviewPage,
    library: LibraryPage,
    presets: PresetsPage,
    permissions: PermissionsPage,
    settings: SettingsPage,
};

export function Shell() {
    const [page, setPage] = useState<Page>("home");
    const { settings } = useRuntime();
    const Active = PAGES[page];

    return (
        <div className="flex h-screen flex-col">
            <GridBackground />
            <div className="flex min-h-0 flex-1">
                <Sidebar page={page} onNavigate={setPage} />
                <main className="min-w-0 flex-1 overflow-hidden">
                    <AnimatePresence mode="wait">
                        <motion.div
                            key={page}
                            className="h-full"
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -8 }}
                            transition={{
                                duration: 0.25,
                                ease: [0.16, 1, 0.3, 1],
                            }}
                        >
                            <Active />
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
            <CommandPalette onNavigate={setPage} />
        </div>
    );
}

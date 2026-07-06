import { useState } from "react";
import { Sidebar, type Page } from "./Sidebar";
import { ChatPage } from "./chat/ChatPage";
import { SettingsPage } from "./settings/SettingsPage";
import { PresetsPage } from "./presets/PresetsPage";
import { PermissionsPage } from "./permissions/PermissionsPage";

export function Shell() {
    const [page, setPage] = useState<Page>("chat");

    return (
        <div className="flex h-screen">
            <Sidebar page={page} onNavigate={setPage} />
            <main className="flex-1 overflow-hidden">
                {page === "chat" && <ChatPage />}
                {page === "presets" && <PresetsPage />}
                {page === "permissions" && <PermissionsPage />}
                {page === "settings" && <SettingsPage />}
            </main>
        </div>
    );
}

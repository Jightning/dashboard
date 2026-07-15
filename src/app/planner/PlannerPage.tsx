import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { TabBar } from "@/components/ui/tabs";
import { TasksTab } from "./TasksTab";
import { CalendarTab } from "./CalendarTab";
import { ApplicationsTab } from "./ApplicationsTab";
import { ReviewTab } from "./ReviewTab";

type PlannerTab = "tasks" | "calendar" | "applications" | "review";
const TABS: { id: PlannerTab; label: string }[] = [
    { id: "tasks", label: "Tasks" },
    { id: "calendar", label: "Calendar" },
    { id: "applications", label: "Applications" },
    { id: "review", label: "Review" },
];
const isTab = (t: string | undefined): t is PlannerTab =>
    TABS.some((x) => x.id === t);

export function PlannerPage({ tab }: { tab?: string } = {}) {
    const [active, setActive] = useState<PlannerTab>(isTab(tab) ? tab : "tasks");
    useEffect(() => {
        if (isTab(tab)) setActive(tab);
    }, [tab]);

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-3xl flex-col gap-6">
                <header>
                    <h1 className="font-display text-2xl font-semibold tracking-wide">
                        Planner
                    </h1>
                    <p className="mt-1 text-sm text-muted-foreground">
                        Deadlines, schedules, applications, and reviews — one
                        ephemeris for everything time-shaped.
                    </p>
                </header>
                <TabBar tabs={TABS} active={active} onSelect={setActive} />
            </div>
            <div
                className={cn(
                    "mx-auto mt-6 flex flex-col gap-6",
                    active === "applications" ? "max-w-6xl" : "max-w-3xl",
                )}
            >
                {active === "tasks" && <TasksTab />}
                {active === "calendar" && <CalendarTab />}
                {active === "applications" && <ApplicationsTab />}
                {active === "review" && <ReviewTab />}
            </div>
        </div>
    );
}

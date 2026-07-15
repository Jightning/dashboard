import { useCallback, useEffect, useState } from "react";
import { marked } from "marked";
import {
    applyReview,
    countDueFlashcards,
    listDueFlashcards,
    suspendFlashcard,
} from "@/db/repo/flashcards";
import type { Grade } from "@/lib/sm2";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { Flashcard } from "@/lib/schemas";

marked.setOptions({ breaks: true, gfm: true });

const GRADES: { grade: Grade; label: string; key: string }[] = [
    { grade: 0, label: "Again", key: "1" },
    { grade: 3, label: "Hard", key: "2" },
    { grade: 4, label: "Good", key: "3" },
    { grade: 5, label: "Easy", key: "4" },
];

export function ReviewPage() {
    const [queue, setQueue] = useState<Flashcard[]>([]);
    const [dueCount, setDueCount] = useState(0);
    const [revealed, setRevealed] = useState(false);
    const [reviewed, setReviewed] = useState(0);
    const [grading, setGrading] = useState(false);

    const reload = useCallback(async () => {
        setQueue(await listDueFlashcards(Date.now()));
        setDueCount(await countDueFlashcards(Date.now()));
        setRevealed(false);
    }, []);
    useEffect(() => {
        void reload();
    }, [reload]);

    const card = queue[0] ?? null;

    const grade = useCallback(
        async (g: Grade) => {
            if (!card || !revealed || grading) return;
            setGrading(true);
            try {
                await applyReview(card.id, g);
                setReviewed((n) => n + 1);
                await reload();
            } finally {
                setGrading(false);
            }
        },
        [card, revealed, grading, reload],
    );

    // Keyboard-first: space reveals, 1-4 grade.
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement) return;
            if (e.code === "Space") {
                e.preventDefault();
                setRevealed(true);
                return;
            }
            const g = GRADES.find((x) => x.key === e.key);
            if (g) void grade(g.grade);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [grade]);

    const frontHtml = card ? (marked.parse(card.front) as string) : "";
    const backHtml = card ? (marked.parse(card.back) as string) : "";

    return (
        <div className="h-full overflow-y-auto p-6">
            <div className="mx-auto flex max-w-2xl flex-col gap-6">
                <header className="flex items-end justify-between">
                    <div>
                        <h1 className="font-display text-2xl font-semibold tracking-wide">
                            Review
                        </h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Space reveals · 1–4 grades. Cards come from the
                            create_flashcards tool or pipelines over your notes.
                        </p>
                    </div>
                    <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
                        {dueCount} due · {reviewed} done
                    </span>
                </header>

                {!card ? (
                    <Card corners className="p-8 text-center">
                        <p className="text-sm text-muted-foreground">
                            Queue clear.{" "}
                            {reviewed > 0
                                ? `${reviewed} reviewed this session.`
                                : "Ask an agent to make cards from your lecture notes."}
                        </p>
                    </Card>
                ) : (
                    <Card corners className="flex flex-col gap-4 p-6">
                        <div className="flex items-center justify-between">
                            <Badge>{card.folder}</Badge>
                            <button
                                className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                                onClick={() =>
                                    void suspendFlashcard(card.id).then(reload)
                                }
                            >
                                suspend
                            </button>
                        </div>
                        <div
                            className="markdown text-base"
                            dangerouslySetInnerHTML={{ __html: frontHtml }}
                        />
                        {revealed ? (
                            <>
                                <div
                                    className="markdown border-t border-border pt-4 text-sm text-foreground/90"
                                    dangerouslySetInnerHTML={{
                                        __html: backHtml,
                                    }}
                                />
                                <div className="flex gap-2">
                                    {GRADES.map((g) => (
                                        <Button
                                            key={g.grade}
                                            variant={
                                                g.grade === 0
                                                    ? "destructive"
                                                    : g.grade === 4
                                                      ? "default"
                                                      : "outline"
                                            }
                                            className="flex-1"
                                            disabled={grading}
                                            onClick={() => void grade(g.grade)}
                                        >
                                            {g.label}
                                            <span className="ml-1 font-mono text-[10px] opacity-60">
                                                {g.key}
                                            </span>
                                        </Button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <Button onClick={() => setRevealed(true)}>
                                Reveal (space)
                            </Button>
                        )}
                    </Card>
                )}
            </div>
        </div>
    );
}

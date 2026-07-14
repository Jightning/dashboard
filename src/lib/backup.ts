import { getDb } from "@/db/client";
import { isTauri } from "@/lib/env";
import { listNotes, getNote } from "@/db/repo/notes";

/**
 * One backup per calendar day, kept 14 deep. VACUUM INTO is SQLite's official
 * online-backup path — safe while the app is running, and it compacts too.
 * If the SQL layer rejects VACUUM INTO, surface the error; do not fall back
 * to copying a live db file (torn copies are worse than no backup).
 */
export async function runDailyBackup(): Promise<string | null> {
    if (!isTauri()) return null;
    const { appDataDir, join } = await import("@tauri-apps/api/path");
    const { exists, mkdir, readDir, remove } = await import(
        "@tauri-apps/plugin-fs"
    );
    const dir = await join(await appDataDir(), "backups");
    if (!(await exists(dir))) await mkdir(dir, { recursive: true });

    const stamp = new Date().toISOString().slice(0, 10);
    const target = await join(dir, `dashboard-${stamp}.db`);
    if (await exists(target)) return null; // today's backup already exists

    await getDb().execute(`VACUUM INTO '${target.replaceAll("'", "''")}'`);

    const entries = (await readDir(dir))
        .map((e) => e.name)
        .filter((n): n is string => !!n && n.startsWith("dashboard-"))
        .sort();
    for (const old of entries.slice(0, Math.max(0, entries.length - 14))) {
        await remove(await join(dir, old));
    }
    return target;
}

/** Everything-as-markdown escape hatch; also the web target's "backup". */
export async function exportNotesMarkdown(): Promise<Blob> {
    const summaries = await listNotes();
    const parts: string[] = [];
    for (const s of summaries) {
        const note = await getNote(s.id);
        parts.push(`# ${note.title}\n\n_${note.folder}_\n\n${note.body_md}\n`);
    }
    return new Blob([parts.join("\n---\n\n")], { type: "text/markdown" });
}

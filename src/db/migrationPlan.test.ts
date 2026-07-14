import { describe, expect, it } from "vitest";
import { planMigrations, type MigrationFile } from "./migrationPlan";

const M0001: MigrationFile = {
    version: "0001_init.sql",
    sql: "CREATE TABLE presets (id TEXT PRIMARY KEY);",
};
const M0002: MigrationFile = {
    version: "0002_notes.sql",
    sql: "CREATE TABLE notes (id TEXT PRIMARY KEY);",
};
const M0003: MigrationFile = {
    version: "0003_agents.sql",
    sql: "CREATE TABLE agents (id TEXT PRIMARY KEY);",
};

describe("planMigrations", () => {
    it("runs and records every migration for a brand-new database", () => {
        const plan = planMigrations([M0001, M0002, M0003], new Set(), new Set());
        expect(plan).toEqual([
            { version: "0001_init.sql", sql: M0001.sql, run: true },
            { version: "0002_notes.sql", sql: M0002.sql, run: true },
            { version: "0003_agents.sql", sql: M0003.sql, run: true },
        ]);
    });

    it("skips nothing once already recorded as applied", () => {
        const applied = new Set(["0001_init.sql", "0002_notes.sql", "0003_agents.sql"]);
        const plan = planMigrations([M0001, M0002, M0003], applied, new Set());
        expect(plan).toEqual([]);
    });

    it("bootstraps a legacy untracked database: detects already-applied migrations by table existence, only runs the rest", () => {
        // An old database created before migration tracking existed: tables
        // from 0001/0002 are already there, but nothing has been recorded in
        // the (newly created) bookkeeping table yet.
        const existingTables = new Set(["presets", "notes"]);
        const plan = planMigrations([M0001, M0002, M0003], new Set(), existingTables);
        expect(plan).toEqual([
            { version: "0001_init.sql", sql: M0001.sql, run: false },
            { version: "0002_notes.sql", sql: M0002.sql, run: false },
            { version: "0003_agents.sql", sql: M0003.sql, run: true },
        ]);
    });

    it("does not treat a new migration as historically applied just because bootstrapping is happening for older ones", () => {
        // Same legacy scenario, but 0003's table doesn't exist yet -- it must
        // actually run, not be silently skipped.
        const existingTables = new Set(["presets", "notes"]);
        const plan = planMigrations([M0001, M0002, M0003], new Set(), existingTables);
        const agentsEntry = plan.find((p) => p.version === "0003_agents.sql");
        expect(agentsEntry?.run).toBe(true);
    });

    it("does not run bootstrap heuristics once any version has been recorded (no longer a legacy db)", () => {
        // Once migration 0001 alone has been recorded, this database is
        // tracked -- an unrecorded 0002 must run even though its table
        // happens to already exist (e.g. from a manual/partial migration),
        // since we no longer trust table-existence over the ledger.
        const applied = new Set(["0001_init.sql"]);
        const existingTables = new Set(["presets", "notes"]);
        const plan = planMigrations([M0001, M0002], applied, existingTables);
        expect(plan).toEqual([{ version: "0002_notes.sql", sql: M0002.sql, run: true }]);
    });
});

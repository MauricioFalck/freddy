import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { SCHEMA_SQL } from "./schema.ts";

/**
 * SQLite connection handling.
 *
 * One process, one file, one connection. `node:sqlite` ships with Node 24, so
 * this costs us no dependency and no service to operate.
 */

let instance: DatabaseSync | null = null;

/** Opens a database at `path` and applies the schema. */
export function openDatabase(path: string): DatabaseSync {
  if (path !== ":memory:") {
    mkdirSync(dirname(path), { recursive: true });
  }
  const db = new DatabaseSync(path);
  db.exec(SCHEMA_SQL);
  if (path !== ":memory:") {
    db.exec("PRAGMA journal_mode = WAL;");
  }
  return db;
}

/** The process-wide database used by the running application. */
export function getDb(): DatabaseSync {
  if (!instance) {
    instance = openDatabase(process.env.DATABASE_PATH ?? "data/freddy.db");
  }
  return instance;
}

/** Replaces the process-wide database. Used by tests to inject a fresh one. */
export function setDb(db: DatabaseSync | null): void {
  instance = db;
}

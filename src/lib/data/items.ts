import { randomUUID } from "node:crypto";
import type { DatabaseSync } from "node:sqlite";

/**
 * The managed-item repository — and the per-user isolation boundary.
 *
 * Every function here takes an owner id and every statement filters on
 * `user_id`. There is deliberately no `getItem(id)` or `listAllItems()`: an
 * unscoped accessor is the thing that leaks, so it does not exist to be called
 * by mistake. Reads and writes that miss the owner check return null / false
 * rather than throwing, so callers naturally turn them into 404s and never
 * disclose that someone else's row exists.
 *
 * `items` is a placeholder entity: the product vertical is not chosen yet.
 * What matters is that the scoping pattern is established and tested.
 */

export interface Item {
  id: string;
  userId: string;
  title: string;
  note: string;
  createdAt: number;
  updatedAt: number;
}

interface ItemRow {
  id: string;
  user_id: string;
  title: string;
  note: string;
  created_at: number;
  updated_at: number;
}

const COLUMNS = "id, user_id, title, note, created_at, updated_at";

function toItem(row: ItemRow): Item {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Lists a user's items, newest first. Never returns another user's rows. */
export function listItems(db: DatabaseSync, userId: string): Item[] {
  const rows = db
    .prepare(
      `SELECT ${COLUMNS} FROM items WHERE user_id = ? ORDER BY created_at DESC, id DESC`,
    )
    .all(userId) as unknown as ItemRow[];
  return rows.map(toItem);
}

/**
 * Fetches one item owned by `userId`.
 *
 * Returns null both when the item does not exist and when it belongs to
 * someone else — the caller cannot tell the two apart, which is the point.
 */
export function getItem(db: DatabaseSync, userId: string, itemId: string): Item | null {
  const row = db
    .prepare(`SELECT ${COLUMNS} FROM items WHERE id = ? AND user_id = ?`)
    .get(itemId, userId) as ItemRow | undefined;
  return row ? toItem(row) : null;
}

/** Creates an item owned by `userId`. */
export function createItem(
  db: DatabaseSync,
  userId: string,
  input: { title: string; note?: string },
  now: number = Date.now(),
): Item {
  const title = input.title.trim();
  if (title.length === 0) throw new Error("title is required");

  const item: Item = {
    id: randomUUID(),
    userId,
    title,
    note: (input.note ?? "").trim(),
    createdAt: now,
    updatedAt: now,
  };

  db.prepare(`INSERT INTO items (${COLUMNS}) VALUES (?, ?, ?, ?, ?, ?)`).run(
    item.id,
    item.userId,
    item.title,
    item.note,
    item.createdAt,
    item.updatedAt,
  );

  return item;
}

/**
 * Updates an item, but only if `userId` owns it.
 *
 * The ownership check is part of the UPDATE's WHERE clause rather than a
 * separate read, so there is no window between checking and writing.
 */
export function updateItem(
  db: DatabaseSync,
  userId: string,
  itemId: string,
  changes: { title?: string; note?: string },
  now: number = Date.now(),
): Item | null {
  const existing = getItem(db, userId, itemId);
  if (!existing) return null;

  const title = changes.title === undefined ? existing.title : changes.title.trim();
  if (title.length === 0) throw new Error("title is required");
  const note = changes.note === undefined ? existing.note : changes.note.trim();

  const result = db
    .prepare(
      "UPDATE items SET title = ?, note = ?, updated_at = ? WHERE id = ? AND user_id = ?",
    )
    .run(title, note, now, itemId, userId);

  if (result.changes !== 1) return null;
  return { ...existing, title, note, updatedAt: now };
}

/** Deletes an item owned by `userId`. Returns false if it was not theirs. */
export function deleteItem(db: DatabaseSync, userId: string, itemId: string): boolean {
  const result = db
    .prepare("DELETE FROM items WHERE id = ? AND user_id = ?")
    .run(itemId, userId);
  return result.changes === 1;
}

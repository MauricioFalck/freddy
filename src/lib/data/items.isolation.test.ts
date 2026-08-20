import { beforeEach, describe, expect, it } from "vitest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "../db/index.ts";
import { createUser } from "../auth/users.ts";
import { createItem, deleteItem, getItem, listItems, updateItem } from "./items.ts";

/**
 * Cross-user isolation.
 *
 * Every one of these asserts the same thing from a different angle: user A's
 * credentials must not reach user B's rows. They use two real users and real
 * rows, and they check the *return value* of each mutation, because "the write
 * silently did nothing but reported success" is the failure mode that turns
 * into a data leak later.
 */

let db: DatabaseSync;
let alice: string;
let bob: string;

beforeEach(async () => {
  db = openDatabase(":memory:");
  alice = (await createUser(db, "alice@example.test", "correct-horse-1")).id;
  bob = (await createUser(db, "bob@example.test", "correct-horse-2")).id;
});

describe("per-user isolation", () => {
  it("lists only the requesting user's items", () => {
    createItem(db, alice, { title: "Alice one" });
    createItem(db, alice, { title: "Alice two" });
    createItem(db, bob, { title: "Bob one" });

    expect(
      listItems(db, alice)
        .map((i) => i.title)
        .sort(),
    ).toEqual(["Alice one", "Alice two"]);
    expect(listItems(db, bob).map((i) => i.title)).toEqual(["Bob one"]);
  });

  it("gives a brand-new user an empty list even when other users have data", () => {
    createItem(db, alice, { title: "Alice one" });
    expect(listItems(db, bob)).toEqual([]);
  });

  it("does not let user A read user B's item by id", () => {
    const bobItem = createItem(db, bob, { title: "Bob private" });

    expect(getItem(db, alice, bobItem.id)).toBeNull();
    expect(getItem(db, bob, bobItem.id)?.title).toBe("Bob private");
  });

  it("does not let user A update user B's item", () => {
    const bobItem = createItem(db, bob, { title: "Bob private" });

    expect(updateItem(db, alice, bobItem.id, { title: "Hijacked" })).toBeNull();
    // The row is untouched, not just the response.
    expect(getItem(db, bob, bobItem.id)?.title).toBe("Bob private");
  });

  it("does not let user A delete user B's item", () => {
    const bobItem = createItem(db, bob, { title: "Bob private" });

    expect(deleteItem(db, alice, bobItem.id)).toBe(false);
    expect(getItem(db, bob, bobItem.id)).not.toBeNull();
  });

  it("reports a miss identically for a foreign item and a nonexistent one", () => {
    const bobItem = createItem(db, bob, { title: "Bob private" });
    const missing = "00000000-0000-4000-8000-000000000000";

    // Same shape of answer either way: no existence oracle.
    expect(getItem(db, alice, bobItem.id)).toEqual(getItem(db, alice, missing));
    expect(deleteItem(db, alice, bobItem.id)).toBe(deleteItem(db, alice, missing));
    expect(updateItem(db, alice, bobItem.id, { title: "x" })).toEqual(
      updateItem(db, alice, missing, { title: "x" }),
    );
  });

  it("keeps items attributed to their creator", () => {
    const item = createItem(db, alice, { title: "Alice one" });
    expect(item.userId).toBe(alice);
    expect(getItem(db, alice, item.id)?.userId).toBe(alice);
  });

  it("removes a user's items when the user is deleted, and nobody else's", () => {
    const aliceItem = createItem(db, alice, { title: "Alice one" });
    const bobItem = createItem(db, bob, { title: "Bob one" });

    db.prepare("DELETE FROM users WHERE id = ?").run(alice);

    expect(getItem(db, alice, aliceItem.id)).toBeNull();
    expect(getItem(db, bob, bobItem.id)).not.toBeNull();
  });
});

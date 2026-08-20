/**
 * Synthetic seed data.
 *
 * Every account here is fabricated and uses the reserved `.test` TLD. We have
 * no privacy and retention position yet, so no real person's data goes near
 * this system — including ours.
 *
 * Run with: npm run seed
 */

import { openDatabase } from "./index.ts";
import { createUser, findUserByEmail } from "../auth/users.ts";
import { createItem, listItems } from "../data/items.ts";

const ACCOUNTS = [
  {
    email: "ada@example.test",
    password: "password12345",
    items: ["Renew passport", "Book dentist"],
  },
  {
    email: "grace@example.test",
    password: "password12345",
    items: ["Service the car"],
  },
  { email: "empty@example.test", password: "password12345", items: [] },
];

async function seed(): Promise<void> {
  const path = process.env.DATABASE_PATH ?? "data/freddy.db";
  const db = openDatabase(path);

  for (const account of ACCOUNTS) {
    const existing = findUserByEmail(db, account.email);
    if (existing) {
      console.info(
        `- ${account.email} already exists (${listItems(db, existing.id).length} items)`,
      );
      continue;
    }

    const user = await createUser(db, account.email, account.password);
    for (const title of account.items) {
      createItem(db, user.id, { title });
    }
    console.info(`+ ${account.email} (${account.items.length} items)`);
  }

  console.info(`\nSeeded ${path}. All accounts use the password: password12345`);
  db.close();
}

await seed();

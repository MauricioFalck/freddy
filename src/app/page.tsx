import { getDb } from "@/lib/db/index.ts";
import { requireUser } from "@/lib/auth/current-user.ts";
import { listItems } from "@/lib/data/items.ts";
import { logOutAction } from "./auth-actions.ts";

/**
 * The signed-in home screen.
 *
 * Note the shape: `requireUser()` first, then every query takes `user.id`. The
 * page is never handed a list it has to filter — it only ever receives rows the
 * database already scoped to this user.
 */

// Session state is per-request. This page must never be cached or prerendered.
export const dynamic = "force-dynamic";

export default async function HomePage() {
  const user = await requireUser();
  const items = listItems(getDb(), user.id);

  return (
    <main className="safe-top safe-bottom flex flex-1 flex-col px-6 py-6">
      <header className="flex items-baseline justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight">Your things</h1>
          <p className="text-muted mt-1 truncate text-sm">{user.email}</p>
        </div>
        <form action={logOutAction}>
          <button
            type="submit"
            className="border-border h-11 shrink-0 rounded-xl border px-3 text-sm font-medium"
          >
            Log out
          </button>
        </form>
      </header>

      <section className="mt-8 flex-1">
        {items.length === 0 ? (
          <div className="border-border rounded-2xl border border-dashed px-6 py-12 text-center">
            <p className="text-base font-medium">Nothing here yet</p>
            <p className="text-muted mt-2 text-sm">
              This is your own private space. Once we know what you will be managing,
              this is where it will live.
            </p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {items.map((item) => (
              <li
                key={item.id}
                className="border-border bg-surface rounded-2xl border px-4 py-3"
              >
                <p className="font-medium">{item.title}</p>
                {item.note ? (
                  <p className="text-muted mt-1 text-sm">{item.note}</p>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

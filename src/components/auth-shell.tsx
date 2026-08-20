import Link from "next/link";
import type { ReactNode } from "react";

/**
 * The signed-out screens.
 *
 * One column, 48px controls, primary action above the fold on a phone. Colours
 * come from the tokens in `globals.css` so light and dark both work without
 * anything here knowing which is active.
 */
export function AuthShell({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="safe-top safe-bottom flex flex-1 flex-col justify-center px-6 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="text-muted mt-2 text-sm">{subtitle}</p> : null}
      <div className="mt-6">{children}</div>
      {footer ? <div className="text-muted mt-6 text-sm">{footer}</div> : null}
    </main>
  );
}

/** A labelled text input, sized for thumbs. */
export function Field({
  label,
  name,
  type = "text",
  autoComplete,
  required = true,
  hint,
}: {
  label: string;
  name: string;
  type?: string;
  autoComplete?: string;
  required?: boolean;
  hint?: string;
}) {
  const hintId = hint ? `${name}-hint` : undefined;

  return (
    <div>
      <label className="block" htmlFor={name}>
        <span className="text-sm font-medium">{label}</span>
        <input
          id={name}
          className="border-border bg-surface focus:border-accent mt-1 block h-12 w-full rounded-xl border px-3 text-base outline-none"
          name={name}
          type={type}
          autoComplete={autoComplete}
          required={required}
          aria-describedby={hintId}
        />
      </label>
      {hint ? (
        <p className="text-muted mt-1 text-xs" id={hintId}>
          {hint}
        </p>
      ) : null}
    </div>
  );
}

/** The primary submit button. Full width, disabled while the action runs. */
export function SubmitButton({
  children,
  pending,
}: {
  children: ReactNode;
  pending: boolean;
}) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="bg-accent text-accent-contrast h-12 w-full rounded-xl text-base font-medium disabled:opacity-60"
    >
      {pending ? "Working…" : children}
    </button>
  );
}

/** An inline error, announced to screen readers as soon as it appears. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="border-danger/30 text-danger rounded-xl border px-3 py-2 text-sm"
    >
      {children}
    </p>
  );
}

/** A neutral confirmation, announced politely. */
export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="status" className="bg-surface-muted rounded-xl px-3 py-2 text-sm">
      {children}
    </p>
  );
}

/** A text link styled for the auth screens. */
export function TextLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link className="text-accent font-medium underline underline-offset-4" href={href}>
      {children}
    </Link>
  );
}

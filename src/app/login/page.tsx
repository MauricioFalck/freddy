import { redirect } from "next/navigation";
import { AuthShell, FormNotice, TextLink } from "@/components/auth-shell.tsx";
import { LogInForm } from "@/components/auth-forms.tsx";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { logInAction } from "../auth-actions.ts";

export const metadata = { title: "Log in" };

export default async function LogInPage({
  searchParams,
}: {
  searchParams: Promise<{ reset?: string }>;
}) {
  if (await getCurrentUser()) redirect("/");
  const { reset } = await searchParams;

  return (
    <AuthShell
      title="Log in"
      footer={
        <div className="flex flex-col gap-2">
          <span>
            No account yet? <TextLink href="/signup">Create one</TextLink>
          </span>
          <TextLink href="/forgot-password">Forgot your password?</TextLink>
        </div>
      }
    >
      <div className="flex flex-col gap-4">
        {reset ? (
          <FormNotice>
            Your password has been changed. Log in with your new one.
          </FormNotice>
        ) : null}
        <LogInForm action={logInAction} />
      </div>
    </AuthShell>
  );
}

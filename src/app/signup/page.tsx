import { redirect } from "next/navigation";
import { AuthShell, TextLink } from "@/components/auth-shell.tsx";
import { SignUpForm } from "@/components/auth-forms.tsx";
import { getCurrentUser } from "@/lib/auth/current-user.ts";
import { signUpAction } from "../auth-actions.ts";

export const metadata = { title: "Create your account" };

export default async function SignUpPage() {
  if (await getCurrentUser()) redirect("/");

  return (
    <AuthShell
      title="Create your account"
      subtitle="Your data is yours alone. Nothing is shared with anyone else."
      footer={
        <>
          Already have an account? <TextLink href="/login">Log in</TextLink>
        </>
      }
    >
      <SignUpForm action={signUpAction} />
    </AuthShell>
  );
}

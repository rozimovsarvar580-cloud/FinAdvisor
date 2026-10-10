import { AuthShell } from "@/components/auth/auth-shell";
import { VerifyEmailForm } from "@/components/auth/verify-email-form";

export default function VerifyEmailPage({
  searchParams
}: {
  searchParams?: { token?: string | string[] };
}) {
  const token =
    typeof searchParams?.token === "string" ? searchParams.token : undefined;
  return (
    <AuthShell>
      <VerifyEmailForm token={token} />
    </AuthShell>
  );
}

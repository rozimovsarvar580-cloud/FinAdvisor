import { AuthShell } from "@/components/auth/auth-shell";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { token?: string | string[] };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

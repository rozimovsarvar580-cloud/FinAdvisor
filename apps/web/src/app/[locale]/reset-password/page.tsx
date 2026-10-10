import { AuthShell } from "@/components/auth/auth-shell";
import ResetPasswordForm from "./ResetPasswordForm";

export function generateStaticParams() {
  return ["uz", "ru", "en"].map((locale) => ({ locale }));
}

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams?: { token?: string | string[] };
}) {
  const token =
    typeof searchParams?.token === "string" ? searchParams.token : undefined;
  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

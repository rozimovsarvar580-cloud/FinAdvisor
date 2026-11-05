import { AuthShell } from "@/components/auth/auth-shell";
<<<<<<< HEAD
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
=======
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default function ResetPasswordPage({
  searchParams
}: {
  searchParams: { token?: string | string[] };
}) {
  const token = typeof searchParams.token === "string" ? searchParams.token : "";
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  return (
    <AuthShell>
      <ResetPasswordForm token={token} />
    </AuthShell>
  );
}

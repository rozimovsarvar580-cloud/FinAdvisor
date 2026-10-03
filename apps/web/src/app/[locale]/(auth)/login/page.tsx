import { AuthShell } from "@/components/auth/auth-shell";
import { LoginForm } from "@/components/auth/login-form";

export default function LoginPage({
  params,
  searchParams
}: {
  params: { locale: string };
  searchParams: { callbackUrl?: string };
}) {
  const fallback = `/${params.locale}/app`;
  const requested = searchParams.callbackUrl;
  const callbackUrl =
    requested?.startsWith(`/${params.locale}/`) && !requested.startsWith("//")
      ? requested
      : fallback;

  return (
    <AuthShell>
      <LoginForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}

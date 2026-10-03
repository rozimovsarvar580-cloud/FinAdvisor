import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";

export default function SignupPage({
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
      <SignupForm callbackUrl={callbackUrl} />
    </AuthShell>
  );
}

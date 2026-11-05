import { AuthShell } from "@/components/auth/auth-shell";
import { SignupForm } from "@/components/auth/signup-form";
import { getSocialProviderAvailability } from "@/lib/social-providers";

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
      <SignupForm
        callbackUrl={callbackUrl}
        providersAvailable={getSocialProviderAvailability()}
      />
    </AuthShell>
  );
}

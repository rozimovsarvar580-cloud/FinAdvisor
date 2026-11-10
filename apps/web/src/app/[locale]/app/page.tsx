"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";

export default function AppIndexClient({ params }: { params: { locale: string } }) {
  const { locale } = params;
  const router = useRouter();
  const session = useSession();

  useEffect(() => {
    // If session is loading, wait.
    if (session.status === "loading") return;

    // If authenticated and marked as needing role onboarding, send to onboarding.
    if (session.status === "authenticated" && session.data?.needsRole === true) {
      router.replace(`/${locale}/onboarding/role`);
      return;
    }

    const role = session.status === "authenticated"
      ? session.data?.user.role
      : undefined;
    const destination =
      role === "buxgalter"
        ? "/accounting"
        : role === "investor"
          ? "/investors"
          : role === "admin"
            ? "/admin"
            : "/app/finadvisor";
    router.replace(`/${locale}${destination}`);
  }, [session, router, locale]);

  // Render nothing while deciding; avoid layout shift.
  return null;
}

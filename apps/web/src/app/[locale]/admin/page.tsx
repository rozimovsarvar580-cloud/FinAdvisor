import Link from "next/link";
import { getServerSession } from "next-auth/next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";

import { authOptions } from "../../../lib/auth";

const locales = ["uz", "ru", "en"] as const;
export function generateStaticParams() { return locales.map((locale) => ({ locale })); }

const aiStatusSchema = z.object({
  connected: z.boolean(),
  provider: z.string().min(1),
  model: z.string().min(1)
}).strict();

export default async function AdminPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!locales.includes(locale as (typeof locales)[number])) notFound();
  const t = await getTranslations({ locale, namespace: "routeCopy" });
  const session = await getServerSession(authOptions);
  let aiStatus: z.infer<typeof aiStatusSchema> | null = null;

  if (session?.user.role === "admin" && session.accessToken) {
    const apiUrl = process.env.FINADVISOR_API_URL ?? "http://127.0.0.1:8000";
    try {
      const response = await fetch(`${apiUrl}/admin/ai-status`, {
        headers: { Authorization: `Bearer ${session.accessToken}` },
        cache: "no-store"
      });
      if (response.ok) {
        const result = aiStatusSchema.safeParse(await response.json());
        if (result.success) aiStatus = result.data;
      }
    } catch (error) {
      if (!(error instanceof TypeError || error instanceof SyntaxError)) throw error;
    }
  }

  return (
    <main>
      <h1>{t("admin.title")}</h1>
      <ul><li>{t("admin.users")}</li><li>{t("admin.planModeration")}</li><li>{t("admin.kycReview")}</li><li>{t("admin.auditLog")}</li><li>{t("admin.featureFlags")}</li></ul>
      <section aria-labelledby="ai-status-title">
        <h2 id="ai-status-title">{t("admin.aiStatusTitle")}</h2>
        {aiStatus ? (
          <>
            <p role="status">
              {t(aiStatus.connected ? "admin.aiConnected" : "admin.aiDisconnected")}
            </p>
            <dl>
              <dt>{t("admin.aiProvider")}</dt>
              <dd>{aiStatus.provider}</dd>
              <dt>{t("admin.aiModel")}</dt>
              <dd>{aiStatus.model}</dd>
            </dl>
          </>
        ) : (
          <p role="status">{t("admin.aiStatusUnavailable")}</p>
        )}
      </section>
      <Link href={`/${locale}/dashboard`}>{t("common.backToDashboard")}</Link>
    </main>
  );
}

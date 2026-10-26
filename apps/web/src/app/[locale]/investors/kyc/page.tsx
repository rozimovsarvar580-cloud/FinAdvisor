"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { useParams } from "next/navigation";

type Profile = { full_name: string; organization?: string | null; country: string; investment_thesis: string; source_of_funds: string; agreement_accepted: boolean; review_note?: string | null };
type KycState = { status: "not_submitted" | "submitted" | "approved" | "rejected"; profile: Profile | null };

export default function KycPage() {
  const t = useTranslations("routeCopy");
  const params = useParams<{ locale: string }>();
  const { data: session } = useSession();
  const [state, setState] = useState<KycState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session?.accessToken) return;
    fetch("/api/investors/kyc", { headers: { Authorization: `Bearer ${session.accessToken}` }, cache: "no-store" })
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then(setState).catch(() => setError(true));
  }, [session?.accessToken]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!session?.accessToken) return;
    setBusy(true); setError(false);
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(["full_name", "organization", "country", "investment_thesis", "source_of_funds"].map((key) => [key, String(form.get(key) ?? "")]));
    try {
      const response = await fetch("/api/investors/kyc", { method: "PUT", headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ ...payload, organization: payload.organization || null, agreement_accepted: form.get("agreement") === "on" }) });
      if (!response.ok) throw new Error("submit");
      setState({ status: "submitted", profile: await response.json() });
    } catch { setError(true); } finally { setBusy(false); }
  }

  const profile = state?.profile;
  const statusKey = state?.status === "approved" ? "kyc_approved" : state?.status === "rejected" ? "kyc_rejected" : state?.status === "submitted" ? "kyc_submitted" : "kyc_notSubmitted";
  return <main className="mx-auto max-w-2xl space-y-6 p-6">
    <h1 className="text-2xl font-semibold">{t("investors.kycTitle")}</h1>
    <p>{t("investors.status")}: <span role="status">{state ? t(`investors.${statusKey}`) : t("investors.kyc_loading")}</span></p>
    {profile?.review_note && <p>{t("investors.kyc_reviewNote")}: {profile.review_note}</p>}
    {(state?.status === "not_submitted" || state?.status === "rejected") && <form onSubmit={submit} className="space-y-4">
      {([ ["full_name", "fullName", profile?.full_name], ["organization", "organization", profile?.organization], ["country", "country", profile?.country], ["investment_thesis", "investmentThesis", profile?.investment_thesis], ["source_of_funds", "sourceOfFunds", profile?.source_of_funds] ] as const).map(([name, label, value]) => <label key={name} className="block space-y-1"><span>{t(`investors.kyc_${label}`)}</span><textarea required={name !== "organization"} minLength={name === "investment_thesis" || name === "source_of_funds" ? 10 : undefined} maxLength={name === "investment_thesis" ? 2000 : name === "source_of_funds" ? 1000 : 200} name={name} defaultValue={value ?? ""} className="w-full rounded-md border border-border bg-background px-3 py-2 text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50" rows={name === "investment_thesis" || name === "source_of_funds" ? 3 : 1} /></label>)}
      <label className="flex items-start gap-2"><input type="checkbox" name="agreement" required className="mt-1 accent-primary" /><span>{t("investors.kyc_agreement")}</span></label>
      <button disabled={busy} className="rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary disabled:opacity-50">{busy ? t("investors.kyc_loading") : t("investors.kyc_submit")}</button>
    </form>}
    {error && <p role="alert">{t("investors.kyc_saveFailed")}</p>}
    <Link className="underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary" href={`/${params.locale}/investors`}>{t("common.back")}</Link>
  </main>;
}

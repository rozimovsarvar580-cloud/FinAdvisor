"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  formatMoneyString,
  type MarketplaceListingDetail
} from "@/lib/investor-marketplace";

const calculationKeys = [
  "monthly_revenue",
  "monthly_payroll",
  "startup_capex",
  "total_startup_cost",
  "monthly_fixed_costs",
  "monthly_variable_cost",
  "monthly_operating_profit",
  "annual_operating_profit",
  "break_even_revenue",
  "target_monthly_revenue",
  "loan_first_payment",
  "loan_total_payment",
  "loan_total_interest",
  "annual_debt_service",
  "dscr"
] as const;

type ListingDetailResponse = MarketplaceListingDetail;
type ApiError = { detail?: string };

export function InvestorMarketplaceListing({
  listingId
}: {
  listingId: string;
}) {
  const t = useTranslations("marketplace");
  const reports = useTranslations("finadvisor.reports");
  const [listing, setListing] = useState<ListingDetailResponse>();
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [contactMessage, setContactMessage] = useState("");
  const [contactState, setContactState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const { data: session } = useSession();

  useEffect(() => {
    const controller = new AbortController();

    async function loadListing() {
      setLoading(true);
      setError(false);
      try {
        const response = await fetch(
          `/api/marketplace/listings/${encodeURIComponent(listingId)}`,
          { cache: "no-store", signal: controller.signal }
        );
        const body = (await response.json()) as ListingDetailResponse | ApiError;
        if (!response.ok || !("plan" in body)) {
          throw new Error("listingUnavailable");
        }
        setListing(body);
      } catch (caught) {
        if (caught instanceof DOMException && caught.name === "AbortError") {
          return;
        }
        setError(true);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    }

    void loadListing();
    return () => controller.abort();
  }, [listingId]);

  if (loading) {
    return (
      <main className="mx-auto max-w-5xl px-page py-section" aria-live="polite">
        <Card className="p-10 text-center">{t("loading")}</Card>
      </main>
    );
  }

  if (error || !listing) {
    return (
      <main className="mx-auto max-w-5xl px-page py-section">
        <Card className="p-10 text-center">
          <h1 className="text-2xl font-semibold">{t("detail.unavailableTitle")}</h1>
          <p className="mt-3 text-muted-foreground">{t("errors.detailLoadFailed")}</p>
          <Link className="mt-6 inline-block font-medium text-primary underline" href="/investors">
            {t("detail.backToMarketplace")}
          </Link>
        </Card>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-5xl space-y-6 px-page py-section">
      <Link className="font-medium text-primary underline" href="/investors">
        {t("detail.backToMarketplace")}
      </Link>
      <Card className="p-6 sm:p-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-primary">
          {listing.city} · {t(`stages.${listing.stage}`)}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">
          {listing.business_name}
        </h1>
        <p className="mt-5 text-sm leading-6 text-muted-foreground">
          {listing.plan.summary}
        </p>
        <div className="mt-6 border-t border-border pt-5">
          <p className="text-sm text-muted-foreground">
            {t("deal.ownerFundingTarget")}
          </p>
          <p className="mt-1 text-xl font-semibold">
            {formatMoneyString(listing.funding_target)} {listing.currency}
          </p>
        </div>
      </Card>

      {session?.user.role === "investor" ? (
        <Card className="p-6 sm:p-8">
          <h2 className="text-xl font-semibold">{t("interest.title")}</h2>
          {contactState === "sent" ? <p className="mt-3 text-sm text-primary" role="status">{t("interest.sent")}</p> : (
            <form className="mt-4 grid gap-3" onSubmit={async (event) => {
              event.preventDefault(); setContactState("sending");
              try {
                const response = await fetch(`/api/marketplace/listings/${encodeURIComponent(listingId)}/contacts`, { method: "POST", headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ message: contactMessage }) });
                if (!response.ok) throw new Error("contact failed");
                setContactState("sent");
              } catch { setContactState("error"); }
            }}>
              <label className="grid gap-2 text-sm font-medium">{t("interest.message")}<textarea required maxLength={2000} value={contactMessage} onChange={(event) => setContactMessage(event.target.value)} className="min-h-24 rounded-md border border-input bg-background px-3 py-2" /></label>
              {contactState === "error" ? <p role="alert" className="text-sm text-destructive">{t("interest.error")}</p> : null}
              <button disabled={contactState === "sending"} className="w-fit rounded-md bg-primary px-4 py-2 text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 disabled:opacity-50">{t(contactState === "sending" ? "interest.sending" : "interest.submit")}</button>
            </form>
          )}
        </Card>
      ) : null}

      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{reports("calculationsTitle")}</h2>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2">
          {calculationKeys.map((key) => {
            const value = listing.plan.calculations[key];
            if (value === null || value === undefined) {
              return null;
            }
            return (
              <div className="rounded-xl bg-muted/50 p-4" key={key}>
                <dt className="text-sm text-muted-foreground">
                  {reports(`calculations.${key}`)}
                </dt>
                <dd className="mt-1 break-all font-semibold">
                  {value}
                  {key === "dscr" ? "" : ` ${reports("currency")}`}
                </dd>
              </div>
            );
          })}
        </dl>
        {listing.request_financial_fields.length > 0 ? (
          <p className="mt-5 text-sm text-muted-foreground">{t("detail.requestFields")}: {listing.request_financial_fields.map((key) => reports(`calculations.${key}`)).join(", ")}</p>
        ) : null}
      </Card>

      <Card className="p-6 sm:p-8">
        <h2 className="text-xl font-semibold">{reports("sectionsTitle")}</h2>
        <div className="mt-5 space-y-5">
          {listing.plan.sections.map((section, index) => (
            <article
              className="border-t border-border pt-5 first:border-0 first:pt-0"
              key={`${section.title}-${index}`}
            >
              <h3 className="font-semibold">{section.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
                {section.content}
              </p>
            </article>
          ))}
        </div>
      </Card>
      <p className="text-sm text-muted-foreground">{t("disclaimer")}</p>
    </main>
  );
}

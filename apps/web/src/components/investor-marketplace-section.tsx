"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Link } from "@/i18n/navigation";
import {
  filterListings,
  formatMoneyString,
  paginateListings,
  summarizeListings,
  type ListingStage,
  type MarketplaceListing
} from "@/lib/investor-marketplace";

const stages = ["all", "idea", "pilot", "scale"] as const;
const financialFields = ["monthly_revenue", "monthly_operating_profit", "total_startup_cost", "break_even_revenue", "dscr"] as const;

type ListingResponse = { items: MarketplaceListing[] };
type SavedPlan = {
  id: string;
  business_name: string;
  location: string;
  created_at: string;
};
type SavedPlanResponse = { items: SavedPlan[] };
type ApiError = { detail?: string };

export function InvestorMarketplaceSection() {
  const t = useTranslations("marketplace");
  const { data: session, status: sessionStatus } = useSession();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [myPlans, setMyPlans] = useState<SavedPlan[]>([]);
  const [stage, setStage] = useState<(typeof stages)[number]>("all");
  const [city, setCity] = useState("");
  const [minFunding, setMinFunding] = useState("");
  const [maxFunding, setMaxFunding] = useState("");
  const [page, setPage] = useState(1);
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<{ label: string; stage: string; city: string; minFunding: string; maxFunding: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const ownerToken =
    session?.user.role === "tadbirkor" ? session.accessToken : undefined;

  const loadListings = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/marketplace/listings", {
        cache: "no-store"
      });
      const body = (await response.json()) as ListingResponse | ApiError;
      if (!response.ok || !("items" in body)) {
        throw new Error("loadFailed");
      }
      setListings(body.items);

      if (ownerToken) {
        const headers = { Authorization: `Bearer ${ownerToken}` };
        const [mineResponse, plansResponse] = await Promise.all([
          fetch("/api/marketplace/listings?mine=true", {
            headers,
            cache: "no-store"
          }),
          fetch("/api/plans/mine", { headers, cache: "no-store" })
        ]);
        const [mineBody, plansBody] = (await Promise.all([
          mineResponse.json(),
          plansResponse.json()
        ])) as [(ListingResponse | ApiError), (SavedPlanResponse | ApiError)];
        if (
          !mineResponse.ok ||
          !plansResponse.ok ||
          !("items" in mineBody) ||
          !("items" in plansBody)
        ) {
          throw new Error("loadFailed");
        }
        setMyListings(mineBody.items);
        setMyPlans(plansBody.items);
      } else {
        setMyListings([]);
        setMyPlans([]);
      }
    } catch {
      setError(t("errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [ownerToken, t]);

  useEffect(() => {
    void loadListings();
  }, [loadListings]);

  useEffect(() => {
    try { setSavedIds(JSON.parse(localStorage.getItem("finadvisor:saved-listings") ?? "[]")); } catch { setSavedIds([]); }
    try { setSavedSearches(JSON.parse(localStorage.getItem("finadvisor:saved-searches") ?? "[]")); } catch { setSavedSearches([]); }
  }, []);

  const visibleListings = useMemo(
    () =>
      filterListings(listings, { stage, city, minFunding, maxFunding }),
    [listings, stage, city, minFunding, maxFunding]
  );
  const paginated = paginateListings(visibleListings, page, 10);
  const summary = summarizeListings(visibleListings);

  async function publishListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ownerToken) {
      setError(t("errors.signInRequired"));
      return;
    }
    setSubmitting(true);
    setError(null);
    setNotice(null);
    const form = event.currentTarget;
    const formData = new FormData(form);
    const payload = {
      plan_id: String(formData.get("planId") ?? ""),
      stage: String(formData.get("stage") ?? "idea"),
      funding_target: String(formData.get("fundingTarget") ?? "").replace(",", "."),
      summary: String(formData.get("summary") ?? ""),
      status: String(formData.get("status") ?? "draft"),
      public_financial_fields: financialFields.filter((field) => formData.getAll("publicFinancialFields").includes(field)),
      request_financial_fields: financialFields.filter((field) => formData.getAll("requestFinancialFields").includes(field))
    };

    try {
      const response = await fetch("/api/marketplace/listings", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${ownerToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        throw new Error(response.status === 422 ? "invalidListing" : "publishFailed");
      }
      form.reset();
      await loadListings();
      setNotice(t("form.published"));
    } catch (caught) {
      const errorKey =
        caught instanceof Error && caught.message === "invalidListing"
          ? "invalidListing"
          : "publishFailed";
      setError(t(`errors.${errorKey}`));
    } finally {
      setSubmitting(false);
    }
  }

  async function setVisibility(listing: MarketplaceListing, status: MarketplaceListing["status"]) {
    if (!ownerToken) {
      setError(t("errors.signInRequired"));
      return;
    }
    setError(null);
    setNotice(null);
    try {
      const response = await fetch(
        `/api/marketplace/listings/${encodeURIComponent(listing.id)}/visibility`,
        {
          method: "PATCH",
          headers: {
            Authorization: `Bearer ${ownerToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ status })
        }
      );
      if (!response.ok) {
        throw new Error("visibilityFailed");
      }
      await loadListings();
      setNotice(t(status === "published" ? "form.published" : status === "archived" ? "form.archived" : "form.draft"));
    } catch {
      setError(t("errors.visibilityFailed"));
    }
  }

  return (
    <section className="py-section" id="investors">
      <div className="mx-auto max-w-7xl px-page">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.18em] text-primary">
            {t("hero.eyebrow")}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight sm:text-4xl">
            {t("hero.title")}
          </h2>
          <p className="mt-4 text-base leading-7 text-muted-foreground">
            {t("hero.description")}
          </p>
        </div>

        <Card className="mt-8 p-5">
          <p className="text-sm text-muted-foreground">{t("stats.listings")}</p>
          <p className="mt-2 text-3xl font-semibold">{summary.totalListings}</p>
        </Card>

        {error ? (
          <p className="mt-5 rounded-lg border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}
        {notice ? (
          <p className="mt-5 rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm" role="status">
            {notice}
          </p>
        ) : null}

        <Card className="mt-8 p-6">
          <h3 className="text-xl font-semibold">{t("filters.title")}</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <input aria-label={t("filters.city")} className="h-10 rounded-md border border-input bg-background px-3" placeholder={t("filters.city")} value={city} onChange={(event) => { setCity(event.target.value); setPage(1); }} />
            <input aria-label={t("filters.minimumFunding")} className="h-10 rounded-md border border-input bg-background px-3" inputMode="numeric" placeholder={t("filters.minimumFunding")} value={minFunding} onChange={(event) => { setMinFunding(event.target.value.replace(/[^0-9]/g, "")); setPage(1); }} />
            <input aria-label={t("filters.maximumFunding")} className="h-10 rounded-md border border-input bg-background px-3" inputMode="numeric" placeholder={t("filters.maximumFunding")} value={maxFunding} onChange={(event) => { setMaxFunding(event.target.value.replace(/[^0-9]/g, "")); setPage(1); }} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {stages.map((option) => (
              <Button
                key={option}
                onClick={() => { setStage(option); setPage(1); }}
                size="sm"
                variant={stage === option ? "default" : "outline"}
              >
                {t(`stages.${option}`)}
              </Button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => { const entry = { label: [city, stage, minFunding, maxFunding].filter(Boolean).join(" · ") || t("filters.title"), stage, city, minFunding, maxFunding }; const next = [...savedSearches.filter((item) => item.label !== entry.label), entry]; setSavedSearches(next); localStorage.setItem("finadvisor:saved-searches", JSON.stringify(next)); }}>{t("saved.saveSearch")}</Button>
            {savedSearches.map((item) => <Button key={item.label} size="sm" variant="outline" onClick={() => { setStage(item.stage as typeof stage); setCity(item.city); setMinFunding(item.minFunding); setMaxFunding(item.maxFunding); setPage(1); }}>{item.label}</Button>)}
          </div>
        </Card>

        {ownerToken ? (
          <Card className="mt-8 p-6">
            <h3 className="text-xl font-semibold">{t("form.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("form.disclaimer")}
            </p>
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={publishListing}>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                {t("form.savedPlan")}
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 font-normal"
                  defaultValue=""
                  name="planId"
                  required
                >
                  <option disabled value="">
                    {t("form.selectSavedPlan")}
                  </option>
                  {myPlans.map((plan) => (
                    <option key={plan.id} value={plan.id}>
                      {plan.business_name} — {plan.location}
                    </option>
                  ))}
                </select>
                {myPlans.length === 0 ? (
                  <span className="font-normal text-muted-foreground">
                    {t("form.noSavedPlans")}
                  </span>
                ) : null}
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {t("form.status")}
                <select className="h-11 rounded-md border border-input bg-background px-3 font-normal" name="status" defaultValue="draft">
                  {(["draft", "published", "archived"] as const).map((value) => <option key={value} value={value}>{t(`form.statuses.${value}`)}</option>)}
                </select>
              </label>
              <fieldset className="grid gap-2 text-sm md:col-span-2">
                <legend className="font-medium">{t("form.financialVisibility")}</legend>
                {financialFields.map((field) => <div className="flex flex-wrap gap-5" key={field}>
                  <span className="min-w-48">{t(`form.financialFields.${field}`)}</span>
                  <label className="flex items-center gap-2"><input type="checkbox" name="publicFinancialFields" value={field} />{t("form.public")}</label>
                  <label className="flex items-center gap-2"><input type="checkbox" name="requestFinancialFields" value={field} />{t("form.byRequest")}</label>
                </div>)}
              </fieldset>
              <label className="grid gap-2 text-sm font-medium">
                {t("form.stage")}
                <select
                  className="h-11 rounded-md border border-input bg-background px-3 font-normal"
                  defaultValue="idea"
                  name="stage"
                >
                  {(["idea", "pilot", "scale"] as const).map((item) => (
                    <option key={item} value={item}>
                      {t(`stages.${item}`)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {t("form.fundingTarget")}
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 font-normal"
                  inputMode="decimal"
                  name="fundingTarget"
                  pattern="[0-9]+([.,][0-9]{1,2})?"
                  placeholder={t("amountPlaceholder")}
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium md:col-span-2">
                {t("form.summary")}
                <textarea
                  className="min-h-24 rounded-md border border-input bg-background px-3 py-2 font-normal"
                  maxLength={2000}
                  name="summary"
                  required
                />
              </label>
              <div className="md:col-span-2">
                <Button disabled={submitting || myPlans.length === 0} type="submit">
                  {t(submitting ? "form.publishing" : "form.publish")}
                </Button>
              </div>
            </form>
          </Card>
        ) : sessionStatus === "authenticated" ? null : (
          <p className="mt-8 text-sm text-muted-foreground">
            {t("form.ownerPrompt")}{" "}
            <Link className="font-medium text-primary underline" href="/signup">
              {t("form.signUp")}
            </Link>
          </p>
        )}

        {ownerToken ? (
          <div className="mt-10">
            <h3 className="mb-4 text-xl font-semibold">{t("form.myListings")}</h3>
            <div className="grid gap-4">
              {loading ? (
                <div aria-label={t("loading")} aria-busy="true" role="status">
                  <Skeleton className="h-24 motion-reduce:animate-none" />
                </div>
              ) : myListings.length > 0 ? (
                myListings.map((listing) => (
                  <Card className="flex flex-wrap items-center justify-between gap-4 p-5" key={listing.id}>
                    <div>
                      <p className="font-semibold">{listing.business_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {t(`form.statuses.${listing.status}`)}
                      </p>
                    </div>
                    <Button
                      onClick={() => void setVisibility(listing, listing.status === "published" ? "draft" : "published")}
                      size="sm"
                      variant="outline"
                    >
                      {t(listing.status === "published" ? "form.unpublish" : "form.republish")}
                    </Button>
                    {listing.status !== "archived" ? <Button onClick={() => void setVisibility(listing, "archived")} size="sm" variant="outline">{t("form.archive")}</Button> : null}
                  </Card>
                ))
              ) : !error ? (
                <EmptyState
                  description={t("myListingsEmpty.description")}
                  title={t("myListingsEmpty.title")}
                />
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {loading ? (
            <div className="col-span-full" aria-label={t("loading")} aria-busy="true" role="status">
              <div className="grid gap-5 lg:grid-cols-2">
                {Array.from({ length: 2 }, (_, index) => (
                  <Card className="space-y-4 p-6" key={index}>
                    <Skeleton className="h-6 w-2/3 motion-reduce:animate-none" />
                    <Skeleton className="h-4 w-full motion-reduce:animate-none" />
                    <Skeleton className="h-4 w-4/5 motion-reduce:animate-none" />
                  </Card>
                ))}
              </div>
            </div>
          ) : visibleListings.length > 0 ? (
              paginated.items.map((listing) => (
              <Card className="p-6" key={listing.id}>
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-primary">
                      {listing.city}
                    </p>
                    <h3 className="mt-2 text-2xl font-semibold">
                      {listing.business_name}
                    </h3>
                  </div>
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    {t(`stages.${listing.stage}`)}
                  </span>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  {listing.summary}
                </p>
                <div className="mt-5 border-t border-border pt-4">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t("deal.ownerFundingTarget")}
                  </p>
                  <p className="mt-1 font-semibold">
                    {formatMoneyString(listing.funding_target)} {listing.currency}
                  </p>
                </div>
                <div className="mt-5">
                  <Button className="mr-2" onClick={() => { const next = savedIds.includes(listing.id) ? savedIds.filter((id) => id !== listing.id) : [...savedIds, listing.id]; setSavedIds(next); localStorage.setItem("finadvisor:saved-listings", JSON.stringify(next)); }} size="sm" variant="outline">{t(savedIds.includes(listing.id) ? "saved.remove" : "saved.save")}</Button>
                  <Button asChild variant="outline">
                    <Link href={`/investors/${encodeURIComponent(listing.id)}`}>
                      {t("deal.viewPlan")}
                    </Link>
                  </Button>
                </div>
              </Card>
            ))
          ) : !error ? (
            <EmptyState
              className="col-span-full"
              description={t(listings.length > 0 ? "empty.filteredDescription" : "empty.description")}
              title={t(listings.length > 0 ? "empty.filteredTitle" : "empty.title")}
            />
          ) : null}
        </div>
        {paginated.totalPages > 1 ? <nav aria-label={t("filters.pagination")} className="mt-6 flex items-center justify-center gap-3"><Button disabled={page <= 1} onClick={() => setPage(page - 1)} variant="outline">{t("filters.previous")}</Button><span>{page} / {paginated.totalPages}</span><Button disabled={page >= paginated.totalPages} onClick={() => setPage(page + 1)} variant="outline">{t("filters.next")}</Button></nav> : null}
        <p className="mt-6 text-sm text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </section>
  );
}

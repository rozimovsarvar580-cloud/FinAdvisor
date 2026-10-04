"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import {
  filterListings,
  formatMoneyString,
  summarizeListings,
  type ListingStage,
  type MarketplaceListing
} from "@/lib/investor-marketplace";

const stages = ["all", "idea", "pilot", "scale"] as const;

type ListingResponse = { items: MarketplaceListing[] };
type ApiError = { detail?: string };

export function InvestorMarketplaceSection() {
  const t = useTranslations("marketplace");
  const { data: session, status: sessionStatus } = useSession();
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [myListings, setMyListings] = useState<MarketplaceListing[]>([]);
  const [stage, setStage] = useState<(typeof stages)[number]>("all");
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
        const mineResponse = await fetch("/api/marketplace/listings?mine=true", {
          headers: { Authorization: `Bearer ${ownerToken}` },
          cache: "no-store"
        });
        const mineBody = (await mineResponse.json()) as ListingResponse | ApiError;
        if (!mineResponse.ok || !("items" in mineBody)) {
          throw new Error("loadFailed");
        }
        setMyListings(mineBody.items);
      } else {
        setMyListings([]);
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

  const visibleListings = useMemo(
    () =>
      filterListings(listings, {
        stage: stage === "all" ? "all" : stage
      }),
    [listings, stage]
  );
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
      business_name: String(formData.get("businessName") ?? ""),
      city: String(formData.get("city") ?? ""),
      stage: String(formData.get("stage") ?? "idea"),
      funding_target: String(formData.get("fundingTarget") ?? "").replace(",", "."),
      summary: String(formData.get("summary") ?? "")
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

  async function setVisibility(listing: MarketplaceListing, isPublished: boolean) {
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
          body: JSON.stringify({ is_published: isPublished })
        }
      );
      if (!response.ok) {
        throw new Error("visibilityFailed");
      }
      await loadListings();
      setNotice(t(isPublished ? "form.published" : "form.unpublished"));
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
          <div className="mt-4 flex flex-wrap gap-2">
            {stages.map((option) => (
              <Button
                key={option}
                onClick={() => setStage(option)}
                size="sm"
                variant={stage === option ? "default" : "outline"}
              >
                {t(`stages.${option}`)}
              </Button>
            ))}
          </div>
        </Card>

        {ownerToken ? (
          <Card className="mt-8 p-6">
            <h3 className="text-xl font-semibold">{t("form.title")}</h3>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("form.disclaimer")}
            </p>
            <form className="mt-5 grid gap-4 md:grid-cols-2" onSubmit={publishListing}>
              <label className="grid gap-2 text-sm font-medium">
                {t("form.businessName")}
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 font-normal"
                  maxLength={200}
                  name="businessName"
                  required
                />
              </label>
              <label className="grid gap-2 text-sm font-medium">
                {t("form.city")}
                <input
                  className="h-11 rounded-md border border-input bg-background px-3 font-normal"
                  maxLength={120}
                  name="city"
                  required
                />
              </label>
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
                  placeholder="250000000"
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
                <Button disabled={submitting} type="submit">
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
              {myListings.map((listing) => (
                <Card className="flex flex-wrap items-center justify-between gap-4 p-5" key={listing.id}>
                  <div>
                    <p className="font-semibold">{listing.business_name}</p>
                    <p className="text-sm text-muted-foreground">
                      {t(`form.visibility.${listing.is_published ? "published" : "unpublished"}`)}
                    </p>
                  </div>
                  <Button
                    onClick={() => void setVisibility(listing, !listing.is_published)}
                    size="sm"
                    variant="outline"
                  >
                    {t(listing.is_published ? "form.unpublish" : "form.republish")}
                  </Button>
                </Card>
              ))}
            </div>
          </div>
        ) : null}

        <div className="mt-10 grid gap-5 lg:grid-cols-2">
          {loading ? (
            <Card className="col-span-full p-10 text-center" aria-live="polite">
              {t("loading")}
            </Card>
          ) : visibleListings.length > 0 ? (
            visibleListings.map((listing) => (
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
              </Card>
            ))
          ) : (
            <Card className="col-span-full p-10 text-center">
              <h3 className="text-xl font-semibold">{t("empty.title")}</h3>
              <p className="mt-3 text-muted-foreground">{t("empty.description")}</p>
            </Card>
          )}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">{t("disclaimer")}</p>
      </div>
    </section>
  );
}

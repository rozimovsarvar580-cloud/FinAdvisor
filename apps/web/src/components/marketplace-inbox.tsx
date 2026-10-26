"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { useTranslations } from "next-intl";
import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";

type Listing = { id: string; business_name: string };
type Interest = { id: string; listing_id?: string; investor_id: string; status: string; message: string; created_at: string };

export function MarketplaceInbox() {
  const t = useTranslations("marketplace.inbox");
  const { data: session } = useSession();
  const [items, setItems] = useState<Array<Interest & { business_name: string }>>([]);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!session?.accessToken || session.user.role !== "tadbirkor") return;
    const headers = { Authorization: `Bearer ${session.accessToken}` };
    void (async () => {
      try {
        const response = await fetch("/api/marketplace/listings?mine=true", { headers, cache: "no-store" });
        if (!response.ok) throw new Error();
        const listings = (await response.json() as { items: Listing[] }).items;
        const requests = await Promise.all(listings.map(async (listing) => {
          const result = await fetch(`/api/marketplace/listings/${encodeURIComponent(listing.id)}/contacts`, { headers, cache: "no-store" });
          if (!result.ok) throw new Error();
          const contacts = (await result.json() as { items: Interest[] }).items;
          return contacts.map((contact) => ({ ...contact, listing_id: listing.id, business_name: listing.business_name }));
        }));
        setItems(requests.flat());
      } catch { setError(true); }
    })();
  }, [session]);

  async function decide(contactId: string, status: "accepted" | "declined") {
    if (!session?.accessToken) return;
    const response = await fetch(`/api/marketplace/listings/contacts/${encodeURIComponent(contactId)}`, { method: "PATCH", headers: { Authorization: `Bearer ${session.accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify({ status }) });
    if (response.ok) setItems((current) => current.map((item) => item.id === contactId ? { ...item, status } : item));
    else setError(true);
  }

  return <main className="mx-auto max-w-5xl space-y-5 px-page py-section">
    <Link className="text-primary underline" href="/investors">{t("back")}</Link>
    <h1 className="text-3xl font-semibold">{t("title")}</h1>
    {error ? <p role="alert" className="text-destructive">{t("error")}</p> : null}
    {items.length ? items.map((item) => <Card key={item.id} className="space-y-3 p-5">
      <h2 className="font-semibold">{item.business_name}</h2><p className="text-sm text-muted-foreground">{t("investor")}: {item.investor_id}</p><p>{item.message}</p><p className="text-sm">{t(`status.${item.status}`)}</p>
      {item.status === "pending" ? <div className="flex gap-2"><button className="rounded-md bg-primary px-3 py-2 text-primary-foreground focus-visible:outline focus-visible:outline-2" onClick={() => void decide(item.id, "accepted")}>{t("accept")}</button><button className="rounded-md border border-border px-3 py-2 hover:bg-muted focus-visible:outline focus-visible:outline-2" onClick={() => void decide(item.id, "declined")}>{t("decline")}</button></div> : null}
    </Card>) : !error ? <Card className="p-6 text-muted-foreground">{t("empty")}</Card> : null}
  </main>;
}

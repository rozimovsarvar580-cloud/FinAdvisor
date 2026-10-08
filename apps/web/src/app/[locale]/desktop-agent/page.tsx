"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  detectDesktopPlatform,
  getDesktopDownloadLinks,
  type DesktopDownload
} from "@/lib/desktop-agent";

function DownloadButton({ item }: { item: DesktopDownload }) {
  return (
    <a href={item.url} rel="noreferrer" target="_blank">
      <Button className="w-full justify-center" variant={item.platform === "macos" ? "secondary" : "default"}>
        {item.label}
      </Button>
    </a>
  );
}

export default function DesktopAgentPage() {
  const t = useTranslations("desktopAgent");
  const platform = useMemo(() => detectDesktopPlatform(), []);
  const downloads = useMemo(() => getDesktopDownloadLinks(platform), [platform]);
  const preferred = downloads[0];

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 py-12">
      <div className="space-y-4 text-center">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-primary">{t("eyebrow")}</p>
        <h1 className="text-4xl font-semibold tracking-tight">{t("title")}</h1>
        <p className="mx-auto max-w-2xl text-base text-muted-foreground">{t("description")}</p>
      </div>

      <Card className="p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.18em] text-muted-foreground">{t("downloadFor")}</p>
            <h2 className="mt-2 text-2xl font-semibold">{t("recommended", { platform: preferred.label })}</h2>
          </div>
          <div className="rounded-full border border-border bg-muted px-3 py-1 text-sm text-muted-foreground">
            {t("detected", { platform: platform.toUpperCase() })}
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {downloads.map((download) => (
            <DownloadButton key={`${download.platform}-${download.fileName}`} item={download} />
          ))}
        </div>
      </Card>
    </section>
  );
}

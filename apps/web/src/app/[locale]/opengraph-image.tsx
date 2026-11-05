import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import { siteConfig } from "@/lib/site-metadata";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

<<<<<<< HEAD
// ImageResponse cannot access CSS variables; keep this aligned with --gradient-brand.
const brandGradient =
  "linear-gradient(135deg, hsl(243 75% 59%), hsl(262 83% 58%) 55%, hsl(333 82% 61%))";

export default async function OpenGraphImage({
=======
const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function OpenGraphImage({
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
  params
}: {
  params: { locale: string };
}) {
<<<<<<< HEAD
  const t = await getTranslations({
    locale: params.locale,
    namespace: "home.socialImage"
  });
=======
  if (!locales.includes(params.locale as (typeof locales)[number])) {
    throw new Error("Unsupported locale for Open Graph image");
  }
  const copy = messages[params.locale as keyof typeof messages];
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "48px 64px",
<<<<<<< HEAD
          background: brandGradient,
=======
          background:
            "linear-gradient(135deg, hsl(243 75% 59%), hsl(262 83% 58%) 55%, hsl(333 82% 61%))",
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
          color: "white",
          fontFamily: "sans-serif"
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            width: "100%",
            height: "100%"
          }}
        >
<<<<<<< HEAD
          <div style={{ fontSize: 32, letterSpacing: 6, opacity: 0.8 }}>FinAdvisor</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
              {t("title")}
=======
          <div style={{ fontSize: 32, letterSpacing: 6, opacity: 0.8 }}>
            {siteConfig.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
              {copy.landing.hero.title}
            </div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>
              {copy.home.tagline}
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
            </div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>{t("audience")}</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}

import { ImageResponse } from "next/og";

import en from "@/messages/en.json";
import ru from "@/messages/ru.json";
import uz from "@/messages/uz.json";
import { siteConfig } from "@/lib/site-metadata";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const locales = ["uz", "ru", "en"] as const;
const messages = { uz, ru, en } as const;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

export default function OpenGraphImage({
  params
}: {
  params: { locale: string };
}) {
  if (!locales.includes(params.locale as (typeof locales)[number])) {
    throw new Error("Unsupported locale for Open Graph image");
  }
  const copy = messages[params.locale as keyof typeof messages];

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "48px 64px",
          background:
            "linear-gradient(135deg, hsl(243 75% 59%), hsl(262 83% 58%) 55%, hsl(333 82% 61%))",
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
          <div style={{ fontSize: 32, letterSpacing: 6, opacity: 0.8 }}>
            {siteConfig.name}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
              {copy.landing.hero.title}
            </div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>
              {copy.home.tagline}
            </div>
          </div>
        </div>
      </div>
    ),
    size
  );
}

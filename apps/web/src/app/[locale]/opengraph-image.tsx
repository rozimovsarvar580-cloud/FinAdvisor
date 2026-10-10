import { ImageResponse } from "next/og";
import { getTranslations } from "next-intl/server";

export const runtime = "edge";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// ImageResponse cannot access CSS variables; keep this aligned with --gradient-brand.
const brandGradient =
  "linear-gradient(135deg, hsl(243 75% 59%), hsl(262 83% 58%) 55%, hsl(333 82% 61%))";

export default async function OpenGraphImage({
  params
}: {
  params: { locale: string };
}) {
  const t = await getTranslations({
    locale: params.locale,
    namespace: "home.socialImage"
  });

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: "100%",
          height: "100%",
          padding: "48px 64px",
          background: brandGradient,
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
          <div style={{ fontSize: 32, letterSpacing: 6, opacity: 0.8 }}>FinAdvisor</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            <div style={{ fontSize: 76, fontWeight: 700, lineHeight: 1.1 }}>
              {t("title")}
            </div>
            <div style={{ fontSize: 28, opacity: 0.9 }}>{t("audience")}</div>
          </div>
        </div>
      </div>
    ),
    size
  );
}

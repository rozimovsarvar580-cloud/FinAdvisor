import type { ReactNode } from "react";
import "../globals.css";

export default function LocaleLayout({
  children,
  params
}: {
  children: ReactNode;
  params: { locale: string };
}) {
  return (
    <html lang={params.locale}>
      <body>{children}</body>
    </html>
  );
}

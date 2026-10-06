import type { ReactNode } from "react";

import "./globals.css";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

export const metadata = {
  title: "FinAdvisor",
  description: "Moliyaviy reja tuzish platformasi",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="uz">
      <body>
        <SiteHeader />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

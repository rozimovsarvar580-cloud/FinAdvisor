import type { MetadataRoute } from "next";

import { siteConfig } from "@/lib/site-metadata";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/_next/", "/private/"]
    },
    sitemap: `${siteConfig.baseUrl}/sitemap.xml`,
    host: siteConfig.baseUrl
  };
}

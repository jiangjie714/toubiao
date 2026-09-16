import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/mailer";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        allow: [
          "/",
          "/list",
          "/tender/",
          "/regions/",
          "/industries/",
          "/history",
          "/compliance",
          "/pricing",
          "/terms",
          "/privacy",
        ],
        disallow: [
          "/admin/",
          "/api/",
          "/pay/",
          "/contract/",
          "/proposals",
          "/tracker",
          "/audit",
          "/cases",
          "/qualifications",
          "/deposits",
          "/watches",
          "/webhooks",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

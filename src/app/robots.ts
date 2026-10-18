import type { MetadataRoute } from "next";
import { getAppUrl } from "@/lib/mailer";

export default function robots(): MetadataRoute.Robots {
  const baseUrl = getAppUrl();

  return {
    rules: [
      {
        userAgent: "*",
        // 仅放行无需登录的公开落地页；站内业务页均要求登录，统一 disallow 以免爬虫撞击登录跳转
        allow: ["/", "/gonggao", "/gonggao/", "/terms", "/privacy", "/login", "/register"],
        disallow: [
          "/admin/",
          "/api/",
          "/pay/",
          "/contract/",
          "/list",
          "/tender/",
          "/regions/",
          "/industries/",
          "/history",
          "/compliance",
          "/pricing",
          "/proposals",
          "/tracker",
          "/audit",
          "/cases",
          "/qualifications",
          "/deposits",
          "/watches",
          "/webhooks",
          "/exports",
          "/suppliers",
          "/purchasers",
          "/projects",
          "/intentions",
          "/competitors",
          "/pipeline",
          "/calendar",
          "/reviews",
          "/analytics",
          "/brief",
          "/invoices",
          "/team",
          "/developer",
          "/tenders/",
        ],
      },
    ],
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}

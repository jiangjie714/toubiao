import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getMarketIntelligenceAction } from "@/app/actions/analytics";
import AnalyticsDashboard from "@/components/analytics-dashboard";

export const metadata = {
  title: "行业标讯情报大盘 - 标讯通",
  description: "全网招投标大数据情报、买方金主画像、竞争对手中标网络与超级标王商机透视",
};

export default async function AnalyticsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/analytics");
  }

  const [intelResult, provinces] = await Promise.all([
    getMarketIntelligenceAction({ days: 30 }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  if (!intelResult.success || !intelResult.data) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
        {intelResult.error || "无法加载大盘数据，请稍后刷新重试"}
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <AnalyticsDashboard
        initialData={intelResult.data}
        provinces={provinces}
      />
    </div>
  );
}

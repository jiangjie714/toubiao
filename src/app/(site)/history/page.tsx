import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getHistoricalBenchmarkData } from "@/lib/historical-analytics";
import HistoricalExplorerView from "@/components/historical-explorer-view";

export const metadata: Metadata = {
  title: "历史标讯大数据穿透库与价格下浮罗盘 - 标讯通",
  description: "对标千里马历史数据库，深度穿透历年中标案例、测算行业让利下浮率分布，量化分析发包单位供应商集中度 (CR3/CR5) 垄断指数。",
};

export default async function HistoryPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?from=/history");
  }

  const initialData = await getHistoricalBenchmarkData({});

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <HistoricalExplorerView
        initialData={initialData}
        initialFilters={{}}
      />
    </div>
  );
}

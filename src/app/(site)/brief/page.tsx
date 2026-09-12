import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getWeeklyBriefAction } from "@/app/actions/analytics";
import WeeklyBriefView from "@/components/weekly-brief-view";

export const metadata = {
  title: "标讯商机决策周报 - 标讯通",
  description: "企业招投标高价值商机周报、高额标王聚焦、临期截标预警与同业竞争情报",
};

export default async function WeeklyBriefPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/brief");
  }

  const result = await getWeeklyBriefAction();

  if (!result.success || !result.data) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          {result.error || "无法生成周报，请稍后刷新重试"}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <WeeklyBriefView brief={result.data} userName={user.name || user.username} />
    </div>
  );
}

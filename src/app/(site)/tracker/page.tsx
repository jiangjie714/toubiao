import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTrackerBoardAction } from "@/app/actions/tender-follow";
import TrackerKanbanView from "@/components/tracker-kanban-view";

export const metadata = {
  title: "投标商机协同推进看板 - 标讯通",
  description: "企业团队共享商机看板、线索评估、5大泳道进度管理、团队成员指派与协同风险批注",
};

export default async function TrackerKanbanPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/tracker");
  }

  const res = await getTrackerBoardAction();
  if (!res.success || !res.data) {
    return (
      <div className="p-12 text-center text-sm text-slate-500">
        加载跟进看板失败，请刷新重试。
      </div>
    );
  }

  return <TrackerKanbanView initialData={res.data} />;
}

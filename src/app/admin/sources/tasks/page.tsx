import { getTasksOverview } from "@/lib/crawler/task-manager";
import TasksManagerView from "@/components/admin/tasks-manager-view";

export const metadata = {
  title: "采集任务池与异步队列监控 - 管理后台",
  description: "分布式抓取队列监控、并发执行节点、指数退避重试与到期源调度",
};

export const dynamic = "force-dynamic";

export default async function AdminSourceTasksPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; page?: string }>;
}) {
  const { status = "all", page = "1" } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  const data = await getTasksOverview({
    status: status === "all" ? undefined : status,
    page: pageNum,
  });

  return <TasksManagerView data={data} currentStatus={status} />;
}

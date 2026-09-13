"use server";

import { revalidatePath } from "next/cache";
import { getSession } from "@/lib/auth";
import {
  probeSourceHealth,
  probeAllSources,
  debugCrawlSource,
  type ProbeResult,
  type DebugCrawlResult,
} from "@/lib/crawler/prober";

async function requireAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("需要管理员权限");
  }
}

export async function probeSingleSourceAction(
  skillCode: string,
): Promise<{ success: boolean; result?: ProbeResult; error?: string }> {
  try {
    await requireAdmin();
    const result = await probeSourceHealth(skillCode);
    revalidatePath("/admin/sources");
    return { success: true, result };
  } catch (error) {
    console.error("probeSingleSourceAction error:", error);
    return { success: false, error: "拨测失败" };
  }
}

export async function probeAllSourcesAction(): Promise<{
  success: boolean;
  data?: {
    total: number;
    healthy: number;
    warning: number;
    error: number;
    avgDurationMs: number;
    results: ProbeResult[];
  };
  error?: string;
}> {
  try {
    await requireAdmin();
    const data = await probeAllSources();
    revalidatePath("/admin/sources");
    return { success: true, data };
  } catch (error) {
    console.error("probeAllSourcesAction error:", error);
    return { success: false, error: "批量拨测失败" };
  }
}

export async function debugCrawlAction(
  skillCode: string,
): Promise<DebugCrawlResult> {
  await requireAdmin();
  return await debugCrawlSource(skillCode);
}

/* ---------------- 技能包版本管理与沙盒 ---------------- */

export async function publishRevisionAction(
  formData: FormData
): Promise<{ success: boolean; newVersion?: number; error?: string }> {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return { success: false, error: "需要管理员权限" };

  const sourceId = Number(formData.get("sourceId"));
  const configYaml = String(formData.get("configYaml") ?? "");
  const note = String(formData.get("note") ?? "");

  if (!sourceId || !configYaml.trim()) {
    return { success: false, error: "配置内容不能为空" };
  }

  const { publishNewRevision } = await import("@/lib/crawler/revisions");
  const res = await publishNewRevision(sourceId, configYaml, note, user.name || user.username);
  revalidatePath(`/admin/sources/${sourceId}/revisions`);
  revalidatePath("/admin/sources");
  return res;
}

export async function rollbackRevisionAction(
  formData: FormData
): Promise<{ success: boolean; error?: string }> {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return { success: false, error: "需要管理员权限" };

  const sourceId = Number(formData.get("sourceId"));
  const targetVersion = Number(formData.get("targetVersion"));

  if (!sourceId || !targetVersion) {
    return { success: false, error: "参数不合法" };
  }

  const { rollbackToRevision } = await import("@/lib/crawler/revisions");
  const res = await rollbackToRevision(sourceId, targetVersion, user.name || user.username);
  revalidatePath(`/admin/sources/${sourceId}/revisions`);
  revalidatePath("/admin/sources");
  return res;
}

export async function dryRunTestYamlAction(
  skillCode: string,
  testYaml?: string
) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") return { success: false, error: "需要管理员权限", itemCount: 0, httpOk: 0, avgLatencyMs: 0, items: [] };

  const { testDryRunYaml } = await import("@/lib/crawler/revisions");
  return await testDryRunYaml(skillCode, testYaml);
}

/* ---------------- 告警规则配置与管理 ---------------- */

export async function createAlertRuleAction(formData: FormData) {
  try {
    await requireAdmin();
    const scope = String(formData.get("scope") || "global");
    const condition = String(formData.get("condition") || "health_below");
    const threshold = Number(formData.get("threshold") || 70);
    const channel = String(formData.get("channel") || "wecom_webhook");
    const target = String(formData.get("target") || "").trim();
    const cooldownMinutes = Number(formData.get("cooldownMinutes") || 60);

    const { createAlertRule } = await import("@/lib/crawler/alerts-manager");
    const res = await createAlertRule({
      scope,
      condition,
      threshold,
      channel,
      target,
      cooldownMinutes,
    });
    revalidatePath("/admin/sources/alerts");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "创建规则失败" };
  }
}

export async function toggleAlertRuleAction(id: number) {
  try {
    await requireAdmin();
    const { toggleAlertRule } = await import("@/lib/crawler/alerts-manager");
    const res = await toggleAlertRule(id);
    revalidatePath("/admin/sources/alerts");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "状态切换失败" };
  }
}

export async function deleteAlertRuleAction(id: number) {
  try {
    await requireAdmin();
    const { deleteAlertRule } = await import("@/lib/crawler/alerts-manager");
    const res = await deleteAlertRule(id);
    revalidatePath("/admin/sources/alerts");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "删除失败" };
  }
}

export async function testAlertChannelAction(channel: string, target: string) {
  try {
    await requireAdmin();
    const { testAlertChannel } = await import("@/lib/crawler/alerts-manager");
    return await testAlertChannel(channel, target);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "测试触发失败" };
  }
}

/* ---------------- 任务队列与调度管理 ---------------- */

export async function dispatchSourceTaskAction(formData: FormData) {
  try {
    await requireAdmin();
    const skillCode = String(formData.get("skillCode") || "").trim();
    const maxPages = Number(formData.get("maxPages") || 1);
    const trigger = String(formData.get("trigger") || "manual");

    if (!skillCode) {
      return { success: false, error: "请选择有效的数据源" };
    }

    const { dispatchSourceTask } = await import("@/lib/crawler/task-manager");
    const res = await dispatchSourceTask({ skillCode, maxPages, trigger });
    revalidatePath("/admin/sources/tasks");
    revalidatePath("/admin/sources");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "任务派发失败" };
  }
}

export async function retryCrawlTaskAction(taskId: number) {
  try {
    await requireAdmin();
    const { retryCrawlTask } = await import("@/lib/crawler/task-manager");
    const res = await retryCrawlTask(taskId);
    revalidatePath("/admin/sources/tasks");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "重试失败" };
  }
}

export async function cancelCrawlTaskAction(taskId: number) {
  try {
    await requireAdmin();
    const { cancelCrawlTask } = await import("@/lib/crawler/task-manager");
    const res = await cancelCrawlTask(taskId);
    revalidatePath("/admin/sources/tasks");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "取消失败" };
  }
}

export async function clearCompletedTasksAction(statusToClear: "done" | "all_finished" = "all_finished") {
  try {
    await requireAdmin();
    const { clearCompletedTasks } = await import("@/lib/crawler/task-manager");
    const res = await clearCompletedTasks(statusToClear);
    revalidatePath("/admin/sources/tasks");
    return res;
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "清理失败" };
  }
}

export async function triggerSchedulerNowAction() {
  try {
    await requireAdmin();
    const { triggerSchedulerNow } = await import("@/lib/crawler/task-manager");
    const res = await triggerSchedulerNow();
    revalidatePath("/admin/sources/tasks");
    revalidatePath("/admin/sources");
    return res;
  } catch (err) {
    return { success: false, enqueuedCount: 0, error: err instanceof Error ? err.message : "触发调度失败" };
  }
}




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

"use server";

import { getSession } from "@/lib/auth";
import {
  getHistoricalBenchmarkData,
  HistoricalQueryFilters,
  HistoricalBenchmarkResult,
} from "@/lib/historical-analytics";

export interface HistoricalActionResult {
  success: boolean;
  error?: string;
  data?: HistoricalBenchmarkResult;
}

/**
 * 获取历史标讯大数据穿透与下浮率罗盘数据
 */
export async function getHistoricalBenchmarkAction(
  filters: HistoricalQueryFilters = {}
): Promise<HistoricalActionResult> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录后查看历史大数据分析" };
    }

    const data = await getHistoricalBenchmarkData(filters);
    return { success: true, data };
  } catch (err) {
    console.error("Failed to load historical benchmark data:", err);
    return { success: false, error: "加载历史标讯大数据失败，请稍后重试" };
  }
}

"use server";

import { getSession } from "@/lib/auth";
import {
  runSecurityComplianceInspection,
  ComplianceInspectionResult,
} from "@/lib/compliance";

export interface ComplianceActionResult {
  success: boolean;
  error?: string;
  data?: ComplianceInspectionResult;
}

/**
 * 获取当前系统的等保二级安全合规巡检数据
 */
export async function getComplianceStatusAction(): Promise<ComplianceActionResult> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const inspection = await runSecurityComplianceInspection();
    return { success: true, data: inspection };
  } catch (err) {
    console.error("Failed to run compliance inspection:", err);
    return { success: false, error: "获取安全合规自检数据失败" };
  }
}

/**
 * 手动立即刷新并触发全面安全体检
 */
export async function refreshComplianceInspectionAction(): Promise<ComplianceActionResult> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const inspection = await runSecurityComplianceInspection();
    return { success: true, data: inspection };
  } catch (err) {
    console.error("Failed to refresh compliance inspection:", err);
    return { success: false, error: "执行全面安全巡检失败" };
  }
}

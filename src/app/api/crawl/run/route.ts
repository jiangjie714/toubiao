import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runSourceWithLogging } from "@/../crawler/runner";

export const runtime = "nodejs";
export const maxDuration = 300;

/** 后台手动触发抓取：POST { skillCode: string, maxPages?: number } */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const skillCode = typeof body.skillCode === "string" ? body.skillCode : "";
  const maxPages = Number(body.maxPages) || undefined;
  if (!skillCode) {
    return NextResponse.json({ error: "缺少 skillCode" }, { status: 400 });
  }

  // 同步等待完成并返回结果；抓取量由 maxPages 控制，前端按钮置 loading 等待
  const result = await runSourceWithLogging(skillCode, { maxPages });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

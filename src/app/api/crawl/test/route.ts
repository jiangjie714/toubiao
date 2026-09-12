import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { syncSkillConfigs } from "@/../crawler/config-loader";
import { runSource } from "@/../crawler/runner";

export const runtime = "nodejs";
export const maxDuration = 120;

/** 管理员 dry-run：返回解析样例，不写入 Tender */
export async function POST(req: NextRequest) {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const skillCode = typeof body.skillCode === "string" ? body.skillCode : "";
  const maxPages = Number(body.maxPages) || 1;
  if (!skillCode) return NextResponse.json({ error: "缺少 skillCode" }, { status: 400 });

  await syncSkillConfigs();
  const result = await runSource(skillCode, { maxPages, dryRun: true });
  return NextResponse.json({ ...result, persisted: false });
}

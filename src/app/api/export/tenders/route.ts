import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { consumeExportQuota, getEntitlement } from "@/lib/quota";
import { buildWhere, type ListSearchParams } from "@/lib/query";
import { tenderTypeLabel } from "@/lib/constants";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_EXPORT_ROWS = 2000;

function dateOnly(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再导出" }, { status: 401 });
  }

  const entitlement = await getEntitlement(user.uid);
  const rowLimit = Math.min(entitlement.features.exportDaily, MAX_EXPORT_ROWS);
  if (rowLimit <= 0) {
    return NextResponse.json({ error: "当前套餐不支持 Excel 导出" }, { status: 403 });
  }

  const params = request.nextUrl.searchParams;
  const searchParams: ListSearchParams = {
    q: params.get("q") ?? undefined,
    type: params.get("type") ?? undefined,
    province: params.get("province") ?? undefined,
    city: params.get("city") ?? undefined,
    from: params.get("from") ?? undefined,
    to: params.get("to") ?? undefined,
  };
  const where = buildWhere(searchParams);
  const filters = Object.fromEntries(
    Object.entries(searchParams).filter(([, value]) => typeof value === "string" && value !== ""),
  ) as Record<string, string>;
  const total = await prisma.tender.count({ where });
  if (total === 0) {
    return NextResponse.json({ error: "没有符合条件的公告" }, { status: 404 });
  }

  const quota = await consumeExportQuota(user.uid);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `今日导出额度已用完（${quota.quota} 次/日）` },
      { status: 429 },
    );
  }

  const tenders = await prisma.tender.findMany({
    where,
    orderBy: { publishDate: "desc" },
    take: rowLimit,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "招标信息平台";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("招标信息", {
    views: [{ state: "frozen", ySplit: 1 }],
  });
  worksheet.columns = [
    { header: "ID", key: "id", width: 10 },
    { header: "标题", key: "title", width: 48 },
    { header: "类型", key: "type", width: 12 },
    { header: "发布日期", key: "publishDate", width: 14 },
    { header: "截止时间", key: "expireDate", width: 16 },
    { header: "省份/城市代码", key: "region", width: 18 },
    { header: "采购人", key: "purchaser", width: 24 },
    { header: "代理机构", key: "agency", width: 24 },
    { header: "项目编号", key: "projectNo", width: 20 },
    { header: "预算金额", key: "budgetAmount", width: 14 },
    { header: "中标金额", key: "awardAmount", width: 14 },
    { header: "来源", key: "sourceName", width: 18 },
    { header: "原文链接", key: "sourceUrl", width: 40 },
  ];
  worksheet.getRow(1).font = { bold: true };
  worksheet.getRow(1).fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE8F1FF" },
  };
  worksheet.autoFilter = { from: "A1", to: "M1" };

  for (const tender of tenders) {
    const row = worksheet.addRow({
      id: tender.id,
      title: tender.title,
      type: tenderTypeLabel(tender.type),
      publishDate: dateOnly(tender.publishDate),
      expireDate: tender.expireDate ? dateOnly(tender.expireDate) : "",
      region: [tender.provinceCode, tender.cityCode].filter(Boolean).join(" / "),
      purchaser: tender.purchaser ?? "",
      agency: tender.agency ?? "",
      projectNo: tender.projectNo ?? "",
      budgetAmount: tender.budgetAmount === null ? "" : Number(tender.budgetAmount),
      awardAmount: tender.awardAmount === null ? "" : Number(tender.awardAmount),
      sourceName: tender.sourceName,
      sourceUrl: tender.sourceUrl ?? "",
    });
    if (tender.sourceUrl) {
      const cell = row.getCell("sourceUrl");
      cell.value = { text: tender.sourceUrl, hyperlink: tender.sourceUrl };
    }
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const forwardedFor = request.headers.get("x-forwarded-for");
  await prisma.exportAudit.create({
    data: {
      userId: user.uid,
      filters,
      matchedCount: total,
      exportedCount: tenders.length,
      ip: forwardedFor?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip"),
      userAgent: request.headers.get("user-agent"),
    },
  });

  const fileDate = dateOnly(new Date()).replace(/-/g, "");
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="tenders-${fileDate}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

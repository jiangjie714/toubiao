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

const MAX_EXPORT_ROWS = 3000;

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
    return NextResponse.json(
      { error: "当前套餐不支持批量导出，请升级白金版或企业版" },
      { status: 403 }
    );
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

  const hasBudget = params.get("hasBudget") === "true";
  const hasWinner = params.get("hasWinner") === "true";
  const minBudget = params.get("minBudget") ? parseFloat(params.get("minBudget")!) : undefined;
  const requestedFields = params.get("fields")?.split(",").map((f) => f.trim()).filter(Boolean);

  const where = buildWhere(searchParams);

  if (hasBudget) {
    where.budgetAmount = { not: null };
  }
  if (hasWinner) {
    where.winningSupplier = { not: null };
  }
  if (minBudget && !isNaN(minBudget)) {
    where.budgetAmount = { gte: minBudget };
  }

  const filters = Object.fromEntries(
    Object.entries({
      ...searchParams,
      hasBudget: hasBudget ? "true" : undefined,
      hasWinner: hasWinner ? "true" : undefined,
      minBudget: minBudget ? String(minBudget) : undefined,
    }).filter(([, value]) => typeof value === "string" && value !== "")
  ) as Record<string, string>;

  const total = await prisma.tender.count({ where });
  if (total === 0) {
    return NextResponse.json({ error: "没有符合条件的公告" }, { status: 404 });
  }

  const quota = await consumeExportQuota(user.uid);
  if (!quota.allowed) {
    return NextResponse.json(
      { error: `今日导出额度已用完（当前套餐配额 ${quota.quota} 条/日）` },
      { status: 429 }
    );
  }

  const [tenders, regions] = await Promise.all([
    prisma.tender.findMany({
      where,
      orderBy: { publishDate: "desc" },
      take: rowLimit,
      include: {
        orgContacts: {
          take: 1,
          select: { role: true, phone: true, email: true, address: true },
        },
      },
    }),
    prisma.region.findMany({
      where: { level: 1 },
      select: { code: true, name: true },
    }),
  ]);

  const regionMap = new Map(regions.map((r) => [r.code, r.name]));

  // 权限检查：是否可以明文导出采购人联系方式
  const canExportContacts =
    user.role === "ADMIN" ||
    entitlement.planCode === "PLATINUM" ||
    entitlement.planCode.startsWith("ENTERPRISE") ||
    entitlement.features.contacts;

  // 定义所有候选列及其默认配置
  const ALL_COLUMNS: Record<
    string,
    { header: string; width: number; key: string }
  > = {
    id: { header: "公告ID", width: 10, key: "id" },
    title: { header: "标讯标题", width: 42, key: "title" },
    type: { header: "标讯类型", width: 14, key: "type" },
    publishDate: { header: "发布日期", width: 14, key: "publishDate" },
    expireDate: { header: "投标截止时间", width: 16, key: "expireDate" },
    region: { header: "所属区域", width: 18, key: "region" },
    projectNo: { header: "项目编号", width: 22, key: "projectNo" },
    purchaser: { header: "采购人(发包单位)", width: 28, key: "purchaser" },
    agency: { header: "招标代理机构", width: 26, key: "agency" },
    budgetAmount: { header: "预算金额(万元)", width: 16, key: "budgetAmount" },
    winningSupplier: { header: "中标供应商", width: 30, key: "winningSupplier" },
    awardAmount: { header: "中标成交金额(万元)", width: 18, key: "awardAmount" },
    savingsRate: { header: "节资率(%)", width: 12, key: "savingsRate" },
    contactRole: { header: "官方项目联络人", width: 18, key: "contactRole" },
    phone: { header: "采购人联系电话", width: 18, key: "phone" },
    email: { header: "电子邮箱", width: 22, key: "email" },
    address: { header: "通讯地址", width: 30, key: "address" },
    sourceName: { header: "发布数据源", width: 18, key: "sourceName" },
    sourceUrl: { header: "官方公告链接", width: 40, key: "sourceUrl" },
  };

  // 默认导出的基础字段集
  const defaultFields = [
    "id",
    "title",
    "type",
    "publishDate",
    "expireDate",
    "region",
    "projectNo",
    "purchaser",
    "agency",
    "budgetAmount",
    "winningSupplier",
    "awardAmount",
    "savingsRate",
    "contactRole",
    "phone",
    "email",
    "sourceName",
    "sourceUrl",
  ];

  const activeFieldKeys = (requestedFields && requestedFields.length > 0)
    ? requestedFields.filter((k) => ALL_COLUMNS[k])
    : defaultFields;

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "标讯通 - 招投标商业情报平台";
  workbook.created = new Date();
  const worksheet = workbook.addWorksheet("标讯商机清单", {
    views: [{ state: "frozen", ySplit: 1 }],
  });

  worksheet.columns = activeFieldKeys.map((k) => ALL_COLUMNS[k]);

  // 表头设计：明亮优雅科技风蓝
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true, color: { argb: "FF1E3A8A" }, size: 11 };
  headerRow.fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFEBF3FE" },
  };
  headerRow.alignment = { vertical: "middle", horizontal: "center" };
  headerRow.height = 26;

  // 逐行填入
  for (const tender of tenders) {
    const contact = tender.orgContacts[0];
    const provinceName = tender.provinceCode ? regionMap.get(tender.provinceCode) ?? "" : "";
    const regionStr = [provinceName, tender.cityCode].filter(Boolean).join(" ");

    const budget = tender.budgetAmount ? Number(tender.budgetAmount) : null;
    const award = tender.awardAmount ? Number(tender.awardAmount) : null;
    let savingsRateStr = "";
    if (budget && award && budget > award) {
      savingsRateStr = `${(((budget - award) / budget) * 100).toFixed(1)}%`;
    }

    let phoneStr = "";
    let emailStr = "";
    if (contact) {
      if (canExportContacts) {
        phoneStr = contact.phone ?? "";
        emailStr = contact.email ?? "";
      } else {
        phoneStr = contact.phone
          ? (contact.phone.length > 7 ? `${contact.phone.slice(0, 3)}****${contact.phone.slice(-3)}` : "******")
          : "";
        emailStr = contact.email ? "******@***.com" : "";
      }
    }

    const rowData: Record<string, unknown> = {
      id: tender.id,
      title: tender.title,
      type: tenderTypeLabel(tender.type),
      publishDate: dateOnly(tender.publishDate),
      expireDate: tender.expireDate ? dateOnly(tender.expireDate) : "",
      region: regionStr || tender.provinceCode || "",
      projectNo: tender.projectNo ?? "",
      purchaser: tender.purchaser ?? "",
      agency: tender.agency ?? "",
      budgetAmount: budget !== null ? budget : "",
      winningSupplier: tender.winningSupplier ?? "",
      awardAmount: award !== null ? award : "",
      savingsRate: savingsRateStr,
      contactRole: contact?.role ?? "",
      phone: phoneStr,
      email: emailStr,
      address: contact?.address ?? "",
      sourceName: tender.sourceName,
      sourceUrl: tender.sourceUrl ?? "",
    };

    const row = worksheet.addRow(rowData);
    row.height = 20;

    // 格式化金额列为数字格式
    if (activeFieldKeys.includes("budgetAmount") && budget !== null) {
      const cell = row.getCell("budgetAmount");
      cell.numFmt = "#,##0.00";
    }
    if (activeFieldKeys.includes("awardAmount") && award !== null) {
      const cell = row.getCell("awardAmount");
      cell.numFmt = "#,##0.00";
    }

    // 链接超链
    if (tender.sourceUrl && activeFieldKeys.includes("sourceUrl")) {
      const cell = row.getCell("sourceUrl");
      cell.value = { text: "查看官方原文公告", hyperlink: tender.sourceUrl };
    }
  }

  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: activeFieldKeys.length },
  };

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
      "Content-Disposition": `attachment; filename="biaoxuntong-tenders-${fileDate}.xlsx"`,
      "Cache-Control": "no-store",
    },
  });
}

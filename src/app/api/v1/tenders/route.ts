import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { buildWhere } from "@/lib/query";

export async function GET(request: Request) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.statusCode || 401, message: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const type = searchParams.get("type") || "";
  const province = searchParams.get("province") || "";
  const city = searchParams.get("city") || "";
  const purchaser = searchParams.get("purchaser") || "";
  const winningSupplier = searchParams.get("winningSupplier") || "";
  const from = searchParams.get("from") || "";
  const to = searchParams.get("to") || "";

  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10) || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20", 10) || 20));

  const where = buildWhere({
    q,
    type,
    province,
    city,
    purchaser,
    winningSupplier,
    from,
    to,
  });

  const [total, items] = await Promise.all([
    prisma.tender.count({ where }),
    prisma.tender.findMany({
      where,
      select: {
        id: true,
        title: true,
        type: true,
        projectNo: true,
        provinceCode: true,
        cityCode: true,
        publishDate: true,
        expireDate: true,
        openTime: true,
        purchaser: true,
        agency: true,
        budgetAmount: true,
        awardAmount: true,
        winningSupplier: true,
        sourceName: true,
        sourceUrl: true,
        createdAt: true,
      },
      orderBy: { publishDate: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);

  const formattedItems = items.map((t) => ({
    ...t,
    publishDate: t.publishDate.toISOString().slice(0, 10),
    expireDate: t.expireDate ? t.expireDate.toISOString().slice(0, 10) : null,
    openTime: t.openTime ? t.openTime.toISOString().slice(0, 10) : null,
    budgetAmount: t.budgetAmount ? Number(t.budgetAmount) : null,
    awardAmount: t.awardAmount ? Number(t.awardAmount) : null,
  }));

  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      items: formattedItems,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    },
    meta: {
      quotaRemaining: auth.quotaRemaining,
      rateLimitRpm: auth.apiKey?.rateLimitRpm || 60,
      timestamp: new Date().toISOString(),
    },
  });
}

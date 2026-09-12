import { NextResponse } from "next/server";
import { authenticateApiKey } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await authenticateApiKey(request);
  if (!auth.ok) {
    return NextResponse.json(
      { code: auth.statusCode || 401, message: auth.error },
      { status: auth.statusCode || 401 }
    );
  }

  const { id: rawId } = await params;
  const tenderId = parseInt(rawId, 10);
  if (isNaN(tenderId)) {
    return NextResponse.json(
      { code: 400, message: "无效的标讯 ID" },
      { status: 400 }
    );
  }

  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    include: {
      attachments: {
        select: { id: true, name: true, sourceUrl: true, size: true, contentType: true },
      },
      orgContacts: {
        select: { id: true, orgName: true, role: true, phone: true, email: true, address: true },
      },
      aiAnalysis: {
        select: {
          executiveSummary: true,
          riskRadar: true,
          scoringMethod: true,
          timelineAndKey: true,
          modelUsed: true,
          updatedAt: true,
        },
      },
    },
  });

  if (!tender) {
    return NextResponse.json(
      { code: 404, message: "未找到指定标讯" },
      { status: 404 }
    );
  }

  return NextResponse.json({
    code: 0,
    message: "success",
    data: {
      ...tender,
      publishDate: tender.publishDate.toISOString().slice(0, 10),
      expireDate: tender.expireDate ? tender.expireDate.toISOString().slice(0, 10) : null,
      openTime: tender.openTime ? tender.openTime.toISOString().slice(0, 10) : null,
      budgetAmount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
      awardAmount: tender.awardAmount ? Number(tender.awardAmount) : null,
    },
    meta: {
      quotaRemaining: auth.quotaRemaining,
      rateLimitRpm: auth.apiKey?.rateLimitRpm || 60,
      timestamp: new Date().toISOString(),
    },
  });
}

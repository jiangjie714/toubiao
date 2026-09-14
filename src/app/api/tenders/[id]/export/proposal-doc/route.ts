import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import {
  generateProposalOutline,
  generateProposalDocHtml,
} from "@/lib/proposal-generator";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再导出标书框架草案" }, { status: 401 });
  }

  const entitlement = await getEntitlement(user.uid);
  if (!entitlement.features.fullText) {
    return NextResponse.json(
      { error: "当前套餐无权导出 Word 标书草案文档。请升级为黄金会员或以上级别享受导出特权。" },
      { status: 403 }
    );
  }

  const { id: rawId } = await params;
  const tenderId = parseInt(rawId, 10);
  if (isNaN(tenderId)) {
    return NextResponse.json({ error: "无效的标讯 ID" }, { status: 400 });
  }

  const tender = await prisma.tender.findUnique({
    where: { id: tenderId },
    select: {
      id: true,
      title: true,
      type: true,
      content: true,
      purchaser: true,
      agency: true,
      projectNo: true,
      budgetAmount: true,
      publishDate: true,
      expireDate: true,
      openTime: true,
      sourceUrl: true,
    },
  });

  if (!tender) {
    return NextResponse.json({ error: "未找到对应标讯" }, { status: 404 });
  }

  const outlineResult = generateProposalOutline(tender);
  const docHtml = generateProposalDocHtml(outlineResult);

  // 记录导出审计日志
  try {
    await prisma.exportAudit.create({
      data: {
        userId: user.uid,
        filters: {
          action: "EXPORT_PROPOSAL_DOC",
          tenderId: tender.id,
          projectNo: tender.projectNo,
          purchaser: tender.purchaser,
        },
        matchedCount: 1,
        exportedCount: 1,
      },
    });
  } catch (auditErr) {
    console.error("Failed to log export audit for proposal doc:", auditErr);
  }

  // 构造下载文件名
  const sanitizedTitle = tender.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 30);
  const filename = `标书草案_${tender.id}_${sanitizedTitle}.doc`;
  const encodedFilename = encodeURIComponent(filename);

  return new NextResponse(docHtml, {
    status: 200,
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`,
      "Cache-Control": "no-cache, no-store, must-revalidate",
    },
  });
}

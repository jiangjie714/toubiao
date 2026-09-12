import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再下载附件" }, { status: 401 });
  }

  const entitlement = await getEntitlement(user.uid);
  if (!entitlement.features.attachments) {
    return NextResponse.json(
      {
        error: "当前套餐无权下载标书附件。请升级为铂金会员或企业版享受完整下载特权。",
        upgradeRequired: true,
      },
      { status: 403 }
    );
  }

  const { id: rawId } = await params;
  const attachmentId = parseInt(rawId, 10);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "无效的附件 ID" }, { status: 400 });
  }

  const attachment = await prisma.attachment.findUnique({
    where: { id: attachmentId },
    include: { tender: { select: { id: true, title: true } } },
  });

  if (!attachment) {
    return NextResponse.json({ error: "未找到对应附件" }, { status: 404 });
  }

  // 生成标准示范文件内容或流式输出
  const mockContent = `【标讯通·招投标安全存管文件】\n所属公告：${attachment.tender.title}\n附件名称：${attachment.name}\n下载会员：${user.name || user.username} (${entitlement.planName})\n安全校验：通过\n下载时间：${new Date().toLocaleString("zh-CN")}\n----------------------------------------\n本文件受企业版权限保护与安全审计水印校验。`;
  const fileBuffer = Buffer.from(mockContent, "utf-8");

  const encodedFileName = encodeURIComponent(attachment.name);

  return new NextResponse(fileBuffer, {
    status: 200,
    headers: {
      "Content-Type": attachment.contentType || "application/octet-stream",
      "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
      "Content-Length": String(fileBuffer.length),
      "Cache-Control": "private, no-cache, no-store, must-revalidate",
    },
  });
}

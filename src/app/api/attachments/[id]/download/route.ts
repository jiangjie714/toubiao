import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getOrFetchAttachment, AttachmentError } from "@/lib/attachment-service";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再下载附件" }, { status: 401 });
  }

  const { id: rawId } = await params;
  const attachmentId = parseInt(rawId, 10);
  if (isNaN(attachmentId)) {
    return NextResponse.json({ error: "无效的附件 ID" }, { status: 400 });
  }

  try {
    const result = await getOrFetchAttachment(attachmentId, user.uid);
    const encodedFileName = encodeURIComponent(result.fileName);

    return new NextResponse(result.buffer as unknown as BodyInit, {
      status: 200,
      headers: {
        "Content-Type": result.contentType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Content-Length": String(result.size),
        "X-Attachment-Checksum": result.checksum,
        "X-Cache-Hit": result.fromCache ? "HIT" : "MISS",
        "Cache-Control": "private, no-cache, no-store, must-revalidate",
      },
    });
  } catch (err: unknown) {
    if (err instanceof AttachmentError) {
      if (err.code === "UPGRADE_REQUIRED") {
        return NextResponse.json(
          {
            error: "当前套餐无权下载标书附件。请升级为铂金会员或企业版享受完整下载特权。",
            upgradeRequired: true,
          },
          { status: 403 }
        );
      }
      if (err.code === "NOT_FOUND") {
        return NextResponse.json({ error: "未找到对应附件记录" }, { status: 404 });
      }
      if (err.code === "SECURITY_BLOCKED") {
        return NextResponse.json({ error: err.message }, { status: 400 });
      }
    }

    const message = err instanceof Error ? err.message : "下载处理失败";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

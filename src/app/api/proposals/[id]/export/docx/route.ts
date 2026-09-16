import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { generateProposalDocxBuffer } from "@/lib/proposal-docx-exporter";
import {
  ProposalProjectData,
  AssembledVolumeItem,
} from "@/lib/proposal-assembler-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const resolvedParams = await params;
    const projectId = Number(resolvedParams.id);
    if (isNaN(projectId) || projectId <= 0) {
      return NextResponse.json({ error: "无效的标书工程ID" }, { status: 400 });
    }

    const project = await prisma.proposalProject.findUnique({
      where: { id: projectId },
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            purchaser: true,
            budgetAmount: true,
          },
        },
      },
    });

    if (!project || project.userId !== user.uid) {
      return NextResponse.json(
        { error: "标书工程不存在或无权访问" },
        { status: 403 }
      );
    }

    // 解析分卷
    let volumes: AssembledVolumeItem[] = [];
    try {
      volumes = Array.isArray(project.assembledVolumes)
        ? (project.assembledVolumes as unknown as AssembledVolumeItem[])
        : JSON.parse(project.assembledVolumes as string);
    } catch {
      volumes = [];
    }

    // 读取 URL 参数
    const searchParams = request.nextUrl.searchParams;
    const proposalType = (searchParams.get("type") === "副本" ? "副本" : "正本") as "正本" | "副本";
    const bidderName = searchParams.get("bidderName") || "标讯通智能科技有限公司";
    const legalRepresentative = searchParams.get("legalRep") || "张三（法定代表人）";
    const includeCover = searchParams.get("cover") !== "false";

    const projectData: ProposalProjectData = {
      id: project.id,
      title: project.title,
      status: project.status as "DRAFT" | "COMPLETED" | "AUDITED",
      targetPurchaser: project.targetPurchaser,
      bidAmountWan: project.bidAmountWan,
      projectDuration: project.projectDuration,
      tenderId: project.tenderId,
      followId: project.followId,
      createdAt: project.createdAt.toISOString(),
      updatedAt: project.updatedAt.toISOString(),
      volumes,
      completionRate: 100,
    };

    const buffer = await generateProposalDocxBuffer(projectData, {
      includeCover,
      proposalType,
      bidderName,
      legalRepresentative,
    });

    // 清洗并编码文件名
    const safeTitle = project.title.replace(/[\\/:*?"<>|]/g, "_").slice(0, 40);
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `投标文件_${safeTitle}_${proposalType}_${dateStr}.docx`;
    const encodedFileName = encodeURIComponent(fileName);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodedFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    console.error("Failed to export proposal docx:", err);
    return NextResponse.json(
      { error: "生成标书 Word 文档失败，请稍后重试" },
      { status: 500 }
    );
  }
}

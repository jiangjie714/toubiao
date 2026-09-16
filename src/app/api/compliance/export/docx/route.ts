import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { runSecurityComplianceInspection } from "@/lib/compliance";
import { generateComplianceReportDocxBuffer } from "@/lib/compliance-report-docx";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const user = await getSession();
    if (!user) {
      return NextResponse.json({ error: "请先登录" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const companyName = searchParams.get("companyName") || "标讯通智能科技有限公司";

    const inspection = await runSecurityComplianceInspection();
    const buffer = await generateComplianceReportDocxBuffer(inspection, companyName);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    const fileName = `标讯通_网络安全等保二级符合性自评报告_${dateStr}.docx`;
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
    console.error("Failed to export compliance report docx:", err);
    return NextResponse.json(
      { error: "生成等保合规报告失败，请稍后重试" },
      { status: 500 }
    );
  }
}

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import { tenderTypeLabel, formatDate } from "@/lib/constants";
import { parseTenderSections } from "@/lib/tender-sections";

export const runtime = "nodejs";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getSession();
  if (!user) {
    return NextResponse.json({ error: "请先登录后再导出立项简报" }, { status: 401 });
  }

  const entitlement = await getEntitlement(user.uid);
  if (!entitlement.features.fullText) {
    return NextResponse.json(
      { error: "当前套餐无权导出 Word 标书简报。请升级为黄金会员或以上级别享受导出特权。" },
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
    include: {
      orgContacts: true,
      attachments: true,
      aiAnalysis: true,
    },
  });

  if (!tender) {
    return NextResponse.json({ error: "未找到对应标讯" }, { status: 404 });
  }

  const sections = parseTenderSections(tender.content, tender.sourceUrl ?? undefined);

  // 构建符合微软 Word 标准规范的 XML/HTML 复合文档（可被 Microsoft Office Word、WPS 直接原生打开）
  const contactsHtml = tender.orgContacts.map(c => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px; background-color: #f8fafc; font-weight: bold; width: 120px;">
        ${c.role === 'purchaser' ? '采购人' : '代理机构'}
      </td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">
        <b>${c.orgName}</b><br/>
        联系电话：${c.phone || '未留'}<br/>
        电子邮箱：${c.email || '未留'}<br/>
        办公地址：${c.address || '未留'}
      </td>
    </tr>
  `).join('');

  const attachmentsHtml = tender.attachments.map((a, i) => `
    <tr>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 40px; text-align: center;">${i + 1}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px;">${a.name}</td>
      <td style="border: 1px solid #cbd5e1; padding: 6px 10px; width: 100px;">${a.size ? (a.size / 1024).toFixed(1) + ' KB' : '附件'}</td>
    </tr>
  `).join('');

  const aiExecutiveSummary = tender.aiAnalysis?.executiveSummary || '';
  const aiRiskRadar = tender.aiAnalysis?.riskRadar ? (
    Array.isArray(tender.aiAnalysis.riskRadar)
      ? (tender.aiAnalysis.riskRadar as Array<{ item: string; risk: string }>).map(r => `<li><b>${r.item}：</b>${r.risk}</li>`).join('')
      : ''
  ) : '';

  const sectionsContentHtml = sections.map(s => `
    <h3 style="color: #1e3a8a; border-bottom: 1px solid #93c5fd; padding-bottom: 4px; margin-top: 18px;">${s.title}</h3>
    <div style="line-height: 1.8; color: #334155; font-size: 14px; margin-bottom: 15px;">
      ${s.blocks.map(b => {
        if (b.type === 'paragraph') return `<p style="margin: 6px 0;">${b.text.replace(/\n/g, '<br/>')}</p>`;
        if (b.type === 'link') return `<p><a href="${b.href}">${b.label}</a></p>`;
        if (b.type === 'table') {
          return `
            <table style="width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 13px;">
              ${b.rows.map(r => `
                <tr>
                  ${r.map(cell => `<td style="border: 1px solid #cbd5e1; padding: 6px 8px; ${cell.header ? 'background: #f1f5f9; font-weight: bold;' : ''}">${cell.text}</td>`).join('')}
                </tr>
              `).join('')}
            </table>
          `;
        }
        return '';
      }).join('')}
    </div>
  `).join('');

  const docHtml = `
    <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head>
      <meta charset="utf-8">
      <title>${tender.title} - 标书立项评审简报</title>
      <style>
        body { font-family: SimSun, "宋体", serif; line-height: 1.6; color: #0f172a; padding: 20px; }
        h1 { font-family: SimHei, "黑体", sans-serif; text-align: center; color: #0f172a; font-size: 22px; margin-bottom: 10px; }
        .meta-table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        .meta-table td { border: 1px solid #cbd5e1; padding: 8px 12px; }
        .meta-label { background-color: #f1f5f9; font-weight: bold; width: 130px; }
        .badge { background: #dbeafe; color: #1e40af; padding: 2px 6px; border-radius: 4px; font-size: 12px; font-weight: bold; }
        .footer-note { margin-top: 30px; border-top: 1px dashed #cbd5e1; padding-top: 10px; font-size: 12px; color: #64748b; text-align: center; }
      </style>
    </head>
    <body>
      <div style="text-align: center; margin-bottom: 8px;">
        <span class="badge">标讯通 · 招投标商业决策与立项初审简报</span>
      </div>
      <h1>${tender.title}</h1>
      <p style="text-align: center; color: #64748b; font-size: 12px; margin-bottom: 20px;">
        发布日期：${formatDate(tender.publishDate)} · 截标日期：${tender.expireDate ? formatDate(tender.expireDate) : '未明确'} · 导出人：${user.name || user.username}
      </p>

      <table class="meta-table">
        <tr>
          <td class="meta-label">项目编号</td>
          <td>${tender.projectNo || '未明确'}</td>
          <td class="meta-label">公告类型</td>
          <td>${tenderTypeLabel(tender.type)}</td>
        </tr>
        <tr>
          <td class="meta-label">采购人单位</td>
          <td>${tender.purchaser || '未明确'}</td>
          <td class="meta-label">预算 / 中标金额</td>
          <td style="color: #dc2626; font-weight: bold;">
            ${tender.awardAmount ? `中标价：${Number(tender.awardAmount)} 万元` : tender.budgetAmount ? `预算价：${Number(tender.budgetAmount)} 万元` : '按官方正文为准'}
          </td>
        </tr>
        <tr>
          <td class="meta-label">代理机构</td>
          <td>${tender.agency || '自行组织采购'}</td>
          <td class="meta-label">开标时间</td>
          <td>${tender.openTime ? formatDate(tender.openTime) : '详见公告日程'}</td>
        </tr>
      </table>

      ${aiExecutiveSummary ? `
        <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; padding: 14px; margin-bottom: 20px;">
          <h4 style="margin: 0 0 6px 0; color: #1e40af; font-size: 15px;">🤖 AI 智能速读与投标决策建议</h4>
          <p style="margin: 0; font-size: 13px; color: #1e3a8a; line-height: 1.6;">${aiExecutiveSummary}</p>
          ${aiRiskRadar ? `<ul style="margin: 8px 0 0 0; padding-left: 20px; font-size: 12px; color: #1e3a8a;">${aiRiskRadar}</ul>` : ''}
        </div>
      ` : ''}

      ${tender.orgContacts.length > 0 ? `
        <h3 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-top: 20px;">一、核心机构联络人图谱</h3>
        <table class="meta-table">
          ${contactsHtml}
        </table>
      ` : ''}

      ${tender.attachments.length > 0 ? `
        <h3 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-top: 20px;">二、官方招标文件与采购清单附件</h3>
        <table class="meta-table">
          <tr style="background-color: #f1f5f9; font-weight: bold;">
            <td style="text-align: center;">序号</td>
            <td>附件文件名称</td>
            <td>规格尺寸</td>
          </tr>
          ${attachmentsHtml}
        </table>
      ` : ''}

      <h3 style="color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-top: 20px;">三、公告结构化全文内容</h3>
      ${sectionsContentHtml}

      <div class="footer-note">
        本立项简报由【标讯通】智能生成 · 官方来源：${tender.sourceName} · 仅供企业内部投标决策评审参考
      </div>
    </body>
    </html>
  `;

  const safeFileName = encodeURIComponent(`${tender.title.slice(0, 30)}-立项简报.doc`);

  return new NextResponse(docHtml, {
    headers: {
      "Content-Type": "application/msword; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeFileName}"; filename*=UTF-8''${safeFileName}`,
      "Cache-Control": "no-store",
    },
  });
}

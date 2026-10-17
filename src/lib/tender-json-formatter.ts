/**
 * 结构化 JSON 招采公告数据格式化与美化工具
 * 将爬虫抓取的接口 JSON 数据转换为规范的人类可读中文公告文本与高保真 HTML
 */

export interface FormattedTenderContent {
  isJson: boolean;
  title?: string;
  plainText: string;
  htmlText: string;
  fields: Record<string, string>;
}

/**
 * 字段映射中英文典
 */
const FIELD_LABEL_MAP: Record<string, string> = {
  title: "项目名称",
  noticeTitle: "公告标题",
  noticeTypeName: "公告类型",
  noticeType: "公告类型",
  purchaser: "采购单位",
  author: "发布机构",
  purchaserAddr: "采购人地址",
  purchaserLinkMan: "采购联系人",
  purchaserLinkPhone: "采购联系电话",
  agentManageName: "代理机构",
  agency: "代理机构",
  agentAddress: "代理机构地址",
  agentLinkMan: "代理联系人",
  agentLinkPhone: "代理联系电话",
  budget: "预算金额 (元)",
  budgetAmount: "预算金额",
  successfulMoney: "成交金额 (元)",
  planCodes: "计划/项目编号",
  openTenderCode: "招标编号",
  catalogueNameList: "采购品目",
  productCategoryName: "商品品类",
  purchaseMannerName: "采购方式",
  channelName: "发布渠道",
  regionName: "所属地区",
  noticeTime: "发布时间",
  publishTime: "发布时间",
  openTenderTime: "开标时间",
  expireTime: "截止时间",
  demandTime: "期望交付时间",
};

/**
 * 判断一段字符串是否为 JSON 对象/数组
 */
export function isJsonString(str: string): boolean {
  if (!str) return false;
  const trimmed = str.trim();
  if (!((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]")))) {
    return false;
  }
  try {
    const val = JSON.parse(trimmed);
    return typeof val === "object" && val !== null;
  } catch {
    return false;
  }
}

/**
 * 从 JSON 对象中解析提取公告业务信息并格式化
 */
export function formatJsonTenderContent(content: string, fallbackTitle?: string): FormattedTenderContent {
  const trimmed = content ? content.trim() : "";
  if (!isJsonString(trimmed)) {
    return {
      isJson: false,
      plainText: content,
      htmlText: `<div class="prose max-w-none whitespace-pre-wrap">${escapeHtml(content)}</div>`,
      fields: {},
    };
  }

  try {
    const parsed = JSON.parse(trimmed);
    // 兼容常见数据包裹层：data.data, data, result.data, result
    const rawData =
      parsed?.data?.data && typeof parsed.data.data === "object"
        ? parsed.data.data
        : parsed?.data && typeof parsed.data === "object"
        ? parsed.data
        : parsed?.result?.data && typeof parsed.result.data === "object"
        ? parsed.result.data
        : parsed?.result && typeof parsed.result === "object"
        ? parsed.result
        : parsed;

    if (!rawData || typeof rawData !== "object" || Array.isArray(rawData)) {
      return {
        isJson: true,
        plainText: content,
        htmlText: `<pre class="bg-slate-50 p-4 text-xs font-mono">${escapeHtml(content)}</pre>`,
        fields: {},
      };
    }

    const title =
      String(rawData.title || rawData.noticeTitle || rawData.projectName || fallbackTitle || "政府采购与招投标项目").trim();

    // 如果里面有直接的 html 内容，优先使用
    const innerHtml =
      rawData.content || rawData.noticeContent || rawData.body || rawData.html || rawData.detailHtml;
    if (typeof innerHtml === "string" && innerHtml.length > 50 && (innerHtml.includes("<p>") || innerHtml.includes("<div>") || innerHtml.includes("<table>"))) {
      // 提取纯文本
      const plain = innerHtml.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      return {
        isJson: true,
        title,
        plainText: plain,
        htmlText: innerHtml,
        fields: {},
      };
    }

    // 结构化提取展示字段
    const extractedFields: Record<string, string> = {};
    for (const [key, label] of Object.entries(FIELD_LABEL_MAP)) {
      const val = rawData[key];
      if (val !== undefined && val !== null && String(val).trim() !== "" && String(val).trim() !== "null") {
        let displayVal = String(val).trim();
        // 金额格式化
        if ((key === "budget" || key === "successfulMoney") && !isNaN(Number(displayVal))) {
          displayVal = `¥ ${Number(displayVal).toLocaleString("zh-CN", { minimumFractionDigits: 2 })}`;
        }
        extractedFields[label] = displayVal;
      }
    }

    // 组装纯文本小节结构（便于 parseTenderSections 分类小节）
    const lines: string[] = [];
    lines.push(`【项目名称】\n${title}`);
    lines.push("");

    lines.push("一、项目基本情况");
    if (extractedFields["采购单位"]) lines.push(`采购单位：${extractedFields["采购单位"]}`);
    if (extractedFields["公告类型"]) lines.push(`公告类型：${extractedFields["公告类型"]}`);
    if (extractedFields["预算金额 (元)"]) lines.push(`预算金额：${extractedFields["预算金额 (元)"]}`);
    if (extractedFields["成交金额 (元)"]) lines.push(`成交金额：${extractedFields["成交金额 (元)"]}`);
    if (extractedFields["采购品目"]) lines.push(`采购品目：${extractedFields["采购品目"]}`);
    if (extractedFields["采购方式"]) lines.push(`采购方式：${extractedFields["采购方式"]}`);
    if (extractedFields["计划/项目编号"]) lines.push(`项目编号：${extractedFields["计划/项目编号"]}`);
    if (extractedFields["所属地区"]) lines.push(`行政区划：${extractedFields["所属地区"]}`);
    lines.push("");

    lines.push("二、时间安排与流程");
    if (extractedFields["发布时间"]) lines.push(`发布时间：${extractedFields["发布时间"]}`);
    if (extractedFields["开标时间"]) lines.push(`开标时间：${extractedFields["开标时间"]}`);
    if (extractedFields["截止时间"]) lines.push(`截止时间：${extractedFields["截止时间"]}`);
    if (extractedFields["期望交付时间"]) lines.push(`交付期限：${extractedFields["期望交付时间"]}`);
    lines.push("");

    lines.push("三、联系方式与主体信息");
    if (extractedFields["采购单位"]) lines.push(`采购人名称：${extractedFields["采购单位"]}`);
    if (extractedFields["采购联系人"]) lines.push(`联系人：${extractedFields["采购联系人"]}`);
    if (extractedFields["采购联系电话"]) lines.push(`联系电话：${extractedFields["采购联系电话"]}`);
    if (extractedFields["采购人地址"]) lines.push(`地址：${extractedFields["采购人地址"]}`);
    if (extractedFields["代理机构"]) lines.push(`代理机构：${extractedFields["代理机构"]}`);
    if (extractedFields["代理联系人"]) lines.push(`代理联系人：${extractedFields["代理联系人"]}`);
    if (extractedFields["代理联系电话"]) lines.push(`代理联系电话：${extractedFields["代理联系电话"]}`);

    const plainText = lines.join("\n");

    // 组装美观的高保真 HTML 表格
    const fieldEntries = Object.entries(extractedFields);
    let tableRows = "";
    for (let i = 0; i < fieldEntries.length; i += 2) {
      const [k1, v1] = fieldEntries[i];
      const pair2 = fieldEntries[i + 1];
      if (pair2) {
        tableRows += `
          <tr>
            <th style="width:18%;background-color:#f8fafc;padding:10px 14px;border:1px solid #cbd5e1;font-weight:600;color:#334155;text-align:right;">${escapeHtml(k1)}</th>
            <td style="width:32%;padding:10px 14px;border:1px solid #cbd5e1;color:#1e293b;">${escapeHtml(v1)}</td>
            <th style="width:18%;background-color:#f8fafc;padding:10px 14px;border:1px solid #cbd5e1;font-weight:600;color:#334155;text-align:right;">${escapeHtml(pair2[0])}</th>
            <td style="width:32%;padding:10px 14px;border:1px solid #cbd5e1;color:#1e293b;">${escapeHtml(pair2[1])}</td>
          </tr>`;
      } else {
        tableRows += `
          <tr>
            <th style="width:18%;background-color:#f8fafc;padding:10px 14px;border:1px solid #cbd5e1;font-weight:600;color:#334155;text-align:right;">${escapeHtml(k1)}</th>
            <td colspan="3" style="width:82%;padding:10px 14px;border:1px solid #cbd5e1;color:#1e293b;">${escapeHtml(v1)}</td>
          </tr>`;
      }
    }

    const htmlText = `
<div class="tender-official-notice" style="font-family:-apple-system,BlinkMacSystemFont,'PingFang SC','Microsoft YaHei',sans-serif;max-width:960px;margin:0 auto;color:#1e293b;line-height:1.75;">
  <div style="text-align:center;margin-bottom:28px;padding-bottom:18px;border-bottom:2px solid #2563eb;">
    <h1 style="font-size:22px;font-weight:700;color:#0f172a;margin:0 0 10px 0;">${escapeHtml(title)}</h1>
    <div style="font-size:13px;color:#64748b;">
      ${extractedFields["发布时间"] ? `<span>发布时间：${escapeHtml(extractedFields["发布时间"])}</span>` : ""}
      ${extractedFields["公告类型"] ? `<span style="margin-left:16px;padding:2px 8px;background:#eff6ff;color:#2563eb;border-radius:4px;font-weight:500;">${escapeHtml(extractedFields["公告类型"])}</span>` : ""}
    </div>
  </div>

  <div style="margin-bottom:24px;">
    <h2 style="font-size:16px;font-weight:600;color:#1e3a8a;border-left:4px solid #2563eb;padding-left:10px;margin-bottom:12px;">核心标讯要素清单</h2>
    <table style="width:100%;border-collapse:collapse;border:1px solid #cbd5e1;font-size:14px;margin-bottom:16px;">
      <tbody>
        ${tableRows}
      </tbody>
    </table>
  </div>

  <div style="background-color:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:16px 20px;font-size:13px;color:#64748b;">
    <p style="margin:0;"><strong>说明：</strong>本项目数据源自公共资源与政府采购公开接口，系统已自动解析并将结构化参数要素化归档展示。若需进一步获取招标文件附件或答疑澄清，请查阅原招标公告或联系上述采购单位。</p>
  </div>
</div>
`.trim();

    return {
      isJson: true,
      title,
      plainText,
      htmlText,
      fields: extractedFields,
    };
  } catch {
    return {
      isJson: true,
      plainText: content,
      htmlText: `<pre class="bg-slate-50 p-4 text-xs font-mono">${escapeHtml(content)}</pre>`,
      fields: {},
    };
  }
}

function escapeHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

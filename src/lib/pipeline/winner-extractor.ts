/**
 * 中标供应商、中标金额、预算金额及项目编号高精度抽取清洗引擎
 */

export interface WinnerExtractionResult {
  winningSupplier?: string | null;
  awardAmountWan?: number | null;
  budgetAmountWan?: number | null;
  projectNo?: string | null;
}

/**
 * 清洗公司/供应商名称
 */
export function cleanSupplierName(raw: string): string | null {
  if (!raw) return null;
  let name = raw.trim();

  // 移除常见包件前缀，如 "第1包："、"包1："、"标段一："、"A包："、"1."
  name = name.replace(/^(?:第?[0-9一二三四五六七八九十A-Za-z]+[包组标段分包]+[：:\s]*)/, "");
  name = name.replace(/^[0-9]+[、.．\s]+/, "");
  name = name.replace(/^[（(][0-9一二三四五六七八九十]+[）)][：:\s]*/, "");

  // 截断到常见标点
  const cutIdx = name.search(/[，,。；;\n\r\t]/);
  if (cutIdx > 0) {
    name = name.slice(0, cutIdx);
  }

  name = name.trim();

  // 过滤无效干扰词与表头占位符
  const invalidKeywords = [
    "详见", "公告", "采购人", "代理机构", "招标文件", "详见附件", "无", "不适用",
    "废标", "流标", "终止", "null", "undefined", "供应商地址", "供应商名称",
    "中标金额", "评审得分", "统一社会信用代码", "企业办公电话", "供应商",
    "中标候选人", "投标人", "中标信息", "法定代表人", "开标时间", "评标委员会", "主要标的"
  ];
  if (invalidKeywords.includes(name) || name.length < 3 || name.length > 50) {
    return null;
  }

  // 不能仅仅是纯数字或符号
  if (/^[0-9\-_./]+$/.test(name)) return null;

  return name;
}

/**
 * 解析金额文本为万元数值
 */
export function parseAmountToWan(text: string): number | null {
  if (!text) return null;
  const cleaned = text.replace(/,/g, "").trim();
  const num = parseFloat(cleaned);
  if (isNaN(num) || num <= 0 || num > 100000000) return null;
  return Math.round(num * 10000) / 10000;
}

/**
 * 从公告标题与正文中高精度抽取结构化字段
 */
export function extractWinnerAndProject(
  content: string,
  title: string = ""
): WinnerExtractionResult {
  const result: WinnerExtractionResult = {
    winningSupplier: null,
    awardAmountWan: null,
    budgetAmountWan: null,
    projectNo: null,
  };

  const text = `${title}\n${content}`;

  // 1. 项目编号提取
  const projectNoMatches = [
    /(?:项目编号|采购编号|招标文件编号|招标编号)[：:\s]*([A-Za-z0-9\-_/（）()\[\]【】#]{5,60})/i,
    /(?:采购计划编号|交易编号)[：:\s]*([A-Za-z0-9\-_/（）()\[\]【】#]{5,60})/i,
  ];
  for (const reg of projectNoMatches) {
    const m = text.match(reg);
    if (m && m[1]) {
      const pNo = m[1].trim().replace(/（招标文件.*$/, "").replace(/）$/, "").trim();
      if (pNo.length >= 4 && pNo.length <= 50) {
        result.projectNo = pNo;
        break;
      }
    }
  }

  // 2. 中标供应商提取
  const supplierPatterns = [
    // 表格头形态：供应商名称 ... 供应商地址 ... 评审得分 ... <企业名>
    /供应商名称[\s\S]{1,100}?供应商地址[\s\S]{1,150}?(?:评审得分)?[\s\r\n]+([^\s，,。；;\n\r]{4,50}(?:公司|院|厂|中心|所|局|店|队|行|集团|商行|总社|学校))/i,
    /供应商名称[：:\s]*([^\s，,。；;\n\r]{4,50}(?:公司|院|厂|中心|所|局|店|队|行|集团|商行|总社|学校))/i,
    /供应商名称[：:\s]*([^\s，,。；;\n\r]{4,50})/i,
    /(?:成交供应商|中标供应商|第一中标候选人|中标人|成交人|预中标人)[：:\s]*([^\s，,。；;\n\r]{4,50}(?:公司|院|厂|中心|所|局|店|队|行|集团|商行|总社|学校))/i,
    /(?:成交供应商|中标供应商|第一中标候选人|中标人|成交人|预中标人)[：:\s]*([^\s，,。；;\n\r]{4,50})/i,
    /中标(?:（成交）)?信息[\s\S]{0,120}?供应商名称[：:\s]*([^\s，,。；;\n\r]{4,50})/i,
    /成交供应商情况[：:\s]*[\s\S]{0,60}?供应商名称[：:\s]*([^\s，,。；;\n\r]{4,50})/i,
  ];

  for (const reg of supplierPatterns) {
    const m = text.match(reg);
    if (m && m[1]) {
      const cleaned = cleanSupplierName(m[1]);
      if (cleaned) {
        result.winningSupplier = cleaned;
        break;
      }
    }
  }

  // 3. 中标金额 (万元)
  const awardPatterns = [
    // 显式标注万元
    /(?:中标(?:（成交）)?金额|成交金额|投标报价|中标价)[（(]?(?:元)?[）)]?[：:\s]*(?:人民币)?([0-9,.]+)\s*（?万元）?/i,
    // 表格行
    /中标金额\(万元\)[\s\S]{1,60}?评审得分[\s\S]{1,100}?([0-9,.]+)\s*(?:万元)?/i,
    // 显式标注元
    /(?:中标(?:（成交）)?金额|成交金额|投标报价|中标价)[（(]?(?:元)?[）)]?[：:\s]*(?:人民币)?([0-9,.]+)\s*元/i,
  ];

  for (const reg of awardPatterns) {
    const m = text.match(reg);
    if (m && m[1]) {
      const isYuan = reg.source.includes("元") && !reg.source.includes("万元");
      const rawNum = parseAmountToWan(m[1]);
      if (rawNum && rawNum > 0) {
        const amtWan = isYuan ? Math.round((rawNum / 10000) * 10000) / 10000 : rawNum;
        if (amtWan > 0) {
          result.awardAmountWan = amtWan;
          break;
        }
      }
    }
  }

  // 4. 预算金额 (万元)
  const budgetPatterns = [
    /(?:预算金额|最高限价|采购预算|控制价)[（(]?(?:元)?[）)]?[：:\s]*(?:人民币)?([0-9,.]+)\s*（?万元）?/i,
    /(?:预算金额|最高限价|采购预算|控制价)[（(]?(?:元)?[）)]?[：:\s]*(?:人民币)?([0-9,.]+)\s*元/i,
  ];

  for (const reg of budgetPatterns) {
    const m = text.match(reg);
    if (m && m[1]) {
      const isYuan = reg.source.includes("元") && !reg.source.includes("万元");
      const rawNum = parseAmountToWan(m[1]);
      if (rawNum && rawNum > 0) {
        const amtWan = isYuan ? Math.round((rawNum / 10000) * 10000) / 10000 : rawNum;
        if (amtWan > 0) {
          result.budgetAmountWan = amtWan;
          break;
        }
      }
    }
  }

  return result;
}

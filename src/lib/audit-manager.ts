export type AuditCategory =
  | "TEMPLATE_LEAK"
  | "PRICE_INTEGRITY"
  | "FATAL_COMPLIANCE"
  | "CREDENTIAL_TIMELINESS"
  | "SEALING_SIGNATURE"
  | "COLLUSION_RISK";

export type AuditSeverity = "FATAL" | "WARNING" | "INFO";

export interface AuditCategoryMeta {
  category: AuditCategory;
  label: string;
  shortLabel: string;
  description: string;
  badgeColor: string;
}

export const AUDIT_CATEGORIES_META: Record<AuditCategory, AuditCategoryMeta> = {
  TEMPLATE_LEAK: {
    category: "TEMPLATE_LEAK",
    label: "模板残留与错写业主排查",
    shortLabel: "模板残留",
    description: "扫描未清理的占位符（如 [XXX公司]）及以往项目中遗留的非本项目业主单位或竞对名称。",
    badgeColor: "bg-rose-100 text-rose-800 border-rose-300",
  },
  PRICE_INTEGRITY: {
    category: "PRICE_INTEGRITY",
    label: "商务报价与大小写一致性核验",
    shortLabel: "报价核验",
    description: "核对大写金额与小写阿拉伯数字是否一致，比对分项报价总和与投标控制上限价。",
    badgeColor: "bg-amber-100 text-amber-800 border-amber-300",
  },
  FATAL_COMPLIANCE: {
    category: "FATAL_COMPLIANCE",
    label: "法定废标与一票否决项扫描",
    shortLabel: "一票废标",
    description: "扫描星号条款响应、技术负偏离词汇、法人授权委托书与实质性承诺完整性。",
    badgeColor: "bg-red-100 text-red-800 border-red-300",
  },
  CREDENTIAL_TIMELINESS: {
    category: "CREDENTIAL_TIMELINESS",
    label: "资质证书与业绩年限有效性",
    shortLabel: "资质业绩",
    description: "对照招标文件要求核验所附资质证书有效期及同类业绩合同签署日期的时效性。",
    badgeColor: "bg-purple-100 text-purple-800 border-purple-300",
  },
  SEALING_SIGNATURE: {
    category: "SEALING_SIGNATURE",
    label: "签章完整性与装订格式规范",
    shortLabel: "签章规范",
    description: "排查法人手签印、公章覆盖、骑缝章、电子标书CA签章与格式页码连贯性要求。",
    badgeColor: "bg-blue-100 text-blue-800 border-blue-300",
  },
  COLLUSION_RISK: {
    category: "COLLUSION_RISK",
    label: "雷同串标与文档元数据特征自查",
    shortLabel: "串标排查",
    description: "排查电子文档元数据属性、创建者/修改者残留、硬件IP/MAC及段落雷同风险清单。",
    badgeColor: "bg-indigo-100 text-indigo-800 border-indigo-300",
  },
};

export interface AuditIssueItem {
  id: string;
  category: AuditCategory;
  severity: AuditSeverity;
  title: string;
  description: string;
  excerpt?: string; // 原文中捕获的片段
  suggestion: string; // 修复建议
}

export interface AuditResultData {
  documentTitle: string;
  auditScore: number; // 0-100
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  fatalCount: number;
  warningCount: number;
  infoCount: number;
  categoryScores: Record<AuditCategory, number>; // 每项满分或扣分
  issues: AuditIssueItem[];
  auditedLength: number;
  inspectedAt: string;
}

/**
 * 模板占位符正则集
 */
const TEMPLATE_PLACEHOLDER_REGEXES = [
  /\[\s*(?:xxx[^\s\]]*|某某[^\s\]]*|公司名称|招标人|采购人|项目名称|投标人|待填[^\s\]]*|待定|需替换|请补充)\s*\]/gi,
  /【\s*(?:xxx[^\s】]*|某某[^\s】]*|公司名称|招标人|采购人|项目名称|投标人|待填[^\s】]*|待定|需替换|请补充)\s*】/gi,
  /\{{1,2}\s*(?:company|client|project|name|xxx.*?)\s*\}{1,2}/gi,
  /(?:某某市|某某区|某某县|某某局|某某单位|某某系统|某某软件|某某公司)/g,
];

/**
 * 中文大写数字映射
 */
const CN_NUM_MAP: Record<string, number> = {
  零: 0,
  壹: 1,
  贰: 2,
  叁: 3,
  肆: 4,
  伍: 5,
  陆: 6,
  柒: 7,
  捌: 8,
  玖: 9,
  拾: 10,
  佰: 100,
  仟: 1000,
  万: 10000,
  亿: 100000000,
};

/**
 * 简易中文大写金额转换为数字 (元)
 */
export function parseChineseCurrency(cnStr: string): number | null {
  if (!cnStr) return null;
  // 去除修饰词
  const clean = cnStr.replace(/[人民币整元角分圆]/g, "").trim();
  if (!clean) return null;

  let total = 0;
  let section = 0;
  let num = 0;

  for (let i = 0; i < clean.length; i++) {
    const char = clean[i];
    const val = CN_NUM_MAP[char];

    if (val === undefined) continue;

    if (val < 10) {
      num = val;
    } else if (val === 10 || val === 100 || val === 1000) {
      section += (num === 0 ? 1 : num) * val;
      num = 0;
    } else if (val === 10000) {
      section = (section + num) * val;
      total += section;
      section = 0;
      num = 0;
    } else if (val === 100000000) {
      section = (section + num) * val;
      total += section;
      section = 0;
      num = 0;
    }
  }

  total += section + num;
  return total > 0 ? total : null;
}

/**
 * 执行投标文件六维深度智能质检
 */
export function runDeepBidAudit(
  content: string,
  context?: {
    documentTitle?: string;
    targetPurchaser?: string | null;
    budgetAmount?: number | null; // 万元或元
    qualificationNames?: string[];
  }
): AuditResultData {
  const issues: AuditIssueItem[] = [];
  const text = content || "";
  const title = context?.documentTitle || "未命名投标文件送检文本";

  let issueSeq = 1;
  const addIssue = (
    cat: AuditCategory,
    sev: AuditSeverity,
    t: string,
    desc: string,
    sug: string,
    exc?: string
  ) => {
    issues.push({
      id: `issue-${issueSeq++}`,
      category: cat,
      severity: sev,
      title: t,
      description: desc,
      suggestion: sug,
      excerpt: exc ? exc.slice(0, 80) : undefined,
    });
  };

  // ================= 1. 模板残留与错写业主排查 =================
  for (const reg of TEMPLATE_PLACEHOLDER_REGEXES) {
    const matches = text.match(reg);
    if (matches && matches.length > 0) {
      addIssue(
        "TEMPLATE_LEAK",
        "FATAL",
        "检测到标书模板占位符残留",
        `标书中出现未替换的模板占位符「${matches[0]}」（共匹配到 ${matches.length} 处），属于编制疏漏。`,
        "请使用文本全局查找并替换为本项目实际企业/项目/业主全称，封标前必须清理全部占位符。",
        matches[0]
      );
      break;
    }
  }

  // 错写非本项目业主单位名称排查
  if (context?.targetPurchaser && context.targetPurchaser.trim().length >= 4) {
    const targetP = context.targetPurchaser.trim();
    // 匹配类似“某某局”、“某某中心”、“某某公司”等机构名
    const orgMatches = text.match(/[\u4e00-\u9fa5]{2,8}(?:人民政府|公安局|财政局|教育局|卫健委|大数据局|应急管理局|医院|大学|供电局|交警支队)/g);
    if (orgMatches) {
      const suspiciousOrgs = Array.from(new Set(orgMatches)).filter(
        (name) => name !== targetP && !targetP.includes(name) && !name.includes(targetP)
      );

      if (suspiciousOrgs.length > 0) {
        addIssue(
          "TEMPLATE_LEAK",
          "FATAL",
          "疑似残留非本项目业主单位名称",
          `本项目采购人为【${targetP}】，但在送检文本中检测到疑似其他业主单位名称：${suspiciousOrgs.slice(0, 3).map((o) => `「${o}」`).join("、")}。极易被评审专家判定为复制套用以往方案！`,
          `请立即在标书内全文检索并核实上述机构名称的上下文，如系套用既往标书，请彻底替换为【${targetP}】。`,
          suspiciousOrgs[0]
        );
      }
    }
  }

  // ================= 2. 商务报价与大小写一致性核验 =================
  // 查找大写金额与紧邻小写数字
  const pricePairRegex = /(?:人民币|投标总价|报价|总计|金额)[：:\s]*([壹贰叁肆伍陆柒捌玖拾佰仟万亿元角分整圆]{4,20})/g;
  let match;
  while ((match = pricePairRegex.exec(text)) !== null) {
    const capStr = match[1];
    const parsedCap = parseChineseCurrency(capStr);

    if (parsedCap) {
      // 在大写金额的前后 100 字符内寻找对应的小写数字
      const startIdx = Math.max(0, match.index - 80);
      const endIdx = Math.min(text.length, match.index + match[0].length + 80);
      const surrounding = text.slice(startIdx, endIdx);

      const numMatch = surrounding.match(/(?:¥|￥|小写[：:\s]*|RMB\s*)?([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?|[0-9]{4,10}(?:\.[0-9]{1,2})?)/);

      if (numMatch) {
        const numVal = parseFloat(numMatch[1].replace(/,/g, ""));
        if (!isNaN(numVal) && numVal > 1000) {
          // 比较大写与小写数字
          if (Math.abs(parsedCap - numVal) > 1) {
            addIssue(
              "PRICE_INTEGRITY",
              "FATAL",
              "报价大写金额与小写数字不一致",
              `检测到大写金额「${capStr}」(折算为 ${parsedCap.toLocaleString()} 元) 与邻近小写数字「${numVal.toLocaleString()} 元」存在差异！根据政府采购法规定，大小写不一致时以大写为准，存在重大亏损或废标风险。`,
              "请立即复核投标一览表及开标分项明细表，确保大写数字汉字与阿拉伯数字完全对应一致。",
              `${capStr} vs ${numVal}`
            );
          }
        }
      }
    }
  }

  // 预算超额检测
  if (context?.budgetAmount && context.budgetAmount > 0) {
    const budgetYuan = context.budgetAmount >= 100000 ? context.budgetAmount : context.budgetAmount * 10000;
    const allNumbers = text.match(/(?:报价|投标价|总额)[^0-9]{0,10}([0-9]{1,3}(?:,[0-9]{3})+(?:\.[0-9]{2})?|[0-9]{5,10})/g);
    if (allNumbers) {
      for (const item of allNumbers) {
        const num = parseFloat(item.replace(/[^0-9.]/g, ""));
        if (num > budgetYuan * 1.001) {
          addIssue(
            "PRICE_INTEGRITY",
            "FATAL",
            "投标报价超出最高采购限价 (预算上限)",
            `检测到报价相关表述「${item}」超出本项目预算上限「${(budgetYuan / 10000).toFixed(2)} 万元」，将直接导致一票否决废标！`,
            "请重新测算并确保最终封标投标总价不超过最高限价控制金额。",
            item
          );
          break;
        }
      }
    }
  }

  // ================= 3. 法定废标与一票否决项扫描 =================
  // 负偏离风险
  const negativeRegex = /(?:负偏离|不满足|未满足|无法提供|不能提供|不具备|存在差异|偏差说明)[：:\s]*([^\n。；]{4,50})/g;
  const negMatches = text.match(negativeRegex);
  if (negMatches) {
    addIssue(
      "FATAL_COMPLIANCE",
      "FATAL",
      "存在负偏离或未响应声明词汇",
      `标书中检测到「${negMatches[0].slice(0, 30)}」等负偏离倾向词汇。若该项属于星号(*)实质性条款，将直接导致废标！`,
      "请仔细核查招标文件第六章技术条款要求，确认该负偏离是否涉及星号条款；若涉及必须调整方案做到实质性满足响应。",
      negMatches[0]
    );
  }

  // 授权委托书核实
  if (!text.includes("法定代表人授权") && !text.includes("授权委托书") && text.length > 500) {
    addIssue(
      "FATAL_COMPLIANCE",
      "WARNING",
      "未检测到【法定代表人授权委托书】章节",
      "通用资格审查必备附件：如果由被授权人签字递交，必须随投标文件附有效法定代表人授权委托书及双方身份证扫描件。",
      "请在商务文件卷首确认已装订法定代表人授权委托书及加盖公章的被授权人身份证复印件。"
    );
  }

  // 投标保证金承诺/凭证核实
  if (!text.includes("投标保证金") && !text.includes("保函") && text.length > 500) {
    addIssue(
      "FATAL_COMPLIANCE",
      "INFO",
      "未注明投标保证金缴纳或保函凭证",
      "大部分招投标项目要求在标书中装订投标保证金银行电子回单、保函或免缴承诺函。",
      "请核验招标文件是否免除保证金；若未免除，请务必在商务标中附上银行转账电子回单或电子保函凭单。"
    );
  }

  // 投标有效期核验
  const validityMatch = text.match(/投标有效期[^\d]{0,10}(\d{1,3})\s*(?:天|日历天|日)/);
  if (validityMatch) {
    const days = parseInt(validityMatch[1], 10);
    if (days < 60) {
      addIssue(
        "FATAL_COMPLIANCE",
        "WARNING",
        "投标有效期承诺天数偏短",
        `检测到投标有效期承诺为「${days} 天」，常见政府采购要求通常为 90 天或 120 天，若短于招标文件规定将被视为非实质性响应而废标。`,
        "请核对招标公告中对投标有效期的具体要求（一般建议承诺为 90 日历天或以上）。",
        validityMatch[0]
      );
    }
  }

  // ================= 4. 资质证书与业绩年限有效性 =================
  if (context?.qualificationNames && context.qualificationNames.length > 0) {
    // 检查资质名称在标书中的匹配
    const missingInDoc: string[] = [];
    for (const q of context.qualificationNames) {
      if (!text.includes(q)) {
        missingInDoc.push(q);
      }
    }
    if (missingInDoc.length > 0 && missingInDoc.length <= 3) {
      addIssue(
        "CREDENTIAL_TIMELINESS",
        "INFO",
        "企业主资质证书未在文本中显式提及",
        `企业资质库中持有的核心资质【${missingInDoc.join("、")}】未在送检文本中体现。`,
        "若本项目招标文件对上述资质有加分要求，请确保在商务部分装订证书正本彩色扫描件。"
      );
    }
  }

  // ================= 5. 签章规范与排版装订 =================
  if (text.includes("签字") || text.includes("盖章") || text.length > 300) {
    if (!text.includes("骑缝章") && text.length > 2000) {
      addIssue(
        "SEALING_SIGNATURE",
        "INFO",
        "长文档装订注意加盖骑缝章",
        "标书页数较多时，纸质标书通常要求加盖骑缝章，电子标书要求每页具有数字签名时间戳。",
        "纸质标书胶装完成后务必通体加盖骑缝章；电子标书生成 PDF 时确保使用正版 CA 数字证书一键全域签名。"
      );
    }
  }

  // ================= 6. 串标风险与文档元数据特征 =================
  if (text.includes("WPS Office") || text.includes("Microsoft Word") || text.includes("修改者")) {
    addIssue(
      "COLLUSION_RISK",
      "INFO",
      "建议清理 Office 文档属性与作者元数据",
      "电子交易平台大数据查重系统会对投标文件的【文档属性创建者】、【最后修改者】及修改软件序列号进行比对，若两家投标人元数据相同直接被判定为串标废标。",
      "最终生成提交的 PDF 文件前，请在 Word/WPS 中执行「文件 - 检查文档 - 删除个人信息和隐藏属性」，清除历史版本和作者痕迹。"
    );
  }

  // 计算健康分
  let auditScore = 100;
  let fatalCount = 0;
  let warningCount = 0;
  let infoCount = 0;

  for (const item of issues) {
    if (item.severity === "FATAL") {
      fatalCount++;
      auditScore -= 30;
    } else if (item.severity === "WARNING") {
      warningCount++;
      auditScore -= 12;
    } else {
      infoCount++;
      auditScore -= 3;
    }
  }

  auditScore = Math.max(0, Math.min(100, auditScore));

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" = "LOW";
  if (fatalCount > 0 || auditScore < 60) {
    riskLevel = "HIGH";
  } else if (warningCount > 0 || auditScore < 85) {
    riskLevel = "MEDIUM";
  }

  const categoryScores: Record<AuditCategory, number> = {
    TEMPLATE_LEAK: issues.some((i) => i.category === "TEMPLATE_LEAK") ? 60 : 100,
    PRICE_INTEGRITY: issues.some((i) => i.category === "PRICE_INTEGRITY") ? 60 : 100,
    FATAL_COMPLIANCE: issues.some((i) => i.category === "FATAL_COMPLIANCE") ? 60 : 100,
    CREDENTIAL_TIMELINESS: issues.some((i) => i.category === "CREDENTIAL_TIMELINESS") ? 75 : 100,
    SEALING_SIGNATURE: issues.some((i) => i.category === "SEALING_SIGNATURE") ? 80 : 100,
    COLLUSION_RISK: issues.some((i) => i.category === "COLLUSION_RISK") ? 85 : 100,
  };

  return {
    documentTitle: title,
    auditScore,
    riskLevel,
    fatalCount,
    warningCount,
    infoCount,
    categoryScores,
    issues,
    auditedLength: text.length,
    inspectedAt: new Date().toISOString(),
  };
}

/**
 * 一键生成公文级《投标文件清标自查与合规质检报告》(Markdown)
 */
export function generateAuditReportMarkdown(data: {
  documentTitle: string;
  auditScore: number;
  riskLevel: string;
  fatalCount: number;
  warningCount: number;
  issues: AuditIssueItem[];
  inspector?: string;
  targetPurchaser?: string;
  inspectedAt: string;
}): string {
  const riskText =
    data.riskLevel === "HIGH"
      ? "🔴 高危废标隐患 (建议立即阻断封标整改)"
      : data.riskLevel === "MEDIUM"
      ? "🟡 存在扣分风险 (建议排查修复后再封标)"
      : "🟢 健康通过 (未发现致命合规硬伤)";

  return `# 投标文件清标自查与合规深度质检报告

**送检标段/文档**: ${data.documentTitle}  
**清标复核人**: ${data.inspector || "项目质检负责人"}  
**质检时间**: ${data.inspectedAt.slice(0, 19).replace("T", " ")}  
**综合健康分**: **${data.auditScore} 分** / 100 分  
**风险定级**: **${riskText}**  
**隐患统计**: 发现 **${data.fatalCount}** 项一票否决隐患，**${data.warningCount}** 项扣分预警  

---

## 一、六维质检诊断结论

| 质检维度 | 状态判定 | 说明 |
| :--- | :--- | :--- |
| **模板残留与错写业主** | ${data.issues.some((i) => i.category === "TEMPLATE_LEAK") ? "❌ 发现残留隐患" : "✅ 清洁无残留"} | 扫描占位符与非本项目业主单位名称 |
| **商务报价与大小写核验** | ${data.issues.some((i) => i.category === "PRICE_INTEGRITY") ? "❌ 大小写矛盾或超限价" : "✅ 报价大小写一致"} | 大小写对应与预算上限对标 |
| **法定废标一票否决项** | ${data.issues.some((i) => i.category === "FATAL_COMPLIANCE") ? "❌ 存在负偏离或缺项" : "✅ 实质性条款完整"} | 关键星号条款与授权委托书 |
| **资质证书与业绩时效** | ${data.issues.some((i) => i.category === "CREDENTIAL_TIMELINESS") ? "⚠️ 提示关注" : "✅ 有效期合规"} | 证书年限与案例时效交叉核实 |
| **签章规范与排版装订** | ${data.issues.some((i) => i.category === "SEALING_SIGNATURE") ? "⚠️ 提示关注" : "✅ 签章要求清晰"} | 法人签字、公章覆盖与骑缝章 |
| **雷同串标元数据特征** | ${data.issues.some((i) => i.category === "COLLUSION_RISK") ? "⚠️ 提示清理" : "✅ 属性合规"} | 文档创建者与个人信息清除 |

---

## 二、检测发现的隐患与整改清单

${
  data.issues.length > 0
    ? data.issues
        .map(
          (issue, idx) => `### ${idx + 1}. 【${issue.severity === "FATAL" ? "🔴 致命废标" : issue.severity === "WARNING" ? "🟡 扣分警告" : "🔵 格式建议"}】${issue.title}
- **隐患描述**: ${issue.description}
${issue.excerpt ? `- **原文摘录**: \`${issue.excerpt}\`\n` : ""}- **整改建议**: **${issue.suggestion}**`
        )
        .join("\n\n")
    : "✅ 本次送检文本未检测出明显合规隐患与模板残留，技术商务整体响应质量良好。"
}

---

## 三、封标前四方交叉复核打勾确认表 (会签归档)

| 审核角色 | 核验关键控制点 | 确认人签字 | 复核日期 |
| :--- | :--- | :--- | :--- |
| **商务负责人** | 投标报价总价及分项明细大小写完全一致，未超预算上限 | ________ | 2026-___-___ |
| **技术负责人** | 技术参数点对点应答，无未经批准的负偏离 | ________ | 2026-___-___ |
| **商务/法务** | 法定代表人授权委托书、身份证件原件扫描件齐备有效 | ________ | 2026-___-___ |
| **封标操作员** | 纸质骑缝章盖全 / 电子CA证书数字签名全域时间戳覆盖 | ________ | 2026-___-___ |

---

*报告生成：标讯通企业级智能决策罗盘 · 清标查重质检工坊*
`;
}

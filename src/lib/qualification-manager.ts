import { formatDate } from "@/lib/constants";

export type QualificationCategory =
  | "MANAGEMENT" // 管理体系认证 (ISO9001, ISO14001, ISO45001, ISO27001, ISO20000等)
  | "CAPABILITY" // 技术与实施能力 (CMMI, ITSS, 施工专业承包等)
  | "CREDIT"     // 信用与资信评级 (AAA级信用, 重合同守信用等)
  | "HONOR"      // 荣誉与创新认定 (高新技术企业, 专精特新, 瞪羚企业等)
  | "SPECIAL";   // 特许资质与合规许可 (安全生产许可证, 涉密资质, 安防等)

export const QUALIFICATION_CATEGORIES: Record<
  QualificationCategory,
  { label: string; description: string; color: string; bg: string }
> = {
  MANAGEMENT: {
    label: "管理体系认证",
    description: "ISO9001、ISO14001、ISO45001、ISO27001、ISO20000 等标准认证",
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
  },
  CAPABILITY: {
    label: "技术能力资质",
    description: "CMMI 软件成熟度、ITSS 运维服务、电子与智能化、系统集成等工程能力",
    color: "text-purple-700",
    bg: "bg-purple-50 border-purple-200",
  },
  CREDIT: {
    label: "信用与资信",
    description: "企业信用评价 AAA 级、资信等级证书、纳税信用 A 级等",
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
  },
  HONOR: {
    label: "荣誉与专精特新",
    description: "国家高新技术企业、专精特新“小巨人”、科技型中小企业等政策荣誉",
    color: "text-emerald-700",
    bg: "bg-emerald-50 border-emerald-200",
  },
  SPECIAL: {
    label: "特许资质许可",
    description: "安全生产许可证、涉密信息系统集成、安防工程资质、增值电信许可等",
    color: "text-rose-700",
    bg: "bg-rose-50 border-rose-200",
  },
};

export type QualificationStatus = "VALID" | "EXPIRING_90" | "EXPIRING_30" | "EXPIRED";

export const STATUS_META: Record<
  QualificationStatus,
  { label: string; badgeColor: string; description: string }
> = {
  VALID: {
    label: "正常有效",
    badgeColor: "bg-emerald-50 text-emerald-700 border-emerald-200",
    description: "证书处于合法有效期内，可正常选送投标",
  },
  EXPIRING_90: {
    label: "90天内到期",
    badgeColor: "bg-blue-50 text-blue-700 border-blue-200",
    description: "剩余有效期不足3个月，建议尽快筹备换证复审申报",
  },
  EXPIRING_30: {
    label: "30天高危临期",
    badgeColor: "bg-amber-50 text-amber-700 border-amber-200",
    description: "临期紧急！开标日若跨越失效期将直接导致废标，需加急换发",
  },
  EXPIRED: {
    label: "已逾期失效",
    badgeColor: "bg-rose-50 text-rose-700 border-rose-200",
    description: "严禁选送！官方核验不通过将直接判定资格审查不合格一票否决",
  },
};

export interface CompanyQualificationItem {
  id: number;
  userId: number;
  name: string;
  category: QualificationCategory;
  categoryLabel: string;
  certNo: string | null;
  issuingAuthority: string | null;
  issueDate: string | null;
  expiryDate: string; // YYYY-MM-DD
  daysRemaining: number;
  status: QualificationStatus;
  statusLabel: string;
  annualInspectDate: string | null;
  annualInspectDaysRemaining: number | null;
  isAnnualInspectDue: boolean;
  coverageScope: string | null;
  level: string | null;
  certFileUrl: string | null;
  notes: string | null;
  teamId: number | null;
  createdAt: string;
}

export interface QualificationSummary {
  totalCount: number;
  validCount: number;
  expiring90Count: number;
  expiring30Count: number;
  expiredCount: number;
  annualInspectDueCount: number;
  fileUploadedCount: number;
  fileUploadedRate: number;
}

/**
 * 依据有效期截止日计算剩余天数及状态
 */
export function calculateQualificationStatus(
  expiryDate: Date | string,
  annualInspectDate?: Date | string | null
): {
  daysRemaining: number;
  status: QualificationStatus;
  statusLabel: string;
  annualInspectDaysRemaining: number | null;
  isAnnualInspectDue: boolean;
} {
  const now = new Date();
  const exp = typeof expiryDate === "string" ? new Date(expiryDate) : expiryDate;
  const diffTime = exp.getTime() - now.getTime();
  const daysRemaining = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

  let status: QualificationStatus = "VALID";
  if (daysRemaining < 0) {
    status = "EXPIRED";
  } else if (daysRemaining <= 30) {
    status = "EXPIRING_30";
  } else if (daysRemaining <= 90) {
    status = "EXPIRING_90";
  } else {
    status = "VALID";
  }

  let annualInspectDaysRemaining: number | null = null;
  let isAnnualInspectDue = false;

  if (annualInspectDate) {
    const ann = typeof annualInspectDate === "string" ? new Date(annualInspectDate) : annualInspectDate;
    const annDiff = ann.getTime() - now.getTime();
    annualInspectDaysRemaining = Math.ceil(annDiff / (1000 * 60 * 60 * 24));
    if (annualInspectDaysRemaining <= 30) {
      isAnnualInspectDue = true;
    }
  }

  return {
    daysRemaining,
    status,
    statusLabel: STATUS_META[status].label,
    annualInspectDaysRemaining,
    isAnnualInspectDue,
  };
}

/**
 * 汇总统计全部证书资产指标
 */
export function summarizeQualifications(items: CompanyQualificationItem[]): QualificationSummary {
  const totalCount = items.length;
  let validCount = 0;
  let expiring90Count = 0;
  let expiring30Count = 0;
  let expiredCount = 0;
  let annualInspectDueCount = 0;
  let fileUploadedCount = 0;

  for (const it of items) {
    if (it.status === "VALID") validCount++;
    if (it.status === "EXPIRING_90") expiring90Count++;
    if (it.status === "EXPIRING_30") expiring30Count++;
    if (it.status === "EXPIRED") expiredCount++;
    if (it.isAnnualInspectDue) annualInspectDueCount++;
    if (it.certFileUrl && it.certFileUrl.trim().length > 0) fileUploadedCount++;
  }

  const fileUploadedRate = totalCount > 0 ? Math.round((fileUploadedCount / totalCount) * 100) : 0;

  return {
    totalCount,
    validCount,
    expiring90Count,
    expiring30Count,
    expiredCount,
    annualInspectDueCount,
    fileUploadedCount,
    fileUploadedRate,
  };
}

/**
 * 常见招标资质规则字典与检测模式
 */
export interface RecognizedQualRule {
  key: string;
  name: string;
  category: QualificationCategory;
  patterns: RegExp;
  suggestedLevel?: string;
  importance: "FATAL" | "HIGH" | "NORMAL"; // 属于一票否决资格项还是评分加分项
  estimatedPoints: number; // 预估加分 (如 1~3 分)
}

export const RECOGNIZED_QUAL_RULES: RecognizedQualRule[] = [
  {
    key: "ISO9001",
    name: "ISO9001 质量管理体系认证",
    category: "MANAGEMENT",
    patterns: /(?:ISO\s*9001|GB\/T\s*19001|质量管理体系)/i,
    importance: "HIGH",
    estimatedPoints: 2,
  },
  {
    key: "ISO27001",
    name: "ISO27001 信息安全管理体系认证",
    category: "MANAGEMENT",
    patterns: /(?:ISO\s*27001|GB\/T\s*22080|信息安全管理体系)/i,
    importance: "HIGH",
    estimatedPoints: 2,
  },
  {
    key: "ISO20000",
    name: "ISO20000 信息技术服务管理体系认证",
    category: "MANAGEMENT",
    patterns: /(?:ISO\s*20000|ISO\/IEC\s*20000|IT服务管理体系|信息技术服务管理)/i,
    importance: "HIGH",
    estimatedPoints: 2,
  },
  {
    key: "ISO14001",
    name: "ISO14001 环境管理体系认证",
    category: "MANAGEMENT",
    patterns: /(?:ISO\s*14001|GB\/T\s*24001|环境管理体系)/i,
    importance: "NORMAL",
    estimatedPoints: 1,
  },
  {
    key: "ISO45001",
    name: "ISO45001/OHSAS18001 职业健康安全体系",
    category: "MANAGEMENT",
    patterns: /(?:ISO\s*45001|GB\/T\s*45001|OHSAS\s*18001|职业健康安全)/i,
    importance: "NORMAL",
    estimatedPoints: 1,
  },
  {
    key: "CMMI",
    name: "CMMI 软件能力成熟度模型认证",
    category: "CAPABILITY",
    patterns: /(?:CMMI\s*(?:3|4|5|三|四|五|级)?|软件能力成熟度)/i,
    importance: "HIGH",
    estimatedPoints: 3,
  },
  {
    key: "ITSS",
    name: "ITSS 信息技术服务标准运行维护能力",
    category: "CAPABILITY",
    patterns: /(?:ITSS|运维服务能力|信息技术服务标准)/i,
    importance: "HIGH",
    estimatedPoints: 2,
  },
  {
    key: "HI_TECH",
    name: "国家高新技术企业证书",
    category: "HONOR",
    patterns: /(?:高新技术企业|国家高新)/i,
    importance: "NORMAL",
    estimatedPoints: 2,
  },
  {
    key: "SPECIALIZED",
    name: "专精特新“小巨人”/专精特新企业认定",
    category: "HONOR",
    patterns: /(?:专精特新|小巨人企业)/i,
    importance: "NORMAL",
    estimatedPoints: 2,
  },
  {
    key: "CREDIT_AAA",
    name: "企业信用等级 AAA 级证书",
    category: "CREDIT",
    patterns: /(?:AAA\s*级|信用等级|企业信用评价|纳税信用\s*A\s*级)/i,
    importance: "NORMAL",
    estimatedPoints: 1,
  },
  {
    key: "SAFETY_PRODUCTION",
    name: "安全生产许可证",
    category: "SPECIAL",
    patterns: /(?:安全生产许可|安全生产资格证)/i,
    importance: "FATAL",
    estimatedPoints: 3,
  },
  {
    key: "ELECTRONIC_INTELLIGENCE",
    name: "电子与智能化工程专业承包资质",
    category: "CAPABILITY",
    patterns: /(?:电子与智能化|智能化工程专业承包)/i,
    importance: "FATAL",
    estimatedPoints: 4,
  },
  {
    key: "SECURITY_INTEGRATION",
    name: "安防工程企业设计施工维护资质",
    category: "SPECIAL",
    patterns: /(?:安防工程|安防资质|安全防范工程)/i,
    importance: "NORMAL",
    estimatedPoints: 2,
  },
  {
    key: "CONFIDENTIAL_INTEGRATION",
    name: "涉密信息系统集成资质",
    category: "SPECIAL",
    patterns: /(?:涉密信息系统|涉密系统集成|保密资质)/i,
    importance: "FATAL",
    estimatedPoints: 5,
  },
];

export interface TenderQualificationMatchItem {
  rule: RecognizedQualRule;
  detectedClauses: string[]; // 招标文件原文条款
  matchStatus: "MATCHED_VALID" | "MATCHED_EXPIRING" | "MATCHED_EXPIRED" | "MISSING";
  matchStatusLabel: string;
  matchedCert?: CompanyQualificationItem;
  riskMessage?: string;
  pointsEarned: number;
}

export interface TenderQualificationMatchAnalysis {
  tenderId: number;
  tenderTitle: string;
  totalRequired: number; // 招标文件要求的资质认证项
  matchedCount: number;  // 具备且有效
  expiringCount: number; // 具备但临期需换证
  expiredCount: number;  // 具备但已过期 (严禁提交)
  missingCount: number;  // 缺项 (无法响应)
  estimatedBonusPoints: number; // 预估总加分
  overallQualificationFit: "EXCELLENT" | "SATISFACTORY" | "RISKY" | "FATAL_RISK";
  fitLabel: string;
  fitBadgeColor: string;
  fitAdvice: string;
  items: TenderQualificationMatchItem[];
  generatedAt: string;
}

/**
 * 辅助函数：从文本中提取包含指定正则模式的完整语句
 */
function extractClauseContext(text: string, regex: RegExp, maxContexts = 2): string[] {
  if (!text) return [];
  const normalized = text.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
  const sentences = normalized.split(/[。；;\n]/);
  const matched: string[] = [];

  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length >= 6 && trimmed.length <= 160 && regex.test(trimmed)) {
      if (!matched.includes(trimmed)) {
        matched.push(trimmed);
        if (matched.length >= maxContexts) break;
      }
    }
  }

  return matched;
}

/**
 * 针对指定标讯与企业资质库进行智能匹配与初审对标
 */
export function matchQualificationsForTender(
  tender: {
    id: number;
    title: string;
    content?: string | null;
  },
  qualifications: CompanyQualificationItem[]
): TenderQualificationMatchAnalysis {
  const fullText = `${tender.title} ${tender.content || ""}`;
  const items: TenderQualificationMatchItem[] = [];

  let matchedCount = 0;
  let expiringCount = 0;
  let expiredCount = 0;
  let missingCount = 0;
  let estimatedBonusPoints = 0;

  for (const rule of RECOGNIZED_QUAL_RULES) {
    if (rule.patterns.test(fullText)) {
      const clauses = extractClauseContext(fullText, rule.patterns);

      // 在企业在库资质中寻找匹配的证书
      const foundCert = qualifications.find((q) => {
        return (
          q.name.toLowerCase().includes(rule.key.toLowerCase()) ||
          rule.patterns.test(q.name) ||
          (q.coverageScope && rule.patterns.test(q.coverageScope))
        );
      });

      if (foundCert) {
        if (foundCert.status === "EXPIRED") {
          expiredCount++;
          items.push({
            rule,
            detectedClauses: clauses,
            matchStatus: "MATCHED_EXPIRED",
            matchStatusLabel: "已过期失效 (严禁选送)",
            matchedCert: foundCert,
            riskMessage: `【高危废标红线】该证书已于 ${foundCert.expiryDate} 过期！千万不可装订入标书，否则评标委员会核验必按资格审查不合格一票否决！`,
            pointsEarned: 0,
          });
        } else if (foundCert.status === "EXPIRING_30") {
          expiringCount++;
          estimatedBonusPoints += rule.estimatedPoints;
          items.push({
            rule,
            detectedClauses: clauses,
            matchStatus: "MATCHED_EXPIRING",
            matchStatusLabel: "30天高危临期 (加急换证)",
            matchedCert: foundCert,
            riskMessage: `【临期预警】证书仅剩 ${foundCert.daysRemaining} 天到期！若本项目开标日在 ${foundCert.expiryDate} 之后，将构成失效废标，请立即办理续期或附带认证机构换证受理证明。`,
            pointsEarned: rule.estimatedPoints,
          });
        } else {
          matchedCount++;
          estimatedBonusPoints += rule.estimatedPoints;
          items.push({
            rule,
            detectedClauses: clauses,
            matchStatus: "MATCHED_VALID",
            matchStatusLabel: "完全符合且在有效期内",
            matchedCert: foundCert,
            riskMessage: foundCert.isAnnualInspectDue
              ? `【注意年审】该证书年度监督审核临期（剩 ${foundCert.annualInspectDaysRemaining} 天），请确保 CNCA 认证认可平台状态为“有效”而非“暂停”。`
              : undefined,
            pointsEarned: rule.estimatedPoints,
          });
        }
      } else {
        missingCount++;
        items.push({
          rule,
          detectedClauses: clauses,
          matchStatus: "MISSING",
          matchStatusLabel: "企业资质库缺失",
          riskMessage:
            rule.importance === "FATAL"
              ? "【一票否决项缺失】本项目对该项资质要求极高，若属资格门槛将导致废标，建议组建联合体投标或由具备资质的子公司作为投标主体！"
              : "【加分项缺失】企业暂无此项认证，将损失该项评分（预估减少 " + rule.estimatedPoints + " 分）。",
          pointsEarned: 0,
        });
      }
    }
  }

  // 综合拟合度与风险评级
  let overallQualificationFit: "EXCELLENT" | "SATISFACTORY" | "RISKY" | "FATAL_RISK" = "SATISFACTORY";
  let fitLabel = "资质基本满足";
  let fitBadgeColor = "bg-blue-50 text-blue-700 border-blue-200";
  let fitAdvice = "企业资质储备良好，可满足项目基础资格与部分加分要求。";

  const hasFatalMissing = items.some((i) => i.matchStatus === "MISSING" && i.rule.importance === "FATAL");

  if (expiredCount > 0 || hasFatalMissing) {
    overallQualificationFit = "FATAL_RISK";
    fitLabel = "一票否决高危废标";
    fitBadgeColor = "bg-rose-50 text-rose-700 border-rose-200";
    fitAdvice = "检测到致命资质短板或持有证书已过期！继续强行投标存在废标乃至不良行为通报风险，请务必核实资格条款。";
  } else if (missingCount > 0 || expiringCount > 0) {
    overallQualificationFit = "RISKY";
    fitLabel = "存在缺项或临期风险";
    fitBadgeColor = "bg-amber-50 text-amber-700 border-amber-200";
    fitAdvice = "存在部分资质缺项或临期换证风险，建议重点核对招标文件是否将其列为实质性不可偏离条款。";
  } else if (items.length > 0 && matchedCount === items.length) {
    overallQualificationFit = "EXCELLENT";
    fitLabel = "资质完美契合 (满分推荐)";
    fitBadgeColor = "bg-emerald-50 text-emerald-700 border-emerald-200";
    fitAdvice = "企业在库资质完全覆盖本项目要求的认证项且均在有效期内，商务资质加分项预计可获全额赋分！";
  } else {
    overallQualificationFit = "SATISFACTORY";
    fitLabel = "未检测到特殊门槛";
    fitBadgeColor = "bg-slate-50 text-slate-700 border-slate-200";
    fitAdvice = "本项目正文中未检测到强制性特殊资质要求，通常满足通用法人资格即可参与投标。";
  }

  return {
    tenderId: tender.id,
    tenderTitle: tender.title,
    totalRequired: items.length,
    matchedCount,
    expiringCount,
    expiredCount,
    missingCount,
    estimatedBonusPoints,
    overallQualificationFit,
    fitLabel,
    fitBadgeColor,
    fitAdvice,
    items,
    generatedAt: formatDate(new Date()),
  };
}

/**
 * 生成标准国标招投标文件附表格式《企业资质与资信证明材料汇总一览表》
 */
export function generateQualificationSummaryTable(
  qualifications: CompanyQualificationItem[],
  format: "markdown" | "html" = "markdown"
): string {
  if (format === "markdown") {
    let md = "| 序号 | 资质/证书全称 | 类别 | 证书编号 | 等级/级别 | 颁发机构 | 有效期截止日 | 状态与原件 |\n";
    md += "| --- | --- | --- | --- | --- | --- | --- | --- |\n";
    qualifications.forEach((q, idx) => {
      const proof = q.certFileUrl ? "具备扫描件" : "原件核对";
      md += `| ${idx + 1} | ${q.name} | ${q.categoryLabel} | ${q.certNo || "-"} | ${q.level || "合格"} | ${q.issuingAuthority || "-"} | ${q.expiryDate} | ${q.statusLabel} (${proof}) |\n`;
    });
    return md;
  }

  let html = `<table style="width:100%; border-collapse: collapse; font-family: 'SimSun', '宋体', serif; font-size: 14px; margin: 16px 0;">
  <thead>
    <tr style="background-color: #f2f4f7; border: 1px solid #333;">
      <th style="border: 1px solid #333; padding: 8px; text-align: center; width: 45px;">序号</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: left;">资质/证书全称</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: center; width: 100px;">证书类别</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: center; width: 140px;">证书编号</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: center; width: 80px;">等级/级别</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: left; width: 150px;">发证机关/机构</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: center; width: 100px;">有效期至</th>
      <th style="border: 1px solid #333; padding: 8px; text-align: center; width: 90px;">凭证状态</th>
    </tr>
  </thead>
  <tbody>\n`;

  qualifications.forEach((q, idx) => {
    html += `    <tr style="border: 1px solid #333;">
      <td style="border: 1px solid #333; padding: 6px; text-align: center;">${idx + 1}</td>
      <td style="border: 1px solid #333; padding: 6px; font-weight: bold;">${q.name}</td>
      <td style="border: 1px solid #333; padding: 6px; text-align: center;">${q.categoryLabel}</td>
      <td style="border: 1px solid #333; padding: 6px; text-align: center; font-family: monospace;">${q.certNo || "-"}</td>
      <td style="border: 1px solid #333; padding: 6px; text-align: center;">${q.level || "合格"}</td>
      <td style="border: 1px solid #333; padding: 6px;">${q.issuingAuthority || "-"}</td>
      <td style="border: 1px solid #333; padding: 6px; text-align: center;">${q.expiryDate}</td>
      <td style="border: 1px solid #333; padding: 6px; text-align: center;">${q.statusLabel}</td>
    </tr>\n`;
  });

  html += `  </tbody>
</table>`;
  return html;
}

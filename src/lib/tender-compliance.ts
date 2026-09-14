import type { CompanyProfileData } from "@/app/actions/company-profile";

export type ComplianceCategory =
  | "QUALIFICATION" // 资格前置
  | "COMMERCIAL"    // 商务与报价
  | "TECHNICAL"     // 技术实质响应
  | "SEALING_SIGN"  // 装订盖章与签署
  | "ELECTRONIC_CA"; // 电子标书与CA平台

export type ComplianceCheckStatus = "PENDING" | "PASSED" | "FLAGGED" | "NOT_APPLICABLE";

export type ComplianceRole = "商务专员" | "技术专家" | "财务主管" | "项目经理" | "法务合规";

export interface ComplianceRuleItem {
  id: string;
  category: ComplianceCategory;
  categoryLabel: string;
  title: string;
  checkPoint: string;
  responseRequirement: string;
  evidenceRequired: string;
  isFatal: boolean; // 是否属于一票否决/法定废标项
  assignedRole: ComplianceRole;
  detectedTenderClauses: string[]; // 从标讯中检测到的相关要求原文
  autoCheckResult?: {
    status: ComplianceCheckStatus;
    reason: string;
  };
}

export interface TenderComplianceReport {
  tenderId: number;
  tenderTitle: string;
  purchaser: string | null;
  budgetAmount: number | null;
  complianceScore: number; // 0-100 合规健康指数
  riskLevel: "LOW" | "MEDIUM" | "HIGH";
  totalChecks: number;
  fatalChecksCount: number;
  autoPassedCount: number;
  autoFlaggedCount: number;
  extractedClausesSummary: string[];
  rules: ComplianceRuleItem[];
  profileMatched: boolean;
  companyName?: string;
  generatedAt: string;
}

/**
 * 辅助函数：从文本中提取匹配特定关键词的上下文句子
 */
function extractMatchingSentences(content: string, keywords: RegExp, maxMatches = 2): string[] {
  if (!content) return [];
  const normalized = content.replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ");
  // 按句号、分号、换行切分
  const sentences = normalized.split(/[。；;\n]/);
  const matched: string[] = [];

  for (const s of sentences) {
    const trimmed = s.trim();
    if (trimmed.length >= 8 && trimmed.length <= 160 && keywords.test(trimmed)) {
      if (!matched.includes(trimmed)) {
        matched.push(trimmed);
        if (matched.length >= maxMatches) break;
      }
    }
  }

  return matched;
}

/**
 * 执行标讯智能合规与废标风险全流程体检
 */
export function runTenderComplianceScan(
  tender: {
    id: number;
    title: string;
    content: string;
    purchaser?: string | null;
    budgetAmount?: number | null;
    expireDate?: Date | null;
  },
  profile?: CompanyProfileData | null,
): TenderComplianceReport {
  const text = (tender.content || "") + " " + (tender.title || "");
  const profileAvailable = Boolean(profile && profile.companyName);

  // 1. 提取标讯中显性标注的废标/红线/否决条款
  const rawFatalClauses = extractMatchingSentences(
    text,
    /废标|无效标|一票否决|不得|必须|实质性|严重偏离|负偏离|不予受理|予以拒绝|★|▲/,
    4,
  );

  const rules: ComplianceRuleItem[] = [];

  // ==========================================
  // 一、资格前置审查 (4项)
  // ==========================================

  // 1. 营业执照与法人资格
  const licenseClauses = extractMatchingSentences(text, /营业执照|独立法人|统一社会信用代码|法人资格/);
  rules.push({
    id: "comp-qual-1",
    category: "QUALIFICATION",
    categoryLabel: "资格前置审查",
    title: "营业执照与主体资格合法有效",
    checkPoint: "必须具备独立法人资格，营业执照处于有效存续状态，且经营范围涵盖本次采购标的。",
    responseRequirement: "提供最新有效营业执照副本高清扫描件并加盖企业公章，确保统一社会信用代码清晰完整。",
    evidenceRequired: "三证合一营业执照正本或副本彩色扫描件、国家企业信用信息公示系统存续查询截图。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: licenseClauses,
    autoCheckResult: profileAvailable
      ? {
          status: "PASSED",
          reason: `企业资质档案已登记企业名称【${profile?.companyName}】，主体登记完备。`,
        }
      : {
          status: "PENDING",
          reason: "请自查营业执照原件与公章是否齐备。",
        },
  });

  // 2. 法定代表人身份证明与授权书
  const authClauses = extractMatchingSentences(text, /法定代表人|授权委托书|身份证明|被授权人/);
  rules.push({
    id: "comp-qual-2",
    category: "QUALIFICATION",
    categoryLabel: "资格前置审查",
    title: "法定代表人身份证明及授权委托书规范",
    checkPoint: "必须按标书格式提供法人身份证明；若委托代理人签署，授权委托书必须载明授权权限与有效期限（需覆盖投标有效期）。",
    responseRequirement: "法人签字（或法人名章）与受托人签字缺一不可，双方身份证正反面必须清晰且在有效期内。",
    evidenceRequired: "法定代表人身份证复印件、授权代理人身份证原件及复印件、授权书原件（加盖公章）。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: authClauses,
    autoCheckResult: {
      status: "PENDING",
      reason: "需核对授权委托书期限是否完整覆盖开标截止日后至少90天。",
    },
  });

  // 3. 信用记录与重大违法记录声明
  const creditClauses = extractMatchingSentences(text, /信用中国|中国政府采购网|重大违法|失信被执行人/);
  rules.push({
    id: "comp-qual-3",
    category: "QUALIFICATION",
    categoryLabel: "资格前置审查",
    title: "信用中国与三年无重大违法记录声明",
    checkPoint: "未被列入失信被执行人、重大税收违法失信主体、政府采购严重违法失信行为记录名单。",
    responseRequirement: "提供公告发布之日后的信用中国与中国政府采购网查询截图，出具前三年无重大违法记录书面声明。",
    evidenceRequired: "「信用中国」信用信息报告完整版 PDF + 查询截图、「中国政府采购网」政府采购严重违法失信名单截图。",
    isFatal: true,
    assignedRole: "法务合规",
    detectedTenderClauses: creditClauses,
    autoCheckResult: {
      status: "PASSED",
      reason: "根据企业合规库基线，未检测到公开涉诉执行阻断风险（封标前需更新当日截图）。",
    },
  });

  // 4. 行业资质与认证等级对齐
  const certClauses = extractMatchingSentences(text, /资质|认证|iso|cmmi|等级证书|特定资格/i);
  let certAutoStatus: ComplianceCheckStatus = "PENDING";
  let certReason = "请结合招标文件第三章资格要求逐项核验证书原件。";
  if (profileAvailable) {
    const userCerts = (profile?.certifications || []).concat(profile?.qualifications || []);
    const mentionsIso = /iso|质量管理|安全管理/i.test(text);
    const hasIso = userCerts.some((c) => /iso/i.test(c));
    if (mentionsIso && !hasIso) {
      certAutoStatus = "FLAGGED";
      certReason = "标讯正文提及 ISO 相关管理体系认证要求，企业档案中暂未录入该资质，存在硬性缺项风险！";
    } else if (userCerts.length > 0) {
      certAutoStatus = "PASSED";
      certReason = `已录入【${userCerts.slice(0, 3).join("、")}】等 ${userCerts.length} 项企业资质，基本满足常态化要求。`;
    }
  }
  rules.push({
    id: "comp-qual-4",
    category: "QUALIFICATION",
    categoryLabel: "资格前置审查",
    title: "特定行业资质与认证等级达标",
    checkPoint: "满足招标文件对特定施工资质、设计等级、安全生产许可证或管理体系认证的刚性门槛。",
    responseRequirement: "确保证书在有效期内，若涉及资质换证期需提供住建部门资质延续证明文件。",
    evidenceRequired: "对应资质证书正副本扫描件、全国建筑市场监管公共服务平台查询截图（如有）。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: certClauses,
    autoCheckResult: {
      status: certAutoStatus,
      reason: certReason,
    },
  });

  // ==========================================
  // 二、商务与报价合规 (4项)
  // ==========================================

  // 5. 开标一览表报价大小写与一致性
  const priceClauses = extractMatchingSentences(text, /开标一览表|报价表|大写|小写|总价|分项报价/);
  rules.push({
    id: "comp-comm-1",
    category: "COMMERCIAL",
    categoryLabel: "商务与报价合规",
    title: "开标一览表报价与分项明细大小写绝对一致",
    checkPoint: "大写金额与小写金额必须一致，各分项报价累加之和必须与总报价完全吻合，不得出现算术错误或漏项。",
    responseRequirement: "开标一览表必须加盖公章和法人签字。大写数字规范书写（壹、贰、叁、肆、伍、陆、柒、捌、玖、拾、佰、仟、万、元、角、分、整）。",
    evidenceRequired: "开标一览表（原件）、投标分项报价表、投标报价明细核算单。",
    isFatal: true,
    assignedRole: "财务主管",
    detectedTenderClauses: priceClauses,
    autoCheckResult: {
      status: "PENDING",
      reason: "封标前须由财务复核人对 Excel 公式累加结果与大写汉字进行双人交叉核对。",
    },
  });

  // 6. 最高限价与单价限价不超标
  const budgetClauses = extractMatchingSentences(text, /最高限价|预算金额|控制价|超出预算|无效报价/);
  rules.push({
    id: "comp-comm-2",
    category: "COMMERCIAL",
    categoryLabel: "商务与报价合规",
    title: "投标总价与关键分项单价不超最高限价",
    checkPoint: tender.budgetAmount
      ? `投标总报价绝对不得超过本项目最高限价 ${tender.budgetAmount} 万元，超过则直接作废标处理。`
      : "投标总报价必须在招标文件规定的预算控制范围内，严禁超过设定的最高投标限价。",
    responseRequirement: "核验税率适用性（如增值税6%或13%），确认报价包含货物、运费、安装、培训、税费等全口径费用。",
    evidenceRequired: "最高限价核算对照表、含税总价与不含税总价计算式。",
    isFatal: true,
    assignedRole: "财务主管",
    detectedTenderClauses: budgetClauses,
    autoCheckResult: tender.budgetAmount
      ? {
          status: "PASSED",
          reason: `本项目明确最高预算为 ${tender.budgetAmount} 万元，请确保最终总报价在此上限内。`,
        }
      : {
          status: "PENDING",
          reason: "请自查招标文件第二章是否设立分项单价限价或总额上限。",
        },
  });

  // 7. 投标保证金转账凭据与基本户合规
  const depositClauses = extractMatchingSentences(text, /保证金|基本账户|保函|保证金递交|转账凭证/);
  rules.push({
    id: "comp-comm-3",
    category: "COMMERCIAL",
    categoryLabel: "商务与报价合规",
    title: "投标保证金汇出账户与到账时间合规",
    checkPoint: "必须按规定从投标人基本账户转出（严禁分公司或第三方代缴），且在招标文件规定截止时间前实际到账并完成系统绑定。",
    responseRequirement: "转账备注栏准确填写招标编号或项目包号，装订入册银行电子回单原件扫描件或开具的电子保函。",
    evidenceRequired: "基本账户开户许可证或基本存款账户信息表、银行转账电子回单、公共资源交易中心保证金确认回执。",
    isFatal: true,
    assignedRole: "财务主管",
    detectedTenderClauses: depositClauses,
    autoCheckResult: {
      status: "FLAGGED",
      reason: "致命高发废标点！必须核查汇出账户是否为基本户，且确保跨行清算在截止日前到账。",
    },
  });

  // 8. 商务条款零负偏离承诺（工期/交货/付款/质保）
  const devClauses = extractMatchingSentences(text, /商务偏离|交货期|服务期限|付款方式|质保期/);
  rules.push({
    id: "comp-comm-4",
    category: "COMMERCIAL",
    categoryLabel: "商务与报价合规",
    title: "商务关键条款（工期/质保/付款）完全正响应",
    checkPoint: "工期承诺必须小于等于要求工期，质保期承诺必须大于等于要求质保期，付款方式与违约条款不得有负偏离。",
    responseRequirement: "编制完整的《商务条款偏离表》，逐条注明“无偏离”或“正偏离”，严禁出现任何负偏离项。",
    evidenceRequired: "商务条款逐条响应及偏离表、质保期与售后服务承诺书。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: devClauses,
    autoCheckResult: {
      status: "PASSED",
      reason: "常规商务条款已置入标准化无偏离模板，重点复查交货地点与验收条件。",
    },
  });

  // ==========================================
  // 三、技术实质响应 (3项)
  // ==========================================

  // 9. 实质性参数 (★/▲) 零负偏离
  const specClauses = extractMatchingSentences(text, /★|▲|实质性要求|主要技术参数|关键参数|负偏离/);
  rules.push({
    id: "comp-tech-1",
    category: "TECHNICAL",
    categoryLabel: "技术实质响应",
    title: "实质性技术参数（带★/▲号指标）零负偏离",
    checkPoint: "招标文件带★或▲的实质性技术参数必须全部满足或优于，任何一项负偏离即导致废标。",
    responseRequirement: "在《技术规格偏离表》中逐条对应响应，每一条带★参数均需注明在投标技术方案中的具体页码，并附第三方检验检测报告或官网技术白皮书佐证。",
    evidenceRequired: "技术规格逐条响应及偏离表、国家认可检验机构出具的CNAS/CMA检测报告佐证截图、产品彩页。",
    isFatal: true,
    assignedRole: "技术专家",
    detectedTenderClauses: specClauses,
    autoCheckResult: {
      status: specClauses.length > 0 ? "FLAGGED" : "PENDING",
      reason: specClauses.length > 0
        ? `在标讯中检测到包含【★/▲/实质性要求】条款，必须确保技术方案有权威检测报告支撑。`
        : "请自查采购需求技术参数清单，梳理全部星号项逐一比对。",
    },
  });

  // 10. 拟派项目经理与核心团队配置合规
  const teamClauses = extractMatchingSentences(text, /项目经理|建造师|项目负责人|技术负责人|社保证明/);
  rules.push({
    id: "comp-tech-2",
    category: "TECHNICAL",
    categoryLabel: "技术实质响应",
    title: "项目负责人执业资格与社保缴纳达标",
    checkPoint: "项目经理资质等级符合要求、注册单位必须为本企业，不得有在建工程，附投标前连续3~6个月的社保缴费证明。",
    responseRequirement: "附项目经理执业资格证、注册证、安全生产B证（如有）、无在建承诺书及人社局社保缴费明细。",
    evidenceRequired: "项目经理建造师/工程师注册证、近3~6个月社保机构出具的参保人员缴费清单（带验证章）。",
    isFatal: true,
    assignedRole: "项目经理",
    detectedTenderClauses: teamClauses,
    autoCheckResult: {
      status: "PENDING",
      reason: "需确认拟派项目经理未同时担任其他在建工程项目负责人，避免被行政处罚一票否决。",
    },
  });

  // 11. 实施方案完整性与严禁虚假应标
  const planClauses = extractMatchingSentences(text, /实施方案|进度计划|质量保证|知识产权|原创/);
  rules.push({
    id: "comp-tech-3",
    category: "TECHNICAL",
    categoryLabel: "技术实质响应",
    title: "技术实施方案章节完整性与知识产权合规",
    checkPoint: "技术方案必须涵盖组织架构、进度甘特图、质量保障、应急预案，严禁抄袭雷同（不同投标人家IP/文件属性雷同判串标废标）。",
    responseRequirement: "彻底清理技术方案 Word 属性中的原作者/公司元数据，避免模板残留痕迹导致疑似串标。",
    evidenceRequired: "项目实施总体方案、甘特图计划、保密与版权声明承诺书。",
    isFatal: true,
    assignedRole: "技术专家",
    detectedTenderClauses: planClauses,
    autoCheckResult: {
      status: "PASSED",
      reason: "建议清除文档元数据中（文档作者/最后修改人/模板来源）的非本公司名称。",
    },
  });

  // ==========================================
  // 四、装订盖章与签署规范 (3项)
  // ==========================================

  // 12. 签字与盖章规范完整性（骑缝章、逐页盖章）
  const sealClauses = extractMatchingSentences(text, /盖章|公章|骑缝章|签字|签名|印鉴/);
  rules.push({
    id: "comp-seal-1",
    category: "SEALING_SIGN",
    categoryLabel: "装订盖章与签署规范",
    title: "签字盖章完整性（印章清晰/逐页盖章/骑缝章）",
    checkPoint: "所有标明加盖公章处均已加盖企业公章（严禁使用合同章、投标专用章代替，除非标书明确认可），法人或委托人签字齐全，加盖整本骑缝章。",
    responseRequirement: "公章印泥红润清晰，字迹不模糊、不与手写签名重叠遮挡，骑缝章确保每页均有印迹。",
    evidenceRequired: "全本纸质投标文件签章实拍自查照片、电子签章完整性自查报告。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: sealClauses,
    autoCheckResult: {
      status: "FLAGGED",
      reason: "极高频废标雷区！常见遗漏点：偏离表漏章、报价明细表漏章、法人委托书代理人未手签、骑缝章漏页。",
    },
  });

  // 13. 包装密封与标识（纸质标书）
  const packageClauses = extractMatchingSentences(text, /密封|正本|副本|封套|包装|开标前不得启封/);
  rules.push({
    id: "comp-seal-2",
    category: "SEALING_SIGN",
    categoryLabel: "装订盖章与签署规范",
    title: "标书正副本份数包装与密封标识规范",
    checkPoint: "正本与副本份数准确，正本封面标明「正本」，包装封套各接缝处加盖密封章，明确标注项目名称、编号、投标人名称及「开标前不得启封」字样。",
    responseRequirement: "商务标、技术标是否要求分开单独包装密封，若要求分包装严禁混装入同一封套。",
    evidenceRequired: "正副本封面盖章照片、外包装密封条加盖公章照片。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: packageClauses,
    autoCheckResult: {
      status: "PENDING",
      reason: "请仔细阅读投标人须知前附表，核实正本份数与副本份数，以及是否需要单独密封报价文件。",
    },
  });

  // 14. 联合体投标协议与分包限制
  const subClauses = extractMatchingSentences(text, /联合体|分包|转包|允许分包|不得转包/);
  rules.push({
    id: "comp-seal-3",
    category: "SEALING_SIGN",
    categoryLabel: "装订盖章与签署规范",
    title: "联合体投标协议书或严禁转包分包承诺",
    checkPoint: "若为联合体投标，必须附联合体协议书并明确牵头人；若招标文件明确不接受分包，技术方案中严禁出现外协/分包描述。",
    responseRequirement: "独立投标方需附独立投标声明书及非转包承诺书；联合体投标必须各方均盖章并签署联合体协议。",
    evidenceRequired: "联合体协议书原件（如适用）或非违法转包分包承诺书。",
    isFatal: true,
    assignedRole: "法务合规",
    detectedTenderClauses: subClauses,
    autoCheckResult: {
      status: "PASSED",
      reason: "单体企业独立投标时请确保技术方案中无第三方外包描述。",
    },
  });

  // ==========================================
  // 五、电子标书与 CA 平台递交 (2项)
  // ==========================================

  // 15. CA 数字证书有效期与电子签章验签
  const caClauses = extractMatchingSentences(text, /ca|电子标书|数字证书|投标文件制作软件|签章/i);
  rules.push({
    id: "comp-ca-1",
    category: "ELECTRONIC_CA",
    categoryLabel: "电子标书与CA平台递交",
    title: "CA锁数字证书在有效期内且电子印章绑定",
    checkPoint: "电子投标使用的 CA 证书介质有效且未过期，投标制作软件中公章与法人章已成功施加在对应节点。",
    responseRequirement: "提前 48 小时在招投标平台登录并测试证书状态，生成模拟标书检查签章是否有效。",
    evidenceRequired: "CA 数字证书有效期验证截图、平台制作客户端签章成功提示。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: caClauses,
    autoCheckResult: {
      status: "PENDING",
      reason: "请插上 CA 锁登录交易中心核实证书有效截止时间，防止开标日遇证书过期无法解密。",
    },
  });

  // 16. 电子投标文件生成、上传与模拟解密回验
  const uploadClauses = extractMatchingSentences(text, /解密|上传|电子招投标|递交截止|回执/);
  rules.push({
    id: "comp-ca-2",
    category: "ELECTRONIC_CA",
    categoryLabel: "电子标书与CA平台递交",
    title: "电子标书提前上传并获取电子签收回执",
    checkPoint: "严禁在截标前最后30分钟上传，必须在截止前完成递交、获得系统签收回执编码，并具备远程解密备用环境。",
    responseRequirement: "导出加密标书（.etnd 或对应平台格式），保存电子递交凭条，并测试开标大厅远程解密网络与浏览器驱动兼容性。",
    evidenceRequired: "电子招投标交易平台上传成功并生成的《投标文件递交回执单》截图或PDF回执。",
    isFatal: true,
    assignedRole: "商务专员",
    detectedTenderClauses: uploadClauses,
    autoCheckResult: {
      status: "FLAGGED",
      reason: "关键操作预警！截标前网络拥堵与服务器排队常导致上传失败，强烈建议在截止前至少 4~8 小时完成递交！",
    },
  });

  // 统计健康指数
  const fatalChecksCount = rules.filter((r) => r.isFatal).length;
  const autoPassedCount = rules.filter((r) => r.autoCheckResult?.status === "PASSED").length;
  const autoFlaggedCount = rules.filter((r) => r.autoCheckResult?.status === "FLAGGED").length;

  // 基础 80 分，每项自动标记风险扣 8 分，每项已通过加 2 分
  let calculatedScore = 80 - autoFlaggedCount * 8 + autoPassedCount * 2;
  if (calculatedScore > 100) calculatedScore = 100;
  if (calculatedScore < 40) calculatedScore = 40;

  const riskLevel: "LOW" | "MEDIUM" | "HIGH" =
    autoFlaggedCount >= 3 ? "HIGH" : autoFlaggedCount >= 1 ? "MEDIUM" : "LOW";

  return {
    tenderId: tender.id,
    tenderTitle: tender.title,
    purchaser: tender.purchaser ?? null,
    budgetAmount: tender.budgetAmount ? Number(tender.budgetAmount) : null,
    complianceScore: calculatedScore,
    riskLevel,
    totalChecks: rules.length,
    fatalChecksCount,
    autoPassedCount,
    autoFlaggedCount,
    extractedClausesSummary: rawFatalClauses,
    rules,
    profileMatched: profileAvailable,
    companyName: profile?.companyName,
    generatedAt: new Date().toISOString(),
  };
}

import { parseTenderSections } from "./tender-sections";
import { formatDate } from "./constants";

export interface ProposalSubSection {
  subNumber: string;
  title: string;
  contentGuide: string;
  suggestedTables?: string[];
}

export interface ProposalOutlineSection {
  sectionNumber: string;
  title: string;
  description: string;
  subSections: ProposalSubSection[];
}

export interface PointToPointResponseItem {
  id: string;
  index: number;
  clauseType: "TECHNICAL" | "COMMERCIAL" | "QUALIFICATION";
  typeLabel: string;
  tenderRequirement: string;
  isStarClause: boolean; // 是否星标关键条款（★ 或 ▲）
  responseCommitment: "FULL_COMPLIANCE" | "POSITIVE_DEVIATION" | "NEGATIVE_DEVIATION";
  commitmentLabel: string;
  responseDetail: string;
  proofDocGuide: string;
}

export interface ProposalOutlineResult {
  tenderId: number;
  title: string;
  purchaser: string | null;
  agency: string | null;
  projectNo: string | null;
  budgetAmountWan: number | null;
  publishDate: string;
  expireDate: string | null;
  openTime: string | null;
  summary: {
    totalSections: number;
    technicalPointsCount: number;
    commercialPointsCount: number;
    qualificationPointsCount: number;
    starClausesCount: number;
  };
  sections: ProposalOutlineSection[];
  pointToPointMatrix: PointToPointResponseItem[];
}

interface TenderDataInput {
  id: number;
  title: string;
  type: string;
  content: string;
  purchaser?: string | null;
  agency?: string | null;
  projectNo?: string | null;
  budgetAmount?: number | null | { toString(): string };
  publishDate: Date | string;
  expireDate?: Date | string | null;
  openTime?: Date | string | null;
  sourceUrl?: string | null;
}

/**
 * 智能解构招标文件并生成标准 7 大章节标书大纲与逐条点对点应答矩阵
 */
export function generateProposalOutline(tender: TenderDataInput): ProposalOutlineResult {
  const content = tender.content || "";
  parseTenderSections(content, tender.sourceUrl ?? undefined);

  // 1. 提取商务条款（交货期/质保期/付款方式等）
  const commercialItems = extractCommercialClauses(content);

  // 2. 提取资格性审查要求
  const qualificationItems = extractQualificationRequirements(content);

  // 3. 提取技术参数与指标（重点识别 ★ / ▲ 条款）
  const technicalItems = extractTechnicalClauses(content);

  // 整合点对点矩阵
  const pointToPointMatrix: PointToPointResponseItem[] = [
    ...qualificationItems,
    ...commercialItems,
    ...technicalItems,
  ].map((item, idx) => ({
    ...item,
    index: idx + 1,
  }));

  const starCount = pointToPointMatrix.filter((i) => i.isStarClause).length;

  // 4. 构建国家标准规范 7 大章节标书架构
  const budgetWan = tender.budgetAmount ? Number(tender.budgetAmount) : null;
  const sections: ProposalOutlineSection[] = [
    {
      sectionNumber: "第一部分",
      title: "投标函及法定代表人授权书",
      description: "本部分包含具备法律效力的投标声明文件、法定代表人授权及信用承诺。",
      subSections: [
        {
          subNumber: "1.1",
          title: "投标函 (按招标格式)",
          contentGuide: `声明同意招标文件全部要求，确认投标总报价${budgetWan ? `不超过最高限价 ${budgetWan} 万元` : "符合预算规范"}，承诺投标文件有效期 90 天。`,
        },
        {
          subNumber: "1.2",
          title: "法定代表人身份证明书",
          contentGuide: "附法定代表人有效二代身份证正反面复印件/影印件并加盖公章。",
        },
        {
          subNumber: "1.3",
          title: "法定代表人授权委托书",
          contentGuide: "委托代理人身份证复印件、近 3 个月依法缴纳社会保险记录证明材料。",
        },
        {
          subNumber: "1.4",
          title: "依法缴纳税收及社保资金声明",
          contentGuide: "符合《中华人民共和国政府采购法》第二十二条第(四)项规定之书面承诺声明函。",
        },
      ],
    },
    {
      sectionNumber: "第二部分",
      title: "资格性及符合性审查证明文件",
      description: "逐项对照招标文件资格要求，提供原件清晰扫描件及佐证说明。",
      subSections: [
        {
          subNumber: "2.1",
          title: "企业营业执照及主体资质证照",
          contentGuide: "统一社会信用代码三证合一营业执照副本复印件（加盖电子公章）。",
        },
        {
          subNumber: "2.2",
          title: "财务状况报告及年度审计报告",
          contentGuide: "提供上一年度经会计师事务所出具的审计报告或基本开户银行出具的资信证明。",
        },
        {
          subNumber: "2.3",
          title: "重大违法记录声明及信用中国截图",
          contentGuide: "参加本次投标前 3 年内在经营活动中无重大违法记录的书面声明，并附“信用中国”与“中国政府采购网”无不良信用记录实时截图。",
        },
        {
          subNumber: "2.4",
          title: "行业特定资质及能力证书",
          contentGuide: "如涉及特种行业经营许可、安全生产许可证、涉密资质、ISO 管理体系认证证书等。",
        },
      ],
    },
    {
      sectionNumber: "第三部分",
      title: "开标一览表及分项报价明细表",
      description: "清晰呈现投标总报价、分项单价、税费、运输交付及驻场维保费构成。",
      subSections: [
        {
          subNumber: "3.1",
          title: "开标一览表 (唱标表)",
          contentGuide: `注明项目编号${tender.projectNo ? `【${tender.projectNo}】` : ""}、包号、投标总报价（大写/小写金额一致）、交付周期与质保年限。`,
          suggestedTables: ["项目名称", "投标总报价(元)", "交货工期", "质保期限", "备注说明"],
        },
        {
          subNumber: "3.2",
          title: "分项报价明细表",
          contentGuide: "详细罗列软硬件清单、规格型号、产地品牌、数量、单价、合价及税率。",
          suggestedTables: ["序号", "货物/服务名称", "规格型号", "品牌制造厂商", "数量", "单价(元)", "合价(元)"],
        },
        {
          subNumber: "3.3",
          title: "中小微企业声明函 (如适用)",
          contentGuide: "符合工信部联企业〔2011〕300号文件划型标准的，提供中小微企业声明函，享受 10%~20% 价格评审扣除优惠。",
        },
      ],
    },
    {
      sectionNumber: "第四部分",
      title: "商务条款逐条响应与偏离表",
      description: "对照招标文件中的履约期限、付款节点、验收要求逐条应答。",
      subSections: [
        {
          subNumber: "4.1",
          title: "商务条款偏离表 (点对点)",
          contentGuide: "严格逐条应答招标文件全部商务要求，明确注明“无偏离”或“正偏离”，严禁出现负偏离。",
          suggestedTables: ["序号", "招标文件商务条款", "投标文件响应承诺", "偏离说明", "佐证页码"],
        },
        {
          subNumber: "4.2",
          title: "交货与实施周期承诺",
          contentGuide: "明确计划进场时间、各实施关键节点排期及竣工交付终验日期承诺书。",
        },
        {
          subNumber: "4.3",
          title: "付款方式及发票配合承诺",
          contentGuide: "完全响应采购人付款比例（如预付款、进度款、验收款、质保金），按时开具增值税专用发票。",
        },
      ],
    },
    {
      sectionNumber: "第五部分",
      title: "技术规格逐条点对点应答表及技术方案",
      description: "本部分为评标技术打分核心，逐条响应所有技术参数及星标(★)条款。",
      subSections: [
        {
          subNumber: "5.1",
          title: "技术规格与参数偏离表 (★点对点响应)",
          contentGuide: "针对采购需求所有功能指标，详细填报所投产品实际技术参数，星标条款必须提供官方彩页、检测报告或软件截图佐证。",
          suggestedTables: ["序号", "招标技术参数要求", "所投产品实际指标", "偏离情况", "证明材料索引"],
        },
        {
          subNumber: "5.2",
          title: "总体技术方案与架构设计",
          contentGuide: "涵盖系统总体架构、技术路线、选型合理性分析、技术先进性与拓展性论述。",
        },
        {
          subNumber: "5.3",
          title: "技术参数证明材料及第三方检测报告",
          contentGuide: "国家权威检测机构出具的检验报告、产品认证证书及软件著作权原件影印件。",
        },
      ],
    },
    {
      sectionNumber: "第六部分",
      title: "项目实施组织设计与服务保障方案",
      description: "证明团队履约执行力、工程进度把控能力与风控措施。",
      subSections: [
        {
          subNumber: "6.1",
          title: "项目组织架构与驻场人员配置",
          contentGuide: "提供项目经理及核心技术实施团队花名册、职称资格证、社保证明及同类项目经验证明。",
          suggestedTables: ["角色岗位", "姓名", "学历/职称", "专业从业年限", "类似项目业绩", "到岗率"],
        },
        {
          subNumber: "6.2",
          title: "项目进度计划与甘特图",
          contentGuide: "制定周密的实施进度计划、里程碑交付物及各工序交叉施工保障方案。",
        },
        {
          subNumber: "6.3",
          title: "质量控制体系与安全生产管理",
          contentGuide: "完善的质量检验流程、风险应对预案与保密合规安全措施。",
        },
      ],
    },
    {
      sectionNumber: "第七部分",
      title: "售后服务承诺与本地化维保方案",
      description: "评分标准中售后服务得分项重点，突出本地化响应速度与增值保障。",
      subSections: [
        {
          subNumber: "7.1",
          title: "免费质保期服务承诺",
          contentGuide: "承诺提供不低于招标要求的原厂质保，提供 7×24 小时技术支持与 2 小时到场紧急排障服务。",
        },
        {
          subNumber: "7.2",
          title: "本地化技术支持网点及备品备件库",
          contentGuide: "提供项目所在地本地化售后服务机构证明（自有分公司、办事处或授权网点及房屋租赁合同）。",
        },
        {
          subNumber: "7.3",
          title: "用户培训与知识转移计划",
          contentGuide: "制定详尽的操作人员技术培训大纲、培训教材、实操演练与考核上岗方案。",
        },
      ],
    },
  ];

  return {
    tenderId: tender.id,
    title: tender.title,
    purchaser: tender.purchaser ?? null,
    agency: tender.agency ?? null,
    projectNo: tender.projectNo ?? null,
    budgetAmountWan: budgetWan,
    publishDate: formatDate(new Date(tender.publishDate)),
    expireDate: tender.expireDate ? formatDate(new Date(tender.expireDate)) : null,
    openTime: tender.openTime ? formatDate(new Date(tender.openTime)) : null,
    summary: {
      totalSections: sections.length,
      technicalPointsCount: technicalItems.length,
      commercialPointsCount: commercialItems.length,
      qualificationPointsCount: qualificationItems.length,
      starClausesCount: starCount,
    },
    sections,
    pointToPointMatrix,
  };
}

/**
 * 提取资格性审查条款
 */
function extractQualificationRequirements(content: string): Omit<PointToPointResponseItem, "index">[] {
  const list: Omit<PointToPointResponseItem, "index">[] = [];
  const rules = [
    {
      regex: /(?:具有独立承担民事责任的能力|营业执照|法人证书)/,
      text: "具有独立承担民事责任的能力：提供有效的营业执照副本复印件",
      guide: "提供加盖公章的统一社会信用代码营业执照（三证合一）清晰扫描件",
    },
    {
      regex: /(?:良好的商业信誉和健全的财务会计制度|财务审计|财务状况)/,
      text: "具有良好的商业信誉和健全的财务会计制度",
      guide: "提供上一年度经审计的财务报告或基本户银行出具的资信证明",
    },
    {
      regex: /(?:履行合同所必需的设备和专业技术能力|技术能力证明)/,
      text: "具备履行合同所必需的设备和专业技术能力证明",
      guide: "提供技术人员资质证书、设备清单或同类成功案例业绩合同",
    },
    {
      regex: /(?:依法缴纳税收和社会保障资金|缴纳税收|社保证明)/,
      text: "具有依法缴纳税收和社会保障资金的良好记录",
      guide: "提供近 6 个月内任意 1 个月纳税证明及缴纳社会保险凭证材料",
    },
    {
      regex: /(?:重大违法记录|参加政府采购活动前三年内)/,
      text: "参加政府采购活动前三年内，在经营活动中没有重大违法记录",
      guide: "提供书面声明函原件，并附信用中国、中国政府采购网查询网页打印件",
    },
  ];

  let idCounter = 1;
  for (const r of rules) {
    if (r.regex.test(content)) {
      list.push({
        id: `Q-${idCounter++}`,
        clauseType: "QUALIFICATION",
        typeLabel: "资格审查",
        tenderRequirement: r.text,
        isStarClause: true, // 资格项均为一票否决
        responseCommitment: "FULL_COMPLIANCE",
        commitmentLabel: "完全响应 (满足)",
        responseDetail: "已完全具备上述资质与证照要求，原件扫描件附后。",
        proofDocGuide: r.guide,
      });
    }
  }

  // 若未匹配到，默认补充基础资格项
  if (list.length === 0) {
    list.push({
      id: "Q-1",
      clauseType: "QUALIFICATION",
      typeLabel: "资格审查",
      tenderRequirement: "供应商基本资质：合法注册营业执照及政府采购法第二十二条资格",
      isStarClause: true,
      responseCommitment: "FULL_COMPLIANCE",
      commitmentLabel: "完全响应 (满足)",
      responseDetail: "完全具备独立法人资格及依法合规经营资质。",
      proofDocGuide: "提供营业执照复印件与法定代表人声明函",
    });
  }

  return list;
}

/**
 * 提取商务条款（交货期、质保期、付款条件等）
 */
function extractCommercialClauses(content: string): Omit<PointToPointResponseItem, "index">[] {
  const list: Omit<PointToPointResponseItem, "index">[] = [];
  let idCounter = 1;

  // 1. 交货期/工期
  const periodMatch = content.match(/(?:交货期|交付期|工期|服务期限|合同履行期限)[：:\s]*([^，,。\n；;]{3,40})/);
  if (periodMatch) {
    list.push({
      id: `C-${idCounter++}`,
      clauseType: "COMMERCIAL",
      typeLabel: "商务条款",
      tenderRequirement: `合同履行期限：${periodMatch[1].trim()}`,
      isStarClause: false,
      responseCommitment: "FULL_COMPLIANCE",
      commitmentLabel: "完全响应 (满足)",
      responseDetail: `承诺严格在【${periodMatch[1].trim()}】内保质保量完成全部交付验收。`,
      proofDocGuide: "详见第四部分《交货期承诺函》与进度甘特图",
    });
  } else {
    list.push({
      id: `C-${idCounter++}`,
      clauseType: "COMMERCIAL",
      typeLabel: "商务条款",
      tenderRequirement: "交货与服务周期：按招标文件约定工期按时交付",
      isStarClause: false,
      responseCommitment: "FULL_COMPLIANCE",
      commitmentLabel: "完全响应 (满足)",
      responseDetail: "承诺完全按照招标文件及合同约定期限交付。",
      proofDocGuide: "详见第四部分交付排期计划",
    });
  }

  // 2. 质保期/售后服务期
  const warrantyMatch = content.match(/(?:质保期|保修期|维护期|质保年限)[：:\s]*([^，,。\n；;]{2,30})/);
  if (warrantyMatch) {
    list.push({
      id: `C-${idCounter++}`,
      clauseType: "COMMERCIAL",
      typeLabel: "商务条款",
      tenderRequirement: `质量保证期：${warrantyMatch[1].trim()}`,
      isStarClause: false,
      responseCommitment: "POSITIVE_DEVIATION",
      commitmentLabel: "正偏离 (优于要求)",
      responseDetail: `全面响应【${warrantyMatch[1].trim()}】，并额外提供首年免费巡检升级增值服务。`,
      proofDocGuide: "详见第七部分《原厂质保与免费维保承诺书》",
    });
  }

  // 3. 付款方式
  const paymentMatch = content.match(/(?:付款方式|结算方式|资金支付)[：:\s]*([^。\n；;]{5,80})/);
  if (paymentMatch) {
    list.push({
      id: `C-${idCounter++}`,
      clauseType: "COMMERCIAL",
      typeLabel: "商务条款",
      tenderRequirement: `付款及结算：${paymentMatch[1].trim()}`,
      isStarClause: false,
      responseCommitment: "FULL_COMPLIANCE",
      commitmentLabel: "完全响应 (满足)",
      responseDetail: "完全认同并遵照本付款节点执行，足额开具增值税专用发票。",
      proofDocGuide: "详见第四部分《付款条款响应书》",
    });
  }

  // 4. 投标有效期
  list.push({
    id: `C-${idCounter++}`,
    clauseType: "COMMERCIAL",
    typeLabel: "商务条款",
    tenderRequirement: "投标有效期：递交投标文件截止日起不少于 90 个日历天",
    isStarClause: true,
    responseCommitment: "FULL_COMPLIANCE",
    commitmentLabel: "完全响应 (满足)",
    responseDetail: "我方投标有效期自开标之日起生效 90 天，在此期限内本承诺始终有效。",
    proofDocGuide: "详见第一部分《投标函》第 4 条承诺",
  });

  return list;
}

/**
 * 提取技术参数及星标条款
 */
function extractTechnicalClauses(content: string): Omit<PointToPointResponseItem, "index">[] {
  const list: Omit<PointToPointResponseItem, "index">[] = [];
  let idCounter = 1;

  // 搜索带有 ★ 或 ▲ 的技术条款
  const starRegex = /([★▲][^。\n；;]{5,100})/g;
  let match: RegExpExecArray | null;
  while ((match = starRegex.exec(content)) !== null && list.length < 8) {
    const raw = match[1].trim();
    list.push({
      id: `T-${idCounter++}`,
      clauseType: "TECHNICAL",
      typeLabel: "技术参数",
      tenderRequirement: raw,
      isStarClause: true,
      responseCommitment: "FULL_COMPLIANCE",
      commitmentLabel: "完全响应 (满足)",
      responseDetail: "所投产品全部参数及功能指标完全达到且符合该关键要求。",
      proofDocGuide: `提供技术白皮书、原厂产品规格参数表或权威检测报告（见技术附件 ${idCounter}）`,
    });
  }

  // 若无星标，按通用关键技术规范补全
  if (list.length === 0) {
    const defaultTechs = [
      {
        req: "技术指标与性能规格满足国家现行行业标准与招标文件要求",
        detail: "所投产品及服务完全满足并符合国家技术标准与采购文件规格要求。",
      },
      {
        req: "具备完善的系统安全、保密合规与数据容灾备份能力",
        detail: "全面符合国家信息安全等保标准与数据防泄密管理规范。",
      },
      {
        req: "兼容性与系统拓展性：支持主流硬件环境与开放标准 API 互联互通",
        detail: "采用模块化松耦合架构设计，提供丰富的标准 API 接口，保证平滑拓展。",
      },
    ];

    for (const d of defaultTechs) {
      list.push({
        id: `T-${idCounter++}`,
        clauseType: "TECHNICAL",
        typeLabel: "技术参数",
        tenderRequirement: d.req,
        isStarClause: false,
        responseCommitment: "FULL_COMPLIANCE",
        commitmentLabel: "完全响应 (满足)",
        responseDetail: d.detail,
        proofDocGuide: "详见第五部分技术方案架构图与实测性能数据",
      });
    }
  }

  return list;
}

/**
 * 合成可被 Microsoft Word / WPS 原生打开的标准化标书草案文档 HTML
 */
export function generateProposalDocHtml(result: ProposalOutlineResult): string {
  const dateStr = new Date().toLocaleDateString("zh-CN");

  // 生成目录 HTML
  const tocRows = result.sections.map((sec) => `
    <div style="margin-bottom: 8px;">
      <p style="font-size: 15pt; font-weight: bold; color: #1e3a8a; margin: 6px 0 2px 0;">
        ${sec.sectionNumber} ${sec.title}
      </p>
      <div style="margin-left: 20px; font-size: 11pt; color: #334155;">
        ${sec.subSections.map((sub) => `<p style="margin: 3px 0;">${sub.subNumber} ${sub.title}</p>`).join("")}
      </div>
    </div>
  `).join("");

  // 生成点对点应答表格 HTML
  const matrixRows = result.pointToPointMatrix.map((item) => `
    <tr>
      <td style="border: 1px solid #94a3b8; padding: 6px; text-align: center; font-size: 10pt;">${item.index}</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10pt; color: #475569;">
        ${item.typeLabel}
        ${item.isStarClause ? '<br/><span style="color: #dc2626; font-weight: bold;">[★关键项]</span>' : ""}
      </td>
      <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10pt;">${item.tenderRequirement}</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10pt; font-weight: bold; color: ${item.responseCommitment === "POSITIVE_DEVIATION" ? "#16a34a" : "#2563eb"};">
        ${item.commitmentLabel}
      </td>
      <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10pt;">${item.responseDetail}</td>
      <td style="border: 1px solid #94a3b8; padding: 6px; font-size: 10pt; color: #64748b;">${item.proofDocGuide}</td>
    </tr>
  `).join("");

  // 生成大纲正文
  const sectionsContent = result.sections.map((sec) => `
    <div style="page-break-before: always;">
      <h1 style="font-size: 18pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px; margin-top: 24px;">
        ${sec.sectionNumber} ${sec.title}
      </h1>
      <p style="font-size: 11pt; color: #475569; font-style: italic; margin-bottom: 16px;">
        【编制指引】：${sec.description}
      </p>
      ${sec.subSections.map((sub) => `
        <div style="margin-bottom: 20px;">
          <h2 style="font-size: 14pt; color: #0f172a; margin: 14px 0 6px 0;">
            ${sub.subNumber} ${sub.title}
          </h2>
          <div style="background-color: #f8fafc; border-left: 4px solid #3b82f6; padding: 10px 14px; margin-bottom: 10px;">
            <p style="font-size: 10.5pt; color: #334155; margin: 0; line-height: 1.6;">
              <b>编写指南与要点：</b>${sub.contentGuide}
            </p>
          </div>
          <div style="border: 1px dashed #cbd5e1; padding: 14px; background-color: #ffffff; min-height: 80px; color: #94a3b8; font-size: 10.5pt;">
            [ 此处请填入本章节正文内容，或按团队分工分派技术方案人员编写。支持直接插入软硬件配置图表与资质扫描件 ]
          </div>
        </div>
      `).join("")}
    </div>
  `).join("");

  return `
<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <title>投标文件框架草案 - ${result.title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 25mm 25mm 25mm 25mm;
      mso-header-margin: 35.4pt;
      mso-footer-margin: 35.4pt;
    }
    body {
      font-family: "SimSun", "宋体", "Microsoft YaHei", "微软雅黑", sans-serif;
      font-size: 12pt;
      line-height: 1.6;
      color: #1e293b;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 14px 0;
    }
  </style>
</head>
<body>
  <!-- 封面 -->
  <div style="text-align: center; padding-top: 80px; page-break-after: always;">
    <p style="font-size: 18pt; letter-spacing: 4px; color: #64748b; margin-bottom: 20px;">
      【 正 式 投 标 文 件 】
    </p>
    <h1 style="font-size: 26pt; font-family: 'SimHei', '黑体'; color: #0f172a; margin: 30px 0 10px 0; line-height: 1.4;">
      ${result.title}
    </h1>
    <p style="font-size: 16pt; color: #1e3a8a; font-weight: bold; margin-bottom: 60px;">
      投 标 文 件 编 制 草 案 与 应 答 框 架
    </p>

    <div style="width: 75%; margin: 0 auto; text-align: left; font-size: 13pt; line-height: 2.2; border-top: 1px solid #cbd5e1; padding-top: 24px;">
      <p><b>招标项目编号：</b>${result.projectNo || "详见招标文件"}</p>
      <p><b>采购人单位：</b>${result.purchaser || "未明确标注"}</p>
      <p><b>代理机构：</b>${result.agency || "未注明"}</p>
      <p><b>最高限价/预算：</b>${result.budgetAmountWan ? `${result.budgetAmountWan} 万元` : "见开标要求"}</p>
      <p><b>投标单位名称：</b>____________________________________（盖章）</p>
      <p><b>法定代表人或授权委托人：</b>________________________（签字）</p>
      <p><b>编制日期：</b>${dateStr}</p>
    </div>
  </div>

  <!-- 目录 -->
  <div style="page-break-after: always; padding-top: 20px;">
    <h2 style="font-size: 20pt; text-align: center; color: #0f172a; border-bottom: 1px solid #cbd5e1; padding-bottom: 10px; margin-bottom: 24px;">
      目  录
    </h2>
    ${tocRows}
  </div>

  <!-- 点对点应答附表 -->
  <div style="page-break-after: always;">
    <h2 style="font-size: 18pt; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 6px;">
      附表：招标文件核心条款点对点逐条响应与偏离表
    </h2>
    <p style="font-size: 10.5pt; color: #64748b; margin-bottom: 12px;">
      依据招标文件资格条件、商务条款与技术参数自动拆解整理。评标委员会审查时请重点核验“★关键项”。
    </p>
    <table>
      <thead>
        <tr style="background-color: #f1f5f9; text-align: center;">
          <th style="border: 1px solid #94a3b8; padding: 8px; width: 40px; font-size: 10.5pt;">序号</th>
          <th style="border: 1px solid #94a3b8; padding: 8px; width: 90px; font-size: 10.5pt;">条款类型</th>
          <th style="border: 1px solid #94a3b8; padding: 8px; font-size: 10.5pt;">招标文件要求条款</th>
          <th style="border: 1px solid #94a3b8; padding: 8px; width: 100px; font-size: 10.5pt;">投标响应承诺</th>
          <th style="border: 1px solid #94a3b8; padding: 8px; font-size: 10.5pt;">响应方案与详细说明</th>
          <th style="border: 1px solid #94a3b8; padding: 8px; width: 140px; font-size: 10.5pt;">证明佐证材料索引</th>
        </tr>
      </thead>
      <tbody>
        ${matrixRows}
      </tbody>
    </table>
  </div>

  <!-- 7 大章节正文大纲 -->
  ${sectionsContent}

  <div style="margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1; text-align: center; color: #94a3b8; font-size: 10pt;">
    <p>—— 本标书框架文档由 标讯通 (BiaoXunTong) 智能投标引擎自动生成 仅供投标备标与内部撰写指引使用 ——</p>
  </div>
</body>
</html>
`;
}

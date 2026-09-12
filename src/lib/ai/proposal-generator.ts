export interface ProposalOutlineSection {
  title: string;
  items: string[];
}

export interface ProposalOutline {
  businessPart: ProposalOutlineSection[];
  technicalPart: ProposalOutlineSection[];
  pricingPart: ProposalOutlineSection[];
}

export interface ComplianceMatrixItem {
  id: string;
  category: "资格条件" | "商务响应" | "技术规格" | "实质性条款" | "装订密封";
  requirement: string;
  responseStrategy: string;
  evidenceRequired: string;
  isFatal: boolean;
  assignedRole: "商务人员" | "技术专家" | "财务主管" | "项目经理";
}

export interface PreSubmissionCheckItem {
  id: string;
  item: string;
  checkPoint: string;
  critical: boolean;
}

export interface ProposalKitData {
  projectName: string;
  projectNo: string | null;
  outline: ProposalOutline;
  complianceMatrix: ComplianceMatrixItem[];
  preSubmissionChecks: PreSubmissionCheckItem[];
  generatedAt: string;
}

export function generateProposalKit(tender: {
  title: string;
  content: string;
  projectNo?: string | null;
  purchaser?: string | null;
  budgetAmount?: number | null;
  openTime?: Date | null;
  expireDate?: Date | null;
}): ProposalKitData {
  const text = (tender.content || "") + " " + (tender.title || "");

  // 1. 提炼资格审查与合规矩阵条目
  const complianceMatrix: ComplianceMatrixItem[] = [];

  // 条目 1：营业执照与法人资格
  complianceMatrix.push({
    id: "cm-1",
    category: "资格条件",
    requirement: "具备独立法人资格，具有合法有效的营业执照及统一社会信用代码",
    responseStrategy: "提供最新清晰版三证合一营业执照副本原件彩色扫描件，加盖公章",
    evidenceRequired: "营业执照副本复印件/扫描件、国家企业信用信息公示系统查询截图",
    isFatal: true,
    assignedRole: "商务人员",
  });

  // 条目 2：法定代表人授权委托
  complianceMatrix.push({
    id: "cm-2",
    category: "资格条件",
    requirement: "法定代表人身份证明书及法定代表人授权委托书（若委托代理人签署）",
    responseStrategy: "严格按照招标文件标准格式填写，法定代表人与被授权人签字并贴附双方身份证复印件",
    evidenceRequired: "法定代表人身份证复印件、授权代理人身份证原件复印件及近3个月社保证明",
    isFatal: true,
    assignedRole: "商务人员",
  });

  // 条目 3：特定资质或行业许可
  if (/资质|许可证|认证|体系认证|医疗器械|系统集成|施工资质/.test(text)) {
    const certMatch = text.match(/(?:具备|具有|要求)([^。；;\n\r]{4,30}(?:资质|许可|证书|认证))/);
    complianceMatrix.push({
      id: "cm-3",
      category: "资格条件",
      requirement: certMatch ? certMatch[1].trim() : "具备行业相关主管部门颁发的资质许可证书",
      responseStrategy: "提供在有效期内的证书原件彩色复印件并加盖公章，确保年检合格且在国家认监委或发证机构可查",
      evidenceRequired: "相关资质许可证书全本扫描件、官方查验平台状态截图",
      isFatal: true,
      assignedRole: "商务人员",
    });
  }

  // 条目 4：财务状况报告与审计
  complianceMatrix.push({
    id: "cm-4",
    category: "资格条件",
    requirement: "具有健全的财务会计制度，提供经会计师事务所审计的年度财务审计报告或银行资信证明",
    responseStrategy: "提供上一年度经审计的财务报告（含资产负债表、利润表、现金流量表、附注及事务所章）",
    evidenceRequired: "年度审计报告扫描件或开标前3个月内基本户银行开具的资信证明原件",
    isFatal: false,
    assignedRole: "财务主管",
  });

  // 条目 5：纳税与社保缴纳凭据
  complianceMatrix.push({
    id: "cm-5",
    category: "资格条件",
    requirement: "具有依法缴纳税收和社会保障资金的良好记录（提供近期的纳税及社保凭据）",
    responseStrategy: "提供近半年内任意连续3个月的完税证明与社保缴费凭据，若依法免税免社保需附官方证明",
    evidenceRequired: "税务机关电子缴税凭证、社保局盖章的社保参保缴费明细表",
    isFatal: true,
    assignedRole: "财务主管",
  });

  // 条目 6：重大违法记录与信用中国声明
  complianceMatrix.push({
    id: "cm-6",
    category: "实质性条款",
    requirement: "参加采购活动前3年内，在经营活动中没有重大违法记录；未被列入失信被执行人或政府采购严重违法失信行为记录名单",
    responseStrategy: "填写无重大违法记录书面声明函，并在开标日前从「信用中国」与「中国政府采购网」截屏查验证据",
    evidenceRequired: "信用中国 (www.creditchina.gov.cn) 报告、中国政府采购网查询网页全幅打印截图",
    isFatal: true,
    assignedRole: "商务人员",
  });

  // 条目 7：投标保证金 / 保函
  if (/投标保证金|保证金|保函/.test(text)) {
    complianceMatrix.push({
      id: "cm-7",
      category: "商务响应",
      requirement: "按招标文件规定金额与截止时间足额缴纳投标保证金或出具电子投标保函",
      responseStrategy: "务必从投标人基本户转出，备注项目编号与包号，确保开标前到账并打印银行回单",
      evidenceRequired: "银行转账汇款电子回单或银行电子保函正本扫描件",
      isFatal: true,
      assignedRole: "财务主管",
    });
  }

  // 条目 8：同类项目成功业绩
  if (/业绩|合同|案例|类似项目/.test(text)) {
    complianceMatrix.push({
      id: "cm-8",
      category: "商务响应",
      requirement: "近三年具有同类项目实施成功业绩（需提供合同关键页及验收证明）",
      responseStrategy: "精选3-5份金额、内容最为匹配的中标项目合同，合同首页、金额页、签字盖章页齐全",
      evidenceRequired: "合同复印件、中标通知书、用户验收报告或回访好评表",
      isFatal: false,
      assignedRole: "商务人员",
    });
  }

  // 条目 9：技术规格响应与偏离
  complianceMatrix.push({
    id: "cm-9",
    category: "技术规格",
    requirement: "满足招标文件全部技术参数与功能要求，实质性指标（带★号项）不得负偏离",
    responseStrategy: "逐条对照招标需求书编写《技术规格及参数偏离表》，重点标注关键正偏离优势，绝无负偏离",
    evidenceRequired: "技术规格偏离表、原厂技术白皮书、官方彩页或权威机构检测报告",
    isFatal: true,
    assignedRole: "技术专家",
  });

  // 条目 10：售后服务体系与服务响应承诺
  complianceMatrix.push({
    id: "cm-10",
    category: "技术规格",
    requirement: "具备完备的售后服务团队、应急响应预案及本地化服务支撑能力",
    responseStrategy: "制定详细的 7×24 小时技术支持方案，承诺 15 分钟响应、2 小时到场排障，并配置备品备件库",
    evidenceRequired: "售后服务承诺函、本地服务网点证明、常驻技术支持人员名单及联系电话",
    isFatal: false,
    assignedRole: "项目经理",
  });

  // 条目 11：工期与交付保障
  complianceMatrix.push({
    id: "cm-11",
    category: "商务响应",
    requirement: "响应招标文件的交付期限、实施周期及验收节点进度要求",
    responseStrategy: "按期或适度提前承诺工期，制定精确到周/天的实施进度横道图与里程碑控制点",
    evidenceRequired: "实施交付进度计划表、项目团队排班表、交付风险防范预案",
    isFatal: false,
    assignedRole: "项目经理",
  });

  // 条目 12：投标报价与不平衡报价防范
  complianceMatrix.push({
    id: "cm-12",
    category: "实质性条款",
    requirement: tender.budgetAmount
      ? `投标总报价不得超过最高限价（预算金额 ${tender.budgetAmount} 万元），否则作无效标处理`
      : "投标总报价必须合理合规，严禁低于成本恶性竞争，开标一览表与明细汇总必须一致",
    responseStrategy: "严格核算分项明细单价乘积与总价，确保开标一览表大写金额与小写金额、明细表绝对一致",
    evidenceRequired: "开标一览表、分项报价明细表、主营成本核算单",
    isFatal: true,
    assignedRole: "商务人员",
  });

  // 2. 投标文件标准编制大纲 (Proposal Outline)
  const businessPart: ProposalOutlineSection[] = [
    {
      title: "第一章 投标函及相关授权文件",
      items: [
        "1.1 投标函（按招标文件规定格式，注明项目名称、编号、投标总价）",
        "1.2 法定代表人身份证明书（附法人身份证正反面复印件）",
        "1.3 法定代表人授权委托书（附授权代表身份证正反面及授权权限声明）",
        "1.4 投标保证金提交凭证（银行转账回单或电子保函正本）",
      ],
    },
    {
      title: "第二章 资格审查证明文件",
      items: [
        "2.1 营业执照副本、税务登记证、组织机构代码证（三证合一）",
        "2.2 资质证书及安全生产/行业经营许可证扫描件",
        "2.3 经审计的上一年度财务会计报告或银行资信证明",
        "2.4 近期依法缴纳税收和社保资金的有效凭据",
        "2.5 参加采购活动近3年内无重大违法记录的书面声明函",
        "2.6 「信用中国」及「中国政府采购网」信用记录查询网页截图",
      ],
    },
    {
      title: "第三章 商务响应及业绩证明",
      items: [
        "3.1 商务条款逐条响应及偏离表（交货期、交货地点、付款方式、质保期等）",
        "3.2 近三年同类项目成功业绩汇总表（附中标通知书与合同关键页）",
        "3.3 企业综合实力、履约信誉评价与客户表扬信/验收报告",
        "3.4 供应商廉政及反商业贿赂承诺书",
      ],
    },
  ];

  const technicalPart: ProposalOutlineSection[] = [
    {
      title: "第四章 项目总体理解与技术实施方案",
      items: [
        "4.1 项目背景分析、业务目标理解与总体建设思路",
        "4.2 系统总体技术架构设计与核心业务流程梳理",
        "4.3 软硬件配置清单与详细技术规格参数逐条响应表（标记正偏离）",
        "4.4 关键技术难点分析与针对性解决技术方案",
      ],
    },
    {
      title: "第五章 项目组织机构与拟派团队骨干",
      items: [
        "5.1 项目实施组织架构设置与各岗位职责分工",
        "5.2 项目经理综合资历、执业证书（PMP/软考）及类似成功项目管理经验",
        "5.3 核心技术骨干人员名单、学历证明、职称证书与社保证明",
      ],
    },
    {
      title: "第六章 项目进度计划与质量安全管理",
      items: [
        "6.1 项目整体实施推进甘特图与关键里程碑节点控制计划",
        "6.2 质量保证体系标准、质量控制流程及测试验收规范",
        "6.3 安全生产保障机制、保密措施与突发应急响应预案",
      ],
    },
    {
      title: "第七章 培训与售后服务承诺体系",
      items: [
        "7.1 用户培训方案（培训课程大纲、培训课时、教材编制与考核办法）",
        "7.2 质保期内售后维保服务体系与 7×24 小时响应机制",
        "7.3 本地化常驻技术支持团队配备与备品备件保障库",
      ],
    },
  ];

  const pricingPart: ProposalOutlineSection[] = [
    {
      title: "第八章 投标报价文件",
      items: [
        "8.1 开标一览表（按标段/包号填报，大小写金额完全一致）",
        "8.2 投标分项报价明细清单（设备购置、软件研发、集成服务、运维费用等）",
        "8.3 货物及设备单价分析表与耗材明细表",
        "8.4 报价合理性说明及优惠条款承诺（如有）",
      ],
    },
  ];

  // 3. 封标前 10 项致命避坑检查清单 (Pre-submission Checklist)
  const preSubmissionChecks: PreSubmissionCheckItem[] = [
    {
      id: "chk-1",
      item: "签字盖章完整性",
      checkPoint: "检查投标函、授权委托书、报价表、偏离表及骑缝是否均已加盖公章与法人签字（严禁漏盖或公章模糊）",
      critical: true,
    },
    {
      id: "chk-2",
      item: "报价金额一致性",
      checkPoint: "开标一览表大写金额与小写金额必须一致，分项明细累加值与总报价必须分毫不差",
      critical: true,
    },
    {
      id: "chk-3",
      item: "预算超限核查",
      checkPoint: tender.budgetAmount
        ? `确认投标总价绝对不得超过最高限价 ${tender.budgetAmount} 万元`
        : "确认无负偏离或超出招标限价的违规项",
      critical: true,
    },
    {
      id: "chk-4",
      item: "投标保证金到账",
      checkPoint: "确认投标保证金已从基本户汇出且在截止时间前到账，装订页附转账回单复印件",
      critical: true,
    },
    {
      id: "chk-5",
      item: "被授权人身份证原件",
      checkPoint: "若现场开标，确认法定代表人授权代理人随身携带二代身份证原件及授权书原件备查",
      critical: true,
    },
    {
      id: "chk-6",
      item: "正副本份数与标识",
      checkPoint: "按要求打印对应份数（如正本1份，副本4份），并在封面清晰标明「正本」或「副本」字样",
      critical: true,
    },
    {
      id: "chk-7",
      item: "电子版介质（U盘）",
      checkPoint: "若需提供电子标书 U 盘，确保 U 盘内已存入正本 PDF 与 Word 版本，无病毒且已贴上项目标签",
      critical: false,
    },
    {
      id: "chk-8",
      item: "封套密封与封签盖章",
      checkPoint: "外层包装完好密封，封口处粘贴密封条并加盖单位公章及法人章，密封标识注明项目名称及编号",
      critical: true,
    },
    {
      id: "chk-9",
      item: "资质与业绩有效期",
      checkPoint: "核实营业执照、所有资质证书、人员证件在开标当日均处于有效状态，无过期失效证件",
      critical: true,
    },
    {
      id: "chk-10",
      item: "递交截止时间准点",
      checkPoint: tender.expireDate
        ? `务必在截止时间前递达指定投标现场或上传至电子招投标平台（建议提前至少 1 小时就绪）`
        : "提前完成平台上传或提前 1 小时到达开标现场",
      critical: true,
    },
  ];

  return {
    projectName: tender.title,
    projectNo: tender.projectNo || null,
    outline: {
      businessPart,
      technicalPart,
      pricingPart,
    },
    complianceMatrix,
    preSubmissionChecks,
    generatedAt: new Date().toISOString().slice(0, 10),
  };
}

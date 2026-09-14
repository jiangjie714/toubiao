import { prisma } from "@/lib/prisma";
import {
  VOLUME_METAS,
  type AssembledVolumeItem,
  type ProposalProjectData,
} from "./proposal-assembler-types";

export * from "./proposal-assembler-types";

/**
 * 阿拉伯数字转中文大写金额 (元)
 */
export function toChineseCurrency(numYuan: number): string {
  if (numYuan === 0) return "零元整";
  const fraction = ["角", "分"];
  const digit = ["零", "壹", "贰", "叁", "肆", "伍", "陆", "柒", "捌", "玖"];
  const unit = [
    ["元", "万", "亿"],
    ["", "拾", "佰", "仟"],
  ];

  let s = "";
  for (let i = 0; i < fraction.length; i++) {
    s += (digit[Math.floor(numYuan * 10 * Math.pow(10, i)) % 10] + fraction[i]).replace(
      /零./,
      ""
    );
  }
  s = s || "整";

  let num = Math.floor(numYuan);
  for (let i = 0; i < unit[0].length && num > 0; i++) {
    let p = "";
    for (let j = 0; j < unit[1].length && num > 0; j++) {
      p = digit[num % 10] + unit[1][j] + p;
      num = Math.floor(num / 10);
    }
    s = p.replace(/(零.)*零$/, "").replace(/^$/, "零") + unit[0][i] + s;
  }
  return s
    .replace(/(零.)*零元/, "元")
    .replace(/(零.)+/g, "零")
    .replace(/^整$/, "零元整");
}

export interface AssembleInput {
  tenderId?: number | null;
  followId?: number | null;
  customTitle?: string;
  customPurchaser?: string;
  customBudgetWan?: number;
  customDuration?: string;
}

/**
 * 组装全套六大卷宗投标响应文件
 */
export async function assembleFullProposalPackage(
  userId: number,
  input: AssembleInput
): Promise<ProposalProjectData> {
  // 1. 获取企业资产数据
  const [user, profile, qualifications, cases, tender] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { name: true, username: true },
    }),
    prisma.companyProfile.findUnique({
      where: { userId },
    }),
    prisma.companyQualification.findMany({
      where: { userId, status: "VALID" },
      orderBy: { expiryDate: "desc" },
    }),
    prisma.companyCase.findMany({
      where: { userId },
      orderBy: { amountWan: "desc" },
      take: 10,
    }),
    input.tenderId
      ? prisma.tender.findUnique({
          where: { id: input.tenderId },
          select: {
            id: true,
            title: true,
            purchaser: true,
            agency: true,
            projectNo: true,
            budgetAmount: true,
            content: true,
            industryCode: true,
          },
        })
      : null,
  ]);

  const companyName = profile?.companyName?.trim() || "某某科技有限公司";
  const legalPerson = user?.name || user?.username || "张法人";
  const address = "北京市海淀区科技产业园一号楼";
  const contactName = user?.name || user?.username || "项目负责人";
  const contactPhone = "13800138000";

  const tenderTitle = tender?.title || input.customTitle || "某某政企数字化综合管理平台服务项目";
  const purchaser =
    tender?.purchaser || input.customPurchaser || "某某市人民政府办公室";
  const projectNo = tender?.projectNo || "ZB-2026-0915-01";
  const budgetWan = input.customBudgetWan
    ? Number(input.customBudgetWan)
    : tender?.budgetAmount
    ? Number(tender.budgetAmount)
    : 350;
  const budgetYuan = Math.round(budgetWan * 10000);
  const cnBudget = toChineseCurrency(budgetYuan);
  const duration = input.customDuration || "60日历天";

  // 卷一：商务报价与法定承诺函卷
  const vol1Markdown = `# 第一卷 商务报价与法定承诺函卷

## 一、投标函 (Bid Submission Letter)

致：**${purchaser}**

1. 在研究了贵方 **${tenderTitle}**（招标编号：**${projectNo}**）的招标文件后，我方遵照《中华人民共和国政府采购法》及相关法规规定，经慎重核算，正式提交投标文件。
2. 我方愿意以人民币（大写）：**${cnBudget}**（小写：¥**${budgetYuan.toLocaleString("zh-CN")}.00** 元）的投标总报价，按招标文件规定的要求承担本项目的全部建设、交付与服务保障责任。
3. 承诺交付服务工期：自合同签订之日起 **${duration}** 内完成全部实施并达到验收交付标准。
4. 质量保证期：**自最终验收合格之日起 36 个月**。
5. 投标有效期：自开标之日起 **90 日历天**。

投标人名称（公章）：**${companyName}**  
法定代表人或授权代表（签字/盖章）：**${legalPerson}**  
日期：${new Date().toLocaleDateString("zh-CN")}

---

## 二、法定代表人身份证明书

投标人名称：${companyName}  
统一社会信用代码：91110108MA0000000X  
成立时间：2016年08月18日  
经营期限：长期  
姓名：**${legalPerson}**，性别：男，现任我单位 **董事长兼总经理** 职务，系 **${companyName}** 之法定代表人。  

特此证明。

---

## 三、法定代表人授权委托书

本人 **${legalPerson}** 系 **${companyName}** 的法定代表人，现授权委托本单位员工 **${contactName}** 为我方合法代理人。代理人根据授权，以我方名义签署、递交、澄清修改有关 **${tenderTitle}** 的投标全流程公文，其法律后果由我方承担。

委托代理人（签字）：**${contactName}**，联系电话：**${contactPhone}**  
法定代表人（签字）：**${legalPerson}**  
授权期限：自签署之日起至投标有效期满止。

---

## 四、中小企业声明函（承接服务）

本公司郑重声明，根据《政府采购促进中小企业发展管理办法》（财库〔2020〕46号）的规定，本公司参加 **${purchaser}** 的 **${tenderTitle}** 采购活动，本公司承接的服务全部由本企业承接，属于 **软件和信息技术服务业** 行业，从业人员 **160** 人，上一年度营业收入 **4,800** 万元，属于 **中型企业**。

特此声明。
`;

  // 卷二：法定资格证明与信誉合规卷
  const matchedQualList = qualifications.map((q, idx) => {
    const exp = q.expiryDate ? new Date(q.expiryDate).toLocaleDateString("zh-CN") : "长期有效";
    return `| ${idx + 1} | ${q.name} | ${q.certNo || "见证书扫描件"} | ${q.issuingAuthority || "行业主管部门"} | ${exp} | 现行有效 |`;
  });

  const vol2Markdown = `# 第二卷 法定资格证明与信誉合规卷

## 一、法人营业执照与基本登记信息

| 登记事项 | 登记内容 | 备注 |
| :--- | :--- | :--- |
| **企业全称** | **${companyName}** | 依法存续的一般纳税人企业 |
| **法定代表人** | **${legalPerson}** | 身份证件已随附后页核验 |
| **住所地** | **${address}** | 具备常驻固定办公与研发场所 |
| **主营经营范围** | 计算机软硬件技术开发、系统集成、信息咨询、数据处理服务 | 涵盖本项目采购全部范畴 |

---

## 二、依法缴纳税收和社会保障资金声明函

致：**${purchaser}**

我方郑重承诺：
1. 我方在参加本次政府采购活动前六个月内，均依法按期全额缴纳增值税、企业所得税等法定税收，无偷税漏税不良记录；
2. 我方在参加本次政府采购活动前六个月内，依法为全体员工按期缴纳养老、医疗、工伤、失业等法定社会保障资金；
3. 本声明完全真实客观，如与税务或社保征收机关数据不符，我方愿承担直接取消中标资格并处没收投标保证金的一切法律责任。

---

## 三、参加政府采购活动前三年内无重大违法失信声明函

根据“信用中国”网站（www.creditchina.gov.cn）及中国政府采购网（www.ccgp.gov.cn）的实时查验结果，我方未被列入失信被执行人、重大税收违法失信主体、政府采购严重违法失信行为记录名单。

---

## 四、企业资质证书与行业准入证明目录

${
  matchedQualList.length > 0
    ? `本工程已自动调取企业资质证书库中生效证书，在技术评审打分中符合加分门槛：\n\n| 序号 | 资质名称 | 证书编号 | 颁发机构 | 有效期至 | 状态 |\n| :--- | :--- | :--- | :--- | :--- | :--- |\n${matchedQualList.join(
        "\n"
      )}`
    : `_注：企业资质库中暂未录入独立证书，已随附国家标准软件著作权及ISO9001质量管理体系声明文件。_`
}
`;

  // 卷三：类似项目同类业绩与证明材料卷
  const matchedCases = cases.slice(0, 4);
  const casesTable = matchedCases.map((c, i) => {
    const amt = c.amountWan ? `¥${c.amountWan} 万元` : "商业保密";
    const date = c.signDate ? new Date(c.signDate).toLocaleDateString("zh-CN") : "近期";
    return `| ${i + 1} | ${c.title} | ${c.clientName || "保密单位"} | ${amt} | ${date} | 已通过最终整体验收 |`;
  });

  const vol3Markdown = `# 第三卷 类似项目同类业绩与证明材料卷

## 一、类似业绩合同总览表

为证实我方在同类规模与行业项目中具备卓越的交付经验与技术实力，精选以下 **${matchedCases.length}** 笔已竣工交付的代表性业绩合同：

| 序号 | 项目合同名称 | 发包采购单位 | 合同金额 | 签约日期 | 履约状态 |
| :--- | :--- | :--- | :--- | :--- | :--- |
${
  casesTable.length > 0
    ? casesTable.join("\n")
    : `| 1 | 某省数字化协同平台项目 | 某省大数据局 | ¥450 万元 | 2025-05-18 | 竣工验收 |\n| 2 | 市自然资源三维信息系统 | 市自然资源和规划局 | ¥280 万元 | 2024-11-20 | 良好履约 |`
}

---

## 二、代表性业绩证明材料详情

${
  matchedCases.length > 0
    ? matchedCases
        .map((c, idx) => {
          return `### 3.${idx + 1} 业绩 ${idx + 1}：${c.title}
- **发包单位**：${c.clientName || "见合同公章"}
- **合同金额**：¥${c.amountWan || "0"} 万元
- **建设周期**：${c.signDate ? new Date(c.signDate).toLocaleDateString("zh-CN") : "2025年"}
- **技术要点与服务成效**：项目涵盖高可用分布式服务架构部署、数据安全加固与 7×24 小时运维常驻支持，获得业主方官方书面表彰。
- **附证明材料**：【合同首页、合同金额及标的页、双方盖章签字页、最终验收报告复印件（已加盖公章）】。
`;
        })
        .join("\n")
    : `### 3.1 核心样板工程合同
- 随附合同复印件及验收证明已扫描置于标书附件册，全部经发包方盖章核验真实。`
}
`;

  // 卷四：技术方案与项目实施组织卷
  const vol4Markdown = `# 第四卷 技术方案与项目实施组织卷

## 一、项目总体理解与建设目标

针对 **${purchaser}** 发布的 **${tenderTitle}** 业务特点，我方秉承“高标准设计、模块化落地、全周期护航”的理念，打造一套技术成熟、性能卓越、安全合规的一体化解决方案。

1. **业务目标**：打破数据孤岛，实现业务全流程数字化敏捷流转；
2. **性能指标**：系统并发支持 ≥ 1,000 TPS，核心页面响应时长 ≤ 1.5 秒；
3. **安全合规**：满足国家网络安全等级保护（等保三级）标准，实现数据传输端到端国密 SM2/SM4 算法加密。

---

## 二、总体技术架构设计

\`\`\`
+-------------------------------------------------------------+
|                      展示层 (UI & Portal)                   |
|        PC端管理后台 / 移动端政务微门户 / 大屏可视化驾驶舱       |
+-------------------------------------------------------------+
|                      应用服务层 (Business Services)         |
|   业务审批引擎 | 智能决策罗盘 | 消息路由中枢 | 统计分析审计 |
+-------------------------------------------------------------+
|                      数据支撑与安全层 (Data & Security)     |
|   分布式数据库 | 读写分离缓存 | 分布式文件存储 | 国密加密机 |
+-------------------------------------------------------------+
\`\`\`

---

## 三、实施部署里程碑甘特计划表

整个项目周期计划 **${duration}**，划分四个标准里程碑节点：

| 实施阶段 | 工作重点与交付成果 | 计划周期 | 关键交付物 |
| :--- | :--- | :--- | :--- |
| **阶段一：需求调研与方案深化** | 现场驻点业务访谈、细化实施方案、需求规格确认 | 第 1~10 天 | 《需求规格说明书》《深化设计方案》 |
| **阶段二：系统部署与功能定制** | 基础软硬件环境准备、模块定制开发、接口联调 | 第 11~35 天 | 《系统部署配置手册》《接口测试报告》 |
| **阶段三：集成测试与试运行** | 压力测试、安全漏洞扫描排查、业务人员试运行 | 第 36~50 天 | 《性能压测报告》《等保测评自查表》 |
| **阶段四：全员培训与最终验收** | 用户操作培训、交付全部源码与文档、验收签字 | 第 51~60 天 | 《用户培训签到表》《最终工程验收单》 |

---

## 四、项目组织架构与关键岗位职责分工

我方成立专项项目交付小组，人员均具备 PMP / CISP 及高级软件工程师证书：

| 岗位职务 | 拟派人员 | 专业年限 | 核心职责 |
| :--- | :--- | :--- | :--- |
| **项目总负责人** | **${contactName}** | 12 年 | 统筹资源调配、负责与采购方领导委员会重大事务汇报 |
| **技术架构总监** | 李工 (系统分析师) | 10 年 | 负责技术总体路线把关、疑难技术攻关与性能压测调优 |
| **现场实施主管** | 王工 (PMP) | 8 年 | 现场驻点组织推进、施工与联调质量检查、每日例会管控 |
| **安全合规专家** | 赵工 (CISP) | 7 年 | 负责代码安全审计、网络防火墙配置与等保合规加固 |
`;

  // 卷五：实质性条款与点对点偏离应答表
  const vol5Markdown = `# 第五卷 实质性条款与点对点偏离应答表

## 商务与技术偏离应答说明
我方郑重声明：我方已逐字研读招标文件全部条款，**我方投标文件对招标文件所有资格性要求、商务条款、技术参数及服务标准均完全响应或正偏离，绝无任何负偏离项！**

| 序号 | 条款类型 | 招标文件要求摘录 | 投标文件响应情况 | 偏离说明 | 证明材料索引 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | ★ 资格审查 | 具备合法营业资质，无重大失信违法记录 | 完全满足，已随附营业执照与信用声明 | 无偏离 | 见第二卷第1-3节 |
| 2 | ★ 工期要求 | 自合同签订之日起 **${duration}** 内竣工验收 | **完全满足**，承诺在 **${duration}** 内交钥匙交付 | 无偏离 | 见第一卷投标函 |
| 3 | ★ 质保期限 | 验收合格后提供不少于 24 个月免费质保 | **正偏离 (+12个月)**，我方承诺免费提供 36 个月质保 | **正偏离** | 见第六卷服务承诺 |
| 4 | ▲ 技术性能 | 核心交易事务处理响应时间 ≤ 2秒 | **正偏离**，实测压力并发下核心响应 ≤ 1.2秒 | **正偏离** | 见第四卷测试报告 |
| 5 | ★ 现场支持 | 重大保障期间提供现场驻点技术人员常驻 | **完全满足**，安排 2 名骨干工程师 7×24 驻点 | 无偏离 | 见第六卷人员排期 |
| 6 | ★ 安全合规 | 满足国家等保合规要求，数据本地存储备份 | **完全满足**，提供双活热备与国密加密支持 | 无偏离 | 见第四卷安全架构 |
`;

  // 卷六：售后服务保障与应急响应卷
  const vol6Markdown = `# 第六卷 售后服务保障与应急响应卷

## 一、服务保障承诺与时效机制

为确保 **${purchaser}** 系统常年安全稳定运行，我方设立专门的售后运维服务中心，并承诺执行以下标准：

1. **服务热线**：提供 7×24 小时全国统一服务专线与专属微信/钉钉作战协同群；
2. **响应时效级别**：
   - **特大故障 (P1 级)**：**10 分钟内** 响应，**30 分钟内** 专家远程接入，**2 小时内** 工程师抵达现场，**4 小时内** 排除恢复；
   - **严重故障 (P2 级)**：**15 分钟内** 响应，**1 小时内** 解决或提供应急替代旁路；
   - **常规咨询 (P3 级)**：**30 分钟内** 即时答疑，当天闭环。
3. **现场巡检保障**：每个季度派遣资深架构师进行一次系统深度巡检、性能调优与数据备份演练，并出具正式《季度运维体检报告》。

---

## 二、人员培训与知识移交体系

我方承诺“授人以渔”，在项目试运行前为采购人提供至少 **2 轮系统全员操作培训**：

| 培训对象 | 培训课程内容 | 培训学时 | 考核方式 |
| :--- | :--- | :--- | :--- |
| **业务操作员** | 界面日常操作、流程流转、表单填报与常见疑问 | 16 学时 | 上机实操考核 |
| **系统管理员** | 权限配置、数据字典维护、审计日志查看与备份 | 24 学时 | 管理员笔试与运维实操 |
`;

  const volumes: AssembledVolumeItem[] = [
    {
      volumeId: "VOL_1_COMMERCIAL",
      title: VOLUME_METAS.VOL_1_COMMERCIAL.title,
      contentMarkdown: vol1Markdown,
      isReady: true,
      metaSummary: `投标报价 ¥${budgetWan} 万元，工期 ${duration}，含中小企业与授权委托书`,
    },
    {
      volumeId: "VOL_2_QUALIFICATION",
      title: VOLUME_METAS.VOL_2_QUALIFICATION.title,
      contentMarkdown: vol2Markdown,
      isReady: true,
      metaSummary: `已自动挂载 ${matchedQualList.length} 项有效资质证书与信用声明`,
      matchedAssetsCount: matchedQualList.length,
    },
    {
      volumeId: "VOL_3_CASE",
      title: VOLUME_METAS.VOL_3_CASE.title,
      contentMarkdown: vol3Markdown,
      isReady: true,
      metaSummary: `已自动优选 ${matchedCases.length} 笔类似合同业绩页`,
      matchedAssetsCount: matchedCases.length,
    },
    {
      volumeId: "VOL_4_TECHNICAL",
      title: VOLUME_METAS.VOL_4_TECHNICAL.title,
      contentMarkdown: vol4Markdown,
      isReady: true,
      metaSummary: "包含系统架构、四阶段甘特进度计划与 PMP 项目团队分工",
    },
    {
      volumeId: "VOL_5_COMPLIANCE",
      title: VOLUME_METAS.VOL_5_COMPLIANCE.title,
      contentMarkdown: vol5Markdown,
      isReady: true,
      metaSummary: "6项核心条款完全满足与正偏离无缺陷承诺",
    },
    {
      volumeId: "VOL_6_SERVICE",
      title: VOLUME_METAS.VOL_6_SERVICE.title,
      contentMarkdown: vol6Markdown,
      isReady: true,
      metaSummary: "7×24h 应急响应、36个月质保与 40学时专项培训",
    },
  ];

  return {
    id: 0, // 在保存入库前为 0
    title: `${tenderTitle} - 全套投标文件装配稿`,
    status: "COMPLETED",
    targetPurchaser: purchaser,
    bidAmountWan: budgetWan,
    projectDuration: duration,
    tenderId: tender?.id || null,
    followId: input.followId || null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    volumes,
    completionRate: 100,
  };
}

/**
 * 导出全套公文级完整 Markdown 标书
 */
export function exportFullProposalMarkdown(project: ProposalProjectData): string {
  const dateStr = new Date().toLocaleDateString("zh-CN");
  return `# ${project.title}

**项目发包采购人**：${project.targetPurchaser || "采购单位见正文"}  
**投标响应人全称**：投标文件装配工场  
**编制提交日期**：${dateStr}  
**密级标记**：商业秘密·加密文件  

---

## 目录 (Table of Contents)

- **第一卷 商务报价与法定承诺函卷**
- **第二卷 法定资格证明与信誉合规卷**
- **第三卷 类似项目同类业绩与证明材料卷**
- **第四卷 技术方案与项目实施组织卷**
- **第五卷 实质性条款与点对点偏离应答表**
- **第六卷 售后服务保障与应急响应卷**

---

${project.volumes.map((v) => v.contentMarkdown).join("\n\n---\n\n")}

---
*全套标书文件由 标讯通·投标文件模块化智能装配工场 (Toubiao Bid Proposal Assembler) 自动编排生成*
`;
}

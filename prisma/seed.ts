import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { syncSkillConfigs } from "../crawler/config-loader";
import provinces from "china-division/dist/provinces.json";
import cities from "china-division/dist/cities.json";

const prisma = new PrismaClient();

// 这些占位名称不是真实城市
const CITY_PLACEHOLDERS = new Set([
  "市辖区",
  "县",
  "省直辖县级行政区划",
  "自治区直辖县级行政区划",
]);

async function seedRegions() {
  for (const p of provinces as { code: string; name: string }[]) {
    await prisma.region.upsert({
      where: { code: p.code },
      update: { name: p.name, level: 1 },
      create: { code: p.code, name: p.name, level: 1 },
    });
  }
  for (const c of cities as {
    code: string;
    name: string;
    provinceCode: string;
  }[]) {
    if (CITY_PLACEHOLDERS.has(c.name)) continue;
    await prisma.region.upsert({
      where: { code: c.code },
      update: { name: c.name, level: 2, parentCode: c.provinceCode },
      create: {
        code: c.code,
        name: c.name,
        level: 2,
        parentCode: c.provinceCode,
      },
    });
  }
  const count = await prisma.region.count();
  console.log(`地区数据：${count} 条`);
}

const PLANS = [
  {
    code: "FREE",
    name: "免费版",
    priceMonthly: null,
    priceYearly: null,
    sortOrder: 1,
    features: {
      searchQuota: 3,
      fullText: false,
      contacts: false,
      attachments: false,
      pushGroups: 0,
      exportDaily: 0,
      apiAccess: false,
    },
  },
  {
    code: "GOLD",
    name: "黄金会员",
    priceMonthly: 39,
    priceYearly: 299,
    sortOrder: 2,
    features: {
      searchQuota: 20,
      fullText: true,
      contacts: false,
      attachments: false,
      pushGroups: 0,
      exportDaily: 0,
      apiAccess: false,
    },
  },
  {
    code: "PLATINUM",
    name: "铂金会员",
    priceMonthly: 99,
    priceYearly: 799,
    sortOrder: 3,
    features: {
      searchQuota: 60,
      fullText: true,
      contacts: true,
      attachments: true,
      pushGroups: 3,
      exportDaily: 20,
      apiAccess: false,
    },
  },
  {
    code: "ENTERPRISE_STANDARD",
    name: "企业标准版",
    priceMonthly: null,
    priceYearly: 6800,
    sortOrder: 4,
    features: {
      searchQuota: 10000,
      fullText: true,
      contacts: true,
      attachments: true,
      pushGroups: 10,
      exportDaily: 2000,
      apiAccess: false,
    },
  },
];

async function seedPlans() {
  for (const plan of PLANS) {
    await prisma.plan.upsert({
      where: { code: plan.code },
      update: {
        name: plan.name,
        priceMonthly: plan.priceMonthly,
        priceYearly: plan.priceYearly,
        features: plan.features,
        active: true,
        sortOrder: plan.sortOrder,
      },
      create: plan,
    });
  }
  console.log(`套餐：${PLANS.length} 个`);
}

async function seedAdmin() {
  const username = process.env.ADMIN_USERNAME || "admin";
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);
  const existing = await prisma.user.findUnique({ where: { username } });
  if (existing) {
    console.log(`管理员 ${username} 已存在，跳过`);
    return;
  }
  await prisma.user.create({
    data: { username, passwordHash, name: "系统管理员", role: "ADMIN" },
  });
  console.log(`已创建管理员账号：${username} / ${password}`);
}

function daysAgo(n: number): Date {
  return new Date(Date.now() - n * 24 * 3600 * 1000);
}

async function seedTenders() {
  const count = await prisma.tender.count();
  if (count > 0) {
    console.log(`已有 ${count} 条公告，跳过示例数据`);
    return;
  }
  const samples = [
    {
      title: "某市政务云平台扩容项目公开招标公告",
      type: "NOTICE",
      provinceCode: "11",
      cityCode: null as string | null,
      purchaser: "某市大数据管理局",
      agency: "中招国际招标有限公司",
      content:
        "一、项目编号：ZCG-2026-0118\n二、项目概况与招标范围：本次招标为政务云平台计算与存储资源扩容，含服务器、分布式存储及相关集成服务。\n三、投标人资格要求：具备独立法人资格，具有信息系统集成及服务资质，近三年内无重大违法记录。\n四、获取招标文件：请于公告发布之日起 5 个工作日内登录平台下载。\n五、投标截止时间：2026-09-30 09:30，逾期送达不予受理。",
      expireDate: daysAgo(-21),
    },
    {
      title: "某省人民医院医疗设备采购（CT、MRI）招标公告",
      type: "NOTICE",
      provinceCode: "33",
      purchaser: "某省人民医院",
      agency: "浙江省成套招标代理有限公司",
      content:
        "项目概况：采购 64 排 CT 一台、3.0T 磁共振一台，预算金额 2600 万元。\n供应商资格要求：具有医疗器械经营许可证，所投设备须具备医疗器械注册证。\n投标截止时间：2026-09-25 14:00。",
      expireDate: daysAgo(-16),
    },
    {
      title: "某区中小学校园安防监控系统改造项目竞争性磋商公告",
      type: "INQUIRY",
      provinceCode: "11",
      cityCode: "1101",
      purchaser: "某区教育委员会",
      agency: null,
      content:
        "采购需求：对辖区内 12 所中小学视频监控及门禁系统进行升级改造。\n响应文件递交截止时间：2026-09-20 17:00。\n磋商时间：另行通知。",
      expireDate: daysAgo(-11),
    },
    {
      title: "某市轨道交通 3 号线信号系统中标结果公告",
      type: "RESULT",
      provinceCode: "11",
      purchaser: "某市轨道交通建设指挥部",
      agency: "国信招标集团股份有限公司",
      content:
        "一、项目编号：GX-2026-0067\n二、中标信息：中标人：北京xx科技有限公司，中标金额：18,650 万元。\n三、主要标的信息：信号系统设备采购及集成服务。\n四、公告期限：自本公告发布之日起 1 个工作日。",
      expireDate: null,
    },
    {
      title: "某县农村公路养护工程中标公示",
      type: "RESULT",
      provinceCode: "37",
      purchaser: "某县交通运输局",
      agency: null,
      content:
        "评标结果：第一中标候选人：山东xx公路工程有限公司，投标报价 3,286.5 万元，工期 365 日历天。\n公示期：2026-09-01 至 2026-09-04。",
      expireDate: null,
    },
    {
      title: "关于某市智慧城管平台建设项目招标文件的更正公告",
      type: "CHANGE",
      provinceCode: "50",
      purchaser: "某市城市管理局",
      agency: "重庆xx工程咨询有限公司",
      content:
        "原公告的采购项目编号：CQCG-2026-0331\n更正事项：采购文件\n1. 将原投标截止时间 2026-09-18 延期至 2026-09-28。\n2. 技术参数中视频分析服务器要求更正为：单机支持 128 路视频结构化分析。\n其余内容不变。",
      expireDate: daysAgo(-19),
    },
    {
      title: "某单位档案数字化服务项目询价公告",
      type: "INQUIRY",
      provinceCode: "32",
      purchaser: "某省档案馆",
      agency: null,
      content:
        "询价内容：纸质档案数字化加工约 200 万页，含扫描、图像处理、著录挂接。\n响应截止时间：2026-09-15 10:00。",
      expireDate: daysAgo(-6),
    },
    {
      title: "某集团 2026 年度钢材集中采购招标公告",
      type: "NOTICE",
      provinceCode: "32",
      purchaser: "某钢铁集团有限公司",
      agency: "中钢招标有限责任公司",
      content:
        "采购范围：热轧卷板、螺纹钢等，预计年度总量 15 万吨，分批交付。\n资格审查方式：资格后审。\n投标截止时间：2026-10-09 09:00。",
      expireDate: daysAgo(-30),
    },
  ];
  for (const s of samples) {
    await prisma.tender.create({
      data: { ...s, publishDate: daysAgo(3), sourceName: "手动录入" },
    });
  }
  console.log(`示例公告：${samples.length} 条`);
}

const INDUSTRIES = [
  ["MEDICAL_EQUIPMENT", "医疗设备"],
  ["IT", "信息化"],
  ["IT_SOFTWARE", "软件开发"],
  ["ENGINEERING", "工程施工"],
  ["OFFICE_SUPPLIES", "办公物资"],
  ["PROPERTY_SERVICE", "物业服务"],
  ["MAINTENANCE", "维修保养"],
  ["INSPECTION", "检验检测"],
  ["EDUCATION_EQUIPMENT", "教育装备"],
  ["ENVIRONMENTAL_EQUIPMENT", "环保设备"],
  ["SECURITY", "安防监控"],
  ["ENERGY", "能源电力"],
  ["TRANSPORT", "交通运输"],
  ["WATER", "水务环保"],
  ["AGRICULTURE", "农林牧渔"],
  ["LEGAL_SERVICE", "法律服务"],
  ["ACCOUNTING_SERVICE", "会计审计"],
  ["CONSULTING", "咨询服务"],
  ["LOGISTICS", "物流仓储"],
  ["PRINTING", "印刷服务"],
];

async function seedIndustries() {
  for (const [code, name] of INDUSTRIES) {
    await prisma.industryDict.upsert({
      where: { code },
      update: { name },
      create: { code, name },
    });
  }
  console.log(`行业字典：${INDUSTRIES.length} 条`);
}

async function seedAlertRule() {
  const existing = await prisma.alertRule.findFirst({
    where: { scope: "global", condition: "health_below", threshold: 70 },
  });
  if (!existing) {
    await prisma.alertRule.create({
      data: {
        scope: "global",
        condition: "health_below",
        threshold: 70,
        channel: "wecom_webhook",
        target: process.env.ALERT_WECOM_WEBHOOK ?? "https://example.invalid",
        cooldownMinutes: 60,
      },
    });
  }
}

async function seedSources() {
  const result = await syncSkillConfigs();
  console.log(`数据源：${result.synced} 个，新增配置版本：${result.versions} 个`);
}

async function main() {
  await seedRegions();
  await seedAdmin();
  await seedPlans();
  await seedIndustries();
  await seedTenders();
  await seedSources();
  await seedAlertRule();
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());

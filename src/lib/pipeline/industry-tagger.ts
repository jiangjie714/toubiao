/**
 * 行业智能规则匹配与打标分类器
 */

export interface IndustryRule {
  code: string;
  name: string;
  keywords: string[];
  boostKeywords?: string[];
  excludeKeywords?: string[];
}

export const INDUSTRY_RULES: IndustryRule[] = [
  {
    code: "MEDICAL_EQUIPMENT",
    name: "医疗卫生与健康医药",
    keywords: [
      "医疗",
      "医院",
      "卫生院",
      "疾控",
      "诊疗",
      "病房",
      "医学",
      "耗材",
      "药品",
      "器械",
      "CT",
      "核磁",
      "超声",
      "内窥镜",
      "生化",
      "血液",
      "体检",
      "健康",
      "消毒",
      "手术",
      "卫健",
    ],
    boostKeywords: ["医疗设备", "卫健委", "医院", "紧密型城市医疗集团"],
  },
  {
    code: "IT",
    name: "信息技术与智慧政务",
    keywords: [
      "政务云",
      "大数据",
      "软件",
      "信息化",
      "系统",
      "数字化",
      "网络",
      "服务器",
      "存储",
      "安全边界",
      "云平台",
      "数据库",
      "机房",
      "交换机",
      "路由器",
      "平台建设",
      "公安网",
      "智慧",
      "系统集成",
      "信创",
    ],
    boostKeywords: ["政务网", "大数据局", "政务云平台", "信息安全", "软件采购"],
  },
  {
    code: "ENGINEERING",
    name: "工程建设与市政基础设施",
    keywords: [
      "工程",
      "施工",
      "改造",
      "修缮",
      "装修",
      "土建",
      "市政",
      "道路",
      "街区提升",
      "绿化",
      "园林",
      "管网",
      "桥梁",
      "给排水",
      "亮化",
      "拆除",
      "建筑",
      "加固",
      "维修工程",
    ],
    boostKeywords: ["改造工程", "园林系统维修", "街区提升改造", "工程施工"],
  },
  {
    code: "PROPERTY_SERVICE",
    name: "后勤保障与物业服务",
    keywords: [
      "后勤保障",
      "物业",
      "保洁",
      "安保服务",
      "保安",
      "保洁服务",
      "餐饮",
      "食堂",
      "绿化保洁",
      "生活服务",
      "物业管理",
    ],
    boostKeywords: ["后勤保障服务", "综合行政执法大队后勤", "物业服务"],
  },
  {
    code: "EDUCATION_EQUIPMENT",
    name: "教育装备与科研教学",
    keywords: [
      "大学",
      "中学",
      "小学",
      "学校",
      "实训",
      "教学",
      "多媒体",
      "实验室",
      "心理健康辅导站",
      "学位论文",
      "科研",
      "仪器",
      "课桌椅",
      "图书馆",
      "教材",
      "测试中心",
    ],
    boostKeywords: ["山东科技大学", "分析测试中心", "心理健康辅导站", "高校"],
  },
  {
    code: "AGRICULTURE",
    name: "现代农业与乡村振兴",
    keywords: [
      "农业",
      "大棚",
      "蔬菜大棚",
      "农民培育",
      "高素质农民",
      "灌溉",
      "农林",
      "水利",
      "林业",
      "畜牧",
      "种苗",
      "乡村振兴",
      "农田",
    ],
    boostKeywords: ["蔬菜大棚配套", "高素质农民培育", "农业农村局"],
  },
  {
    code: "OFFICE_SUPPLIES",
    name: "办公设备与生活物资",
    keywords: [
      "办公设备",
      "办公家具",
      "办公用品",
      "居家用品",
      "空调机组",
      "电脑",
      "打印机",
      "复印纸",
      "文具",
      "物资采购",
    ],
    boostKeywords: ["居家用品采购", "空调机组", "办公家具"],
  },
  {
    code: "SECURITY",
    name: "安防监控与平安应急",
    keywords: [
      "安防",
      "监控",
      "雪亮",
      "视频监控",
      "闸机",
      "门禁",
      "报警",
      "应急救援",
      "消防",
      "巡检",
    ],
    boostKeywords: ["公安局", "监控系统", "安防工程"],
  },
];

/**
 * 根据标题、正文与采购人推测所属行业
 */
export function classifyIndustry(input: {
  title: string;
  content?: string | null;
  purchaser?: string | null;
}): { code: string; name: string; score: number } | null {
  const text = `${input.title} ${input.purchaser || ""} ${input.content ? input.content.slice(0, 300) : ""}`;

  let bestRule: IndustryRule | null = null;
  let maxScore = 0;

  for (const rule of INDUSTRY_RULES) {
    let score = 0;

    // 检查排除词
    if (rule.excludeKeywords?.some((ex) => text.includes(ex))) {
      continue;
    }

    // 强化关键词权重 (+5 分)
    if (rule.boostKeywords) {
      for (const bk of rule.boostKeywords) {
        if (text.includes(bk)) {
          score += 5;
        }
      }
    }

    // 普通关键词权重 (+2 分)
    for (const kw of rule.keywords) {
      if (text.includes(kw)) {
        score += 2;
      }
    }

    if (score > maxScore) {
      maxScore = score;
      bestRule = rule;
    }
  }

  // 设定置信度阈值 (≥2 分判定命中)
  if (bestRule && maxScore >= 2) {
    return {
      code: bestRule.code,
      name: bestRule.name,
      score: maxScore,
    };
  }

  return null;
}

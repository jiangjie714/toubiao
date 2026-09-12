# AI 智能标书速读与投标风险雷达功能规划（Direction A）

> **商业价值导向：** 将标讯通从「信息检索工具」升级为「智能投标决策助手」，作为黄金版/白金版/企业版的核心差异化溢价卖点，直接推动客单价从百元跃升至数千元级别。

---

## 一、商业化价值与权益矩阵

| 套餐等级 | AI 标书速读月度配额 | 风险雷达（一票否决排查） | 评标办法与条款提炼 | 企业资质自动打分 |
|---|---|---|---|---|
| **免费版** | 0 次（仅可预览示例与特权引导） | 仅查看锁权引导 | 仅查看锁权引导 | 不支持 |
| **黄金版** (¥199/月 · ¥1,599/年) | 30 次 / 月 | 支持一票否决项排查 | 支持综合评分法提炼 | 不支持 |
| **白金版** (¥399/月 · ¥2,999/年) | 100 次 / 月 | 深度风险排查 + 保证金预警 | 完整提炼（付款/违约金等） | 支持 3 份企业资质档案对照 |
| **企业定制版** (¥9,999+/年) | 不限次 | 全员共享深度排查 | 支持标书条款对比 | 支持多组织资质库与团队协同 |

---

## 二、核心功能特性

### 1. 标书一页纸速览（Executive Summary）
- **项目概览**：采购标的、实施地点、工期/交付期要求、预算与最高限价。
- **招标范围**：一键提炼核心清单或施工界限，避免通篇阅读数万字长文。

### 2. AI 废标风险雷达（Bid Risk Radar）
- **一票否决项清单**：自动定位必须具备的资质等级、安全生产许可证、特定业绩数量、财务审计报告年限等“硬性门槛”。
- **严苛合规预警**：开标现场原件核验要求、暗标装订格式要求、投标保证金缴纳截止时间与退还条款。

### 3. 评标办法与分值测算（Scoring Methodology）
- **评标方式**：自动识别「综合评分法」还是「最低评标价法」。
- **权重解析**：价格分（%）、商务分（%）、技术方案分（%）、业绩分（%）结构化表格呈现。

### 4. 企业资质匹配自检（Enterprise Fit Check）
- 用户可在个人中心保存「本企业资质档案」（注册资本、ISO认证、建筑/机电/安防资质、近三年类似业绩金额）。
- 在详情页点击「AI 赢面自检」，系统自动对照本标段要求，生成雷达图及缺失短板提示（例如：“提示：本项目要求CMMI3级，您填报的档案暂无此项，可能扣减技术分或无法响应”）。

---

## 三、技术架构设计

### 1. 数据库模型扩展
```prisma
model TenderAiAnalysis {
  id               Int      @id @default(autoincrement())
  tenderId         Int      @unique
  tender           Tender   @relation(fields: [tenderId], references: [id], onDelete: Cascade)
  executiveSummary String   @db.Text
  riskRadar        Json     // { disqualifiedItems: [], complianceAlerts: [], depositDeadline: "" }
  scoringMethod    Json     // { method: "综合评分法", priceRatio: 30, techRatio: 50, bizRatio: 20 }
  modelUsed        String   // "deepseek-chat" / "qwen-plus" / "gpt-4o"
  promptTokens     Int      @default(0)
  completionTokens Int      @default(0)
  status           String   @default("COMPLETED") // "PROCESSING" | "COMPLETED" | "FAILED"
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}

model CompanyProfile {
  id               Int      @id @default(autoincrement())
  userId           Int      @unique
  user             User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  companyName      String
  registeredCapital String?
  certifications   Json     // ["ISO9001", "高新技术企业", "涉密资质"]
  qualifications   Json     // [{"name": "电子与智能化工程", "level": "一级"}]
  keyCases         Json     // 类似业绩列表
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt
}
```

### 2. 成本控制与分析复用（Cache-First）
- **一次分析，全员复用**：同一篇招标公告被首位付费用户触发 AI 分析后，结果永久持久化至 `TenderAiAnalysis` 表中；后续其他用户查看时直接读取缓存，毫秒级加载且零新增 Token 消耗。
- **配额防刷**：仅在初次生成或命中用户配额核销逻辑时调用 `consumeAiQuota(userId)`。

### 3. LLM 适配器抽象（Multi-Provider Adapter）
在 `src/lib/ai/client.ts` 中封装兼容 OpenAI 规范的统一客户端，通过环境变量自由切换：
- `AI_PROVIDER`: `deepseek` / `aliyun` / `openai` / `ollama`
- `AI_API_KEY`: API 密钥
- `AI_BASE_URL`: 接口地址（如 `https://api.deepseek.com/v1`）
- `AI_MODEL`: 模型代号（如 `deepseek-chat`）

---

## 四、实施里程碑划分

- **Phase 1（基础底座与速读展示，预计 2 天）**：
  - 数据模型迁移（`TenderAiAnalysis`）、模型配置环境变量。
  - Prompt 工程构建（针对招标公告精准提取一页速览与废标条款）。
  - 前台详情页 `TenderAiCard` 交互卡片与白金会员权限判定。
- **Phase 2（企业画像与赢面自检，预计 2 天）**：
  - 用户企业资质画像（`CompanyProfile`）维护页。
  - AI 资质差距比对与雷达打分算法。
- **Phase 3（营销转化与导出，预计 1 天）**：
  - 免费用户试看脱敏视图与弹窗引导开通白金版。
  - 生成「标书速读与风险评估报告」PDF / Word 导出。

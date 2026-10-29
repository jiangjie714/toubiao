# 贵州省公共资源交易平台（ggzy-guizhou）

## 站点档案
- **站点名称**：贵州省公共资源交易云 / 贵州省公共资源交易平台
- **官网主页**：https://ggzy.guizhou.gov.cn
- **信息服务频道**：`/xxfw/zfcg/`（政府采购）、`/xxfw/gcjs/`（工程建设）
- **数据分类**：省级公共资源交易（政府采购 + 工程建设，含全省各市州交易中心）
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome UA；接口无签名要求

## 接口（2026-10-29 接入实测）

列表统一走前端 `fes.GCJStradeInfo()` 同款 JSON 接口（`/material/siteFile/2022/js/common.js`）：

```
POST https://ggzy.guizhou.gov.cn/tradeInfo/es/list
Content-Type: application/json;charset=UTF-8

{"channelId":"5904543","pageNum":1,"pageSize":20,"announcement":"采购公告"}
```

- `channelId`：`5904543`=政府采购（`zfcg_v1.js`）、`5904475`=工程建设（`gcjs_v2.js`）
- `announcement`：**精确匹配**的公告类型过滤；响应 `{ total, list: [...] }`，按发布时间倒序
- 条目字段：`docTitle` 标题、`apiUrl` 详情直链（`/tradeInfo/detailHtml?metaId=…`）、
  `docRelTime` 13 位毫秒时间戳（`parseDate` 已支持）、`docSourceName` 市州交易中心、
  `businessTypeName` 业务类型、`announcement` 公告类型、`tenderProjectCode` 项目编号
  （→ `extraFields.projectNo`，供项目聚类）
- 深翻页上限：前端对 `pageNum>500` 有降级处理（约 1 万条窗口），增量抓取用不到

### 公告类型词表与映射（500 条抽样）

| announcement（精确值） | 频道 | 映射 Tender.type | 说明 |
|---|---|---|---|
| 采购公告 | 政采 | NOTICE | 约 28% |
| 采购需求公示 | 政采 | INTENTION | 发标前需求公示，早期信号 |
| 交易结果公示 | 双频道 | RESULT | 中标/成交 |
| 中标候选人公示 | 工程建设 | RESULT | 候选人公示（中标前置） |
| 交易公告 | 工程建设 | NOTICE | 招标公告 |
| 招标计划 | 工程建设 | INTENTION | 招标计划，早期信号 |
| 变更公告（澄清与答疑） | 双频道 | CHANGE | 全角括号需原样匹配 |
| 合同公示 | 双频道 | 未接入 | 量大（150/500）且价值低于中标，控制单轮量，如需再加 |
| 交易证明书 | 双频道 | 未接入 | 成交证明文书，非投标商机 |
| 其他公告 | 双频道 | 未接入 | 噪音 |

## 详情页结构

- 正文容器：`.view_con`（含「项目概况/一、项目基本信息…」全部公告文本）
- 页面另有 `.jbxx`（基本信息结构化字段）、`.xxglcon`（交易相关信息滚动区），正文提取不需要
- 采购人/代理/金额等字段不在列表接口里，靠 runner 内置正文抽取（`extractPurchaser` 兜底锚点）补齐

## 诊断排查步骤

1. 列表解析为 0：先 curl `POST /tradeInfo/es/list` 看是否改字段名/加签名；
2. 类型过滤失效：核对 `announcement` 精确值（含全角括号），抽样 100 条重建词表；
3. 详情空白：`detailHtml?metaId=` 若改版为壳页，从 `apiUrl` 重新找正文容器。

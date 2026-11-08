# 湖南省公共资源交易服务平台（ggzy-hunan）

## 站点档案
- **站点名称**：湖南省公共资源交易服务平台
- **官网主页**：https://www.hnsggzy.com
- **数据分类**：工程建设（`CONSTRUCTION`）+ 招标计划 + 政府采购（`GOVERNMENT_PURCHASE`）
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome UA；`/tradeApi/*` 接口无签名、无验证码

> ⚠️ 别被 `ggzy.hunan.gov.cn` 骗了：那个域名只有政策新闻，交易数据全在 `www.hnsggzy.com`。

## 接口（2026-11-08 接入实测）

站点是 Vue SPA，前端所有数据都走 `/tradeApi` 下的 JSON 接口，`current`/`size` 分页（页码从 1 开始）。

### 1. 工程建设公告（混合流）

```
GET https://www.hnsggzy.com/tradeApi/constructionTender/listByFile
    ?current=1&size=13&tenderProjectType=CONSTRUCTION
```

`data.records` 里**混着全部公告类型**，靠 `noticeType` 区分（`total` ≈ 27689）：

| noticeType | 含义 | 映射 |
| --- | --- | --- |
| ZHAOBIAO_NOTICE | 招标公告 | NOTICE |
| CHONGXIN_ZHAOBIAO_NOTICE | 重新招标公告 | NOTICE |
| GENGZHENG_NOTICE | 更正公告 | CHANGE |
| CHENGQING_NOTICE | 答疑澄清 | CHANGE |
| ZHONGZHI_NOTICE | 终止公告 | CHANGE |
| ZANTING_NOTICE | 暂停公告 | CHANGE |
| REVIEW_NOTICE | 复议公告 | CHANGE |

实测 `noticeType` / `type` / `bulletinType` 等参数**都不能服务端过滤**（传了 total 与返回都不变），
所以 config 用 `parse.typeMap` 逐条映射（见 `crawler/schema.ts` 的 `typeMap`）。

### 2. 招标计划（独立接口）

```
GET https://www.hnsggzy.com/tradeApi/constructionTender/ListConstructionTenderPlan?current=1&size=13
```

`data.records[]`：`noticeTitle` / `noticeSendDate`（ISO 带 +08:00）/ `regionName` / `id`。

### 3. 政府采购

```
GET https://www.hnsggzy.com/tradeApi/governmentPurchase/projectInformation/selectAll
    ?current=1&size=13&descs=noticeSendTime&tenderMode=公开招标
```

- **必须带 `tenderMode`**：不带时 `noticeSendTime` 全为 `null`（total 223463），日期无法入库，
  断点续采与时间窗口全失效；带 `公开招标` 时 total 146282、日期完整。
- 只实测出 `公开招标` 有日期；`竞争性磋商`/`询价`/`单一来源`/`竞争性谈判`/`邀请招标`
  的 `noticeSendTime` 同样为空，故只接公开招标。
- 结果公告不能靠 `noticeType` 过滤，但 **`notice` 数字枚举服务端有效**（见下节）。

## 结果公告（2026-11-08 补充接入）

「信息类型」在前端是 `notice` 参数（**数字枚举**，不是 `noticeType` 字符串），服务端真实过滤：

### 工程建设 `listByFile`

| `notice` | 含义 | `noticeType` 取值 | 量级 |
| --- | --- | --- | --- |
| 0 | 招标/资审公告 | `ZHAOBIAO_NOTICE` / `CHONGXIN_ZHAOBIAO_NOTICE` / `GENGZHENG_NOTICE` / `CHENGQING_NOTICE` | 27505 |
| 1 | 更正公告 | `GENGZHENG_NOTICE` | — |
| 2 | 中标候选人公示 | `ZHONGBIAOHXR_NOTICE` | 24589 |
| 3 | 中标结果公告 | `ZHONGBIAO_NOTICE` | 23427 |
| 8 | 招标计划 | `plan` | 4564 |

> 此前用 `noticeType=RESULT_NOTICE` 试过，服务端忽略该参数（total 与返回都不变），所以一直以为不能服务端过滤。

### 政府采购 `selectAll`

| `notice` | 含义 |
| --- | --- |
| 1 | 招标公告 |
| 2 | 澄清公告 |
| 3 | 更正公告 |
| **4** | **中标（成交）公告** |
| 5 | 征集公告 |
| 6 | 终止公告 |
| 7 | 合同 |

政采结果的 `noticeType` 是**中文**（「中标结果公告」「中标公告」），`parse.typeMap` 要按中文映射。

### 结果正文接口（与招标公告不是同一个）

| 场景 | 详情接口 | jsonPath |
| --- | --- | --- |
| 住建/水利/交通 候选人公示 | `/tradeApi/constructionNotice/selectWinningBidNotice/{sectionId}/0` | `data.0.publicityContent` |
| 住建/水利/交通 中标结果 | `/tradeApi/constructionNotice/selectWinningBidNotice/{sectionId}/1` | `data.0.publicityContent` |
| 政府采购 中标公告 | `/tradeApi/governmentPurchase/procureResultAnnouncementInformation/getResultBySectionId?sectionId=` | `data.resultAnnouncementInformation.0.winBidBulletinContent` |

- `selectWinningBidNotice` 第二段是 `0`=候选人 / `1`=结果，**不能互换**，取错会拿到另一类公告或空数组。
- 政采的 `getAnnouncementBySectionId` **不返回**中标公告正文（只有招标/澄清/更正），必须用 `getResultBySectionId`，
  同时它还会返回 `winningSupplierInformations`（中标供应商结构化列表，目前未入库）。
- 这些正文都是「受 XX（招标人）的委托…」句式，`extractPurchaser()` 已补 `受 X 的委托` 兜底（实测 100%）。

### 可扩展的工程类别（同一套 listByFile/selectWinningBidNotice，仅 `tenderProjectType` 不同）

| `tenderProjectType` | 含义 | 招标公告量级 |
| --- | --- | --- |
| `CONSTRUCTION` | 住建工程 | 27505 |
| `WATER_CONSERVANCY` | 水利工程 | 9212 |
| `INDUSTRY` | 工业工程 | 7725 |
| `OTHER` | 其他 | 7376 |
| `TRANSPORATATION` | 交通工程（**站点拼写如此，少一个 T**） | 5747 |
| `AGRICULTURAL_PROJECT` | 农业工程 | 4039 |
| `AGENCY_CONSTRUCTION` | 代建工程 | 580 |
| `ENVIRONMENTAL_PROJECT` | 环保工程 | 458 |

当前已接入 住建（公告+候选人+结果）、水利（公告+结果）、交通（公告+结果）、工业（结果）、农业（结果）、其他（结果）、招标计划、政采（公告+结果），共 13 个列表。

> 单次采集会按 13 个列表串行翻页，每页 13 条 + 1.5s 礼貌间隔，一轮约 3-5 分钟（断点续采命中后每个列表只翻 1 页）。

## 详情（JSON 正文）

config 用 `detail.jsonPath` 直接取富文本 HTML 字符串，配 `contentSelector: body` 走保真净化：

| 列表 | 详情接口 | jsonPath |
| --- | --- | --- |
| 工程建设 | `/tradeApi/constructionNotice/getBySectionId?sectionId=` | `data.noticeList.0.noticeContent` |
| 招标计划 | `/tradeApi/constructionTender/getConstructionTenderPlanById?id=` | `data.noticeContent` |
| 政府采购 | `/tradeApi/governmentPurchase/projectInformation/getAnnouncementBySectionId?sectionId=` | `data.governmentProcureAnnouncementInformation.0.noticeContent` |

- 详情接口的数组**按发布时间倒序**，`[0]` 就是列表里那一条（更正公告在前、原招标公告在后），
  取 index 0 与列表 `noticeType` 一致。
- `bidSectionId` 是详情主键（列表里的 `id` 多为 `null`）。
- 详情页人读地址（`sourceUrl`）：
  - 工程建设 `https://www.hnsggzy.com/resources/transactionDetail/construction?bidSectionId=…&regionCode=…`
  - 招标计划 `https://www.hnsggzy.com/resources/bidPlanDetail?id=…`
  - 政府采购 `https://www.hnsggzy.com/resources/projectDetail/governmentPurchase?bidSectionId=…&regionCode=…`

## 字段说明

- 工程建设：`title` = `bidSectionName`、`date` = `noticeSendTime`、`city` = `name`（如「常德市」）、
  `purchaser` = `tendererName`（列表多为空，靠正文 `extractPurchaser()` 兜底，实测 100%）
- 招标计划：`title` = `noticeTitle`、`date` = `noticeSendDate`、`city` = `regionName`
- 政府采购：`title` = `noticeName`（约 2% 为 `null`，`purchaseProjectName` 可兜底但会丢公告后缀）、
  `date` = `noticeSendTime`、`city` = `regionName`（省本级为「湖南省」）
- `province` 统一常量 `43`

## 诊断排查步骤

1. **列表 0 条**：确认走的是 `www.hnsggzy.com`（不是 `ggzy.hunan.gov.cn`），且 `current` 从 1 开始。
2. **日期 0%（政采）**：`tenderMode` 参数丢了或被改成其他采购方式。
3. **正文为空**：确认 `jsonPath` 层级——工程建设是 `data.noticeList[].noticeContent`，
   政采是 `data.governmentProcureAnnouncementInformation[].noticeContent`，两者不通用。
4. **类型全变 NOTICE**：`parse.typeMap.field` 写错（必须指向原始 JSON 字段 `noticeType`），
   或站点改了枚举值，比对 `data.records[].noticeType` 的取值。

# Skill：ggzy —— 全国公共资源交易平台

## 站点概况

- 入口：https://www.ggzy.gov.cn/（国家平台，汇聚 31 省 + 央企/部委交易信息）
- 2026-10 改版：旧静态频道页 `/information/html/a/trade.html` 已 404，全站改为 Vue 单页 + JSON 接口
- 本 skill 走**接口采集**，不解析列表 HTML，也不处理验证码

## 列表接口（2026-10 实测）

```
POST https://www.ggzy.gov.cn/information/pubTradingInfo/getTradList
Content-Type: application/x-www-form-urlencoded
Referer: https://www.ggzy.gov.cn/deal/dealList.html?HEADER_DEAL_TYPE=01
```

表单字段（缺省值可不传）：

| 字段 | 含义 | 取值 |
|---|---|---|
| `SOURCE_TYPE` | 数据来源 | `1` 省平台、`2` 央企、`3` 财政部、`4` 自然资源部、`5` 国资委、`6` 商务部 |
| `DEAL_TIME` | 发布时间窗 | `01` 当天、`02` 近三天、`03` 近十天、`04` 近一月、`05` 近三月、`06` 区间 |
| `DEAL_CLASSIFY` | 交易大类 | `01` 工程建设、`02` 政府采购、`03` 土地、`04` 矿业权、`05` 国有产权… |
| `DEAL_STAGE` | 信息类型 | 见下表 |
| `PAGENUMBER` | 页码 | 从 1 开始 |

信息类型与公告类型映射：

| DEAL_CLASSIFY | DEAL_STAGE | 名称 | Tender.type |
|---|---|---|---|
| 01 | 0101 | 招标/资审公告 | NOTICE |
| 01 | 0102 | 开标记录 | （不采） |
| 01 | 0104 | 交易结果公示 | RESULT |
| 01 | 0105 | 招标/资审文件澄清 | （不采） |
| 02 | 0201 | 采购/资审公告 | NOTICE |
| 02 | 0202 | 中标公告 | RESULT |
| 02 | 0204 | 更正事项 | CHANGE |

响应结构：

```json
{ "code": 200, "data": { "total": 1000, "current": 1, "records": [
  { "id": "…", "title": "…", "publishTime": "2026-10-23",
    "province": "530000", "provinceText": "云南省", "cityText": null,
    "informationType": "0102", "informationTypeText": "开标记录",
    "url": "/information/deal/html/a/530000/0102/20261023/<id>.html" }
] } }
```

- `itemsPath: data.records`
- 地区取 `provinceText` / `cityText`（名称，交给 `regions.ts` 识别，勿用 6 位 code）

## 详情页

- 列表返回的 `url` 是**壳页**（`/information/deal/html/a/…`），只含同项目的公告导航
- 正文在 `/information/deal/html/b/…`：仅路径段 `a` → `b` 不同，故用 `urlReplace` 字面量替换
- 正文容器：`#mycontent`（外层 `.detail`），标题 `.h4_o`，来源 `.p_o`

## 反爬与注意事项

- 无验证码时正常返回；触发风控会返回 `code: 829`（要求验证码）、`800`（操作过于频繁）、`804`（需细化条件）
- 因此 `requestDelayMs` 设为 2000ms，`maxPages` 保守取 2；本 run 出现 800/829 即降频或减少页数
- 分页上限约 50 页；`DEAL_TIME` 用 `03`（近十天）便于断点续采回补，`resume` 命中已有日期会自动提前停止
- 详情页为 GBK 之外的 UTF-8，无需特殊解码

## 故障排查

1. `crawl:doctor --only=ggzy --detail` 看条目数与正文长度
2. 接口返回 200 但 0 条：先核对 `DEAL_STAGE` 与 `DEAL_CLASSIFY` 是否成对
3. 正文 0 字：多半是 `a/` 未被替换成 `b/`（检查 `urlReplace`）

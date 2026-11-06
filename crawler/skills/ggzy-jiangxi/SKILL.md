# 江西省公共资源交易平台（ggzy-jiangxi）

## 站点档案
- **站点名称**：江西省公共资源交易平台
- **官网主页**：https://ggzy.jiangxi.gov.cn
- **交易信息枢纽**：`/jyxx/trade.html`（catetype=jygg 招标公告 / cjgs 成交公示）
- **数据分类**：省级公共资源交易（房建市政/交通/水利/重点工程/政采/国土/产权/医药等 20+ 行业）
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome UA；接口无签名要求

## TLS 特殊性（重要）

站点要求**旧式安全重协商**（unsafe legacy renegotiation），Node 默认策略握手直接失败
（curl 不受影响）。`crawler/fetcher.ts` 已用 undici Agent
（`SSL_OP_LEGACY_SERVER_CONNECT`）全局兼容——若未来移除该 Agent，此源会失效。

## 接口（2026-11-07 接入实测）

ES 全文检索接口（站点 `/js/trade.js` 同款参数结构）：

```
POST https://ggzy.jiangxi.gov.cn/XZinterface/rest/esinteligentsearch/getFullTextDataNew
Content-Type: application/json

{"token":"","pn":0,"rn":20,"wd":"","fields":"","cnum":"",
 "sort":"{\"webdate\":\"0\",\"id\":\"0\"}",
 "condition":[{"fieldName":"categorynum","equal":null,"notEqual":null,
   "notEqualList":null,"equalList":["002006001", ...]}],
 "time":null,"noParticiple":"1","noWd":true, ...其余字段照抄 trade.js 模板}
```

- `pn` 为**行偏移量**（非页码）：config 用 `"pn":{page*20-20}`（runner 支持乘法/偏移渲染，
  不带引号使渲染后仍为合法 JSON 数字）
- `time: null` 返回全量（30 万+ 条）按 `webdate` 倒序，断点续采按新旧提前停翻
- 响应：`result.totalcount` + `result.records[]`，条目含
  `titlenew` 标题、`linkurl` 相对详情链接、`webdate` 发布时间、`categoryname` 类型名
  （如「采购公告」「成交公示」）、`categorynum` 分类号、`xiaquname` 区县名、
  `content` 正文摘要（`cl` 参数控制截断长度，仅供列表速览）
- 详情页为服务端渲染，正文容器 `div.text`（全页唯一）

## 分类号词表（来自 trade.js，2026-11）

行业前缀：`002001` 房建及市政、`002002` 交通、`002003` 水利、`002004` 重点工程、
`002005` 外贷、`002006` 政府采购、`002007` 国土资源、`002008` 产权、`002009` 林权、
`002010` 医药采购、`002011` 排污权、`002013` 其他工程（`002015`–`002026` 为后续新增
行业，trade.js 未逐一注释，按其 jygg/cjgs 两个 union 集合原样收录）。

- 招标公告（jygg）：`001`/`002` 结尾的全行业集合 → NOTICE
- 成交公示（cjgs）：`004`/`005`/`006` 结尾的全行业集合 → RESULT
- 站点未提供独立的变更/澄清 catetype；如有需要按 `categoryname` 词表抽样重建

## 诊断排查步骤

1. 列表 0 条：先确认 fetcher 的 TLS Agent 仍在（否则握手即败）；
2. 分页错乱：检查 body 模板 `"pn":{page*20-20}` 是否被误改成带引号（渲染后须是数字）；
3. 类型漂移：POST 接口抽样 300 条聚合 `categorynum`/`categoryname`，比对本文词表；
4. 详情空白：`linkurl` 若改版为壳页，重新定位正文容器。

# 海南省公共资源交易服务平台（ggzy-hainan）

## 站点档案
- **站点名称**：海南省公共资源交易服务平台
- **官网主页**：https://ggzy.hainan.gov.cn
- **数据分类**：工程建设（`003001`）+ 政府采购（`003002`），共 9 个频道
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome UA；接口无签名、无验证码

## 接口（2026-11-07 接入实测）

站点所有频道共用同一个 **ES 全文检索接口**（`common.js` 里的 `fullsearchUrl`），
靠 `condition[].equal` 的 `categorynum` 区分类目：

```
POST https://ggzy.hainan.gov.cn/inteligentsearch/rest/esinteligentsearch/getFullTextDataNew
Content-Type: application/json;charset=UTF-8
Referer: https://ggzy.hainan.gov.cn/ggzyjy/jyxx/003001/003001002/jyxx_list.html

{"token":"","pn":0,"rn":10,"fields":"title","cnum":"001",
 "sort":"{\"webdate\":\"0\"}","ssort":"title","cl":200,
 "condition":[{"fieldName":"categorynum","equal":"003001002","notEqual":null,
   "equalList":null,"notEqualList":null,"isLike":true,"likeType":2}],
 "time":[{"fieldName":"webdate","startTime":"1970-01-01 00:00:00","endTime":"2999-12-31 23:59:59"}],
 "highlights":"title","noParticiple":"1","searchRange":[],"isBusiness":"1", ...}
```

### 关键坑

1. **`fields` 必须传 `"title"`**：省略或传空字符串时接口返回 `records: []`（静默 0 条，不报错）。
2. **`pn` 是行偏移量**，不是页码：config 用 `"pn":{page*10-10}`（不带引号，渲染后是合法 JSON 数字）。
3. **`sort` 是「字符串化的 JSON」**：`"{\"webdate\":\"0\"}"`，写成对象会被接口忽略并乱序。
4. `isLike: true` + `likeType: 2` 是前缀匹配，`003001002` 会覆盖其子分类号。
5. `cl: 200` 是返回条数上限（远大于 `rn`），不影响分页。

## 分类号词表（2026-11 实测）

工程建设 `003001`：

| 分类号 | 含义 | 类型 |
| --- | --- | --- |
| 003001001 | 招标计划 | INTENTION |
| 003001002 | 招标公告 | NOTICE |
| 003001004 | 变更公告 | CHANGE |
| 003001005 | 中标候选人公示 | RESULT |
| 003001006 | 中标公告 | RESULT |
| 003001003 | 资格预审公告 | （未接入） |
| 003001007 | 异常公告 | （未接入） |

政府采购 `003002`：

| 分类号 | 含义 | 类型 |
| --- | --- | --- |
| 003002002 | 采购公告 | NOTICE |
| 003002003 | 变更公告 | CHANGE |
| 003002004 | 采购结果公告 | RESULT |
| 003002007 | 意向公开 | INTENTION |
| 003002005/006 | 合同公示 / 异常公告 | （未接入） |

## 字段说明

- `title` = `titlenew`（`title` 字段含 `<em>` 高亮标签，不要直接用）
- `url` = `linkurl`（**相对根路径**，如 `/ggzyjy/jyxx/003001/003001002/xxx.html`，runner 按页面地址解析）
- `date` = `webdate`（`YYYY-MM-DD HH:mm:ss`）
- `city` = `xiaquname`（省本级为空）
- `hint` = `categoryname`（类目名，用于地区/关键词兜底）
- `province` = 常量 `46`
- 接口无采购人字段，靠 runner 的 `extractPurchaser()` 从正文兜底（实测 100%）

## 详情页

- `linkurl` 是服务端渲染的静态详情页，直接 GET 200；
- 正文容器 `.article-info.jyxx-info`（含表格/样式），`removeSelector: script, style`；
- 附件在正文内的 `<a href="...pdf|doc|zip">` 上，由 `crawler/fidelity.ts` 自动发现。

## 诊断排查步骤

1. **列表 0 条**：先确认 body 里的 `"fields":"title"` 还在；再确认 `categorynum` 未变
   （站点改版可能重排分类号，直接抓频道页 HTML 的 `data-categorynum` 对照）。
2. **分页重复/错乱**：确认 `"pn":{page*10-10}` 渲染后是数字而非字符串。
3. **正文为空**：`article-info` 类名被改版；在详情页搜 `class="article` 定位新容器。
4. **日期 0%**：`webdate` 改名或换成时间戳；`parseDate` 已兼容毫秒/秒/`YYYYMMDD`。

# 重庆市公共资源交易平台（ggzy-chongqing）

## 站点档案
- **站点名称**：重庆市公共资源交易平台
- **官网主页**：https://www.cqggzy.com
- **数据分类**：工程建设（`014001`）+ 政府采购（`014005`），含区县频道（两江新区/万州/涪陵…）
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome UA；接口无签名/无验证码

## 接口（2026-11-07 接入实测）

站点前端（Nuxt 3）列表走 ES 检索接口：

```
POST https://www.cqggzy.com/api/v2/search-engine-page
Content-Type: application/json;charset=UTF-8
Origin: https://www.cqggzy.com
Referer: https://www.cqggzy.com/trade/014001?categoryNum=014001001

{"token":"","pn":0,"rn":12,"cnum":"001",
 "sort":"{\"istop\":\"0\",\"ordernum\":\"0\",\"webdate\":\"0\",\"newid\":\"0\"}",
 "condition":[{"fieldName":"categorynum","equal":"014001001","notEqual":null,
   "equalList":null,"notEqualList":["014001018","004002005","014001015","014005014","014008011","014008"],
   "isLike":true,"likeType":2,"noWd":true}],
 "time":[], ...其余字段照抄 config.yaml}
```

### 关键差异（与江西/贵州 ES 接口不同）

1. **响应是二次包装的 JSON 字符串**：
   `{"code":200,"content":"{\"result\":{...}}","msg":""}`
   → `itemsPath` 写 `content.result.records`，runner 的 `getByPathAuto` 会在路径
   中间遇到 JSON 字符串时自动 `JSON.parse` 再继续。
2. **`pn` 是行偏移量**，不是页码：config 用 `"pn":{page*12-12}`（不带引号，渲染后仍是合法 JSON 数字）。
3. **必须带 `Origin` 头**：缺失时返回上游原始 `{state,code,message,result}` 且 `records` 为空。
4. **`time: []` 表示不限时间**，按 `webdate` 倒序；`result.totalcount` 实测为站点未过滤总量
   （如 50332），**不能用来判断末页**，只以 `records.length < 12` 判断。
5. `isLike: true + likeType: 2` 是前缀匹配，`014001001` 会覆盖 `014001001001/002` 等子类；
   `notEqualList` 用来剔除混进来的其他大类分类号。

## 详情页

- 列表 `linkurl` 形如 `/xxhz/014001/014001001/014001001002/20261106/<id>.html`，
  **直接 GET 返回 404**，只是壳页路径；
- 实际详情是 `/trade/014001/<id>`（分类前缀任意，接口按 id 取数，可省略 `categoryNum`）；
- 正文在 Nuxt SSR payload：`<script id="__NUXT_DATA__">` 的 devalue 引用数组里，
  `currentRecord.infoContent` 是完整正文 HTML 片段（约 20KB，含表格/样式）。
  `crawler/runner.ts` 的 `extractNuxtRichContent()` 负责解引用并取出该字段；
- `<id>` 在工程建设是 UUID，在政府采购是 19 位雪花号，均从壳页 URL 最后一段提取。

## 分类号词表（2026-11 实测）

工程建设 `014001`：

| 分类号 | 含义 | 类型 |
| --- | --- | --- |
| 014001019 | 招标计划 | INTENTION |
| 014001001 | 招标公告 | NOTICE |
| 014001002 | 答疑补遗 | CHANGE |
| 014001003 | 中标候选人公示 | RESULT |
| 014001004 | 中标结果公示 | RESULT |
| 014001021 | 终止公告 | CHANGE |
| 014001014 | 邀标信息 | （未接入） |
| 014001018 | 保证金退还信息 | （噪音，排除） |
| 014001020/023 | 合同签订/变更公示 | （未接入） |

政府采购 `014005`：

| 分类号 | 含义 | 类型 |
| --- | --- | --- |
| 014005001 | 采购公告 | NOTICE |
| 014005002 | 变更公告 | CHANGE |
| 014005004 | 采购结果公告 | RESULT |
| 014005008 | 单一来源公示 | INTENTION |
| 014005014 | 保证金退还信息 | （噪音，排除） |

## 字段说明

- `title` = `title`（另可看 `titlenew`/`customtitle`，一般与 title 一致）
- `url` = `linkurl`（壳页，详情由 `detail.urlTemplate` 拼）
- `date` = `infodate`（`YYYY-MM-DD HH:mm:ss`，parseDate 直接支持）
- `purchaser` = `companyname`（招标人/采购人，10 个列表实测 100% 命中）
- `city` = `infoc`（区县名；`市级`/`自主招标` 不是行政区，用正则 `^(.+?(?:区|县|市))$` 过滤为空）
- `province` = 常量 `50`
- `extraFields.projectNo` = `projectno`（常为空）

## 诊断排查步骤

1. **列表 0 条**：先查 `Origin`/`Referer` 头是否丢失；再确认 `itemsPath` 仍是 `content.result.records`
   （若站点改成直接返回对象，需改回 `result.records` 并删除二次解析依赖）。
2. **分页错乱/重复**：确认 body 里 `"pn":{page*12-12}` 未被改成带引号的字符串
   （带引号会渲染成 `"pn":"0"` 导致偏移失效）。
3. **详情正文为空**：确认详情 URL 是 `/trade/014001/<id>` 而不是 `linkurl`；
   payload 字段若改名，需同步 `extractNuxtRichContent()` 的 `infoContent` 候选。
4. **类型漂移**：抽样 300 条聚合 `categorynum` 前 6 位，比对上方词表；
   新增子类（如 `014001001003`）会被前缀匹配自动收进对应列表，无需改配置。

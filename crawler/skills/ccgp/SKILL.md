# Skill：ccgp —— 中国政府采购网（中央单位公告）

## 站点概况

- 入口：http://www.ccgp.gov.cn/（财政部指定政府采购信息发布媒体）
- 本 skill 抓取**中央单位**采购公告：`/cggg/zygg/` 下各频道
- 地方单位公告由 `ccgp-dfgg` skill 负责（`/cggg/dfgg/`，结构完全相同）

## 页面结构（2026-09 实测）

### 列表页

- 频道首页：`http://www.ccgp.gov.cn/cggg/zygg/gkzb/`（index.htm）
- 翻页：TRS 静态页，第 2 页为 `index_1.htm`、第 3 页为 `index_2.htm`……
  因此模板写 `index_{page-1}.htm`，首页用 `firstPageUrl` 指向频道目录
- 条目选择器：`ul.c_list_bid > li`，结构：

```html
<li>
  <a href="./202609/t20260909_27300551.htm" title="标题">标题</a>
  发布时间：<em>2026-09-09 22:47</em>
  地域：<em>四川</em>
  采购人：<em>四川大学</em>
</li>
```

- 字段：`em:eq(0)` 发布时间（YYYY-MM-DD HH:mm）、`em:eq(1)` 地域（省份简称）、`em:eq(2)` 采购人

### 详情页

- 正文容器：`div.vF_detail_content`（标题在 `div.vF_deail_currentloc` 下方的 h2/`div.vF_detail_content_container`）
- 编号、预算、截止时间等信息在正文中，执行器不做结构化抽取，整段正文入库供关键字搜索

## 频道与类型映射

| 频道 | 路径 | 类型 |
|---|---|---|
| 公开招标公告 | /cggg/zygg/gkzb/ | NOTICE |
| 中标公告 | /cggg/zygg/zbgg/ | RESULT |
| 成交公告 | /cggg/zygg/cjgg/ | RESULT |
| 更正公告 | /cggg/zygg/gzgg/ | CHANGE |
| 询价公告 | /cggg/zygg/xjgg/ | INQUIRY |
| 竞争性谈判公告 | /cggg/zygg/jzxtpgg/ | INQUIRY |
| 竞争性磋商公告 | /cggg/zygg/jzxcs/ | INQUIRY |

其他可用频道：邀请招标 yqzbgg、资格预审 zgysgg、废标终止 fblbgg（如需可在 config.yaml 中照样式追加 list 段）。

## 注意事项

1. **反爬**：全文搜索接口 `search.ccgp.gov.cn/bxsearch` 有 IP 频控（返回「频繁访问!」静态页），本 skill 不使用该接口，只抓静态频道页，实测稳定。请保持 `requestDelayMs ≥ 1000`
2. 「频繁访问」页特征：`<title>频繁访问!中国政府采购网</title>`；若出现说明 IP 被临时限流，等待或降低频率
3. 地域字段是省级简称（如「四川」「内蒙古」），执行器会与区划库匹配；少数条目地域为空时按标题/正文自动识别
4. 正文可能包含附件表格（`contentTable` 注释块），无需特殊处理，cheerio 提取纯文本

## 诊断与修复

1. 状态 FAILED 且报「列表解析失败」：打开频道页核对 `ul.c_list_bid` 是否变化，更新 `itemSelector`
2. 报 HTTP 403/频繁访问：增大 `settings.requestDelayMs`、降低 `maxPages`
3. 翻页规则变化：核对 `index_N.htm` 规律（看频道页「下一页」实际链接）
4. 修改 config 后试跑：`npm run crawl -- ccgp`

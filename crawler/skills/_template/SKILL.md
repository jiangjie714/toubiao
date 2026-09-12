# Skill 模板说明

复制本目录为新的 skill（目录名即 skillCode，需与数据库 CrawlSource.skillCode 一致）：

```bash
cp -r crawler/skills/_template crawler/skills/<你的站点代号>
```

然后：

1. 修改 `config.yaml` 中的抓取规则
2. 重写本文件为该站点的档案（入口、结构、字段口径、注意事项）
3. 在后台「数据源」中确认该源已启用，或 `npm run crawl -- <skillCode>` 单独试跑

## config.yaml 字段说明

| 字段 | 说明 |
|---|---|
| `source.name` | 展示名称，写入公告的「信息来源」 |
| `source.baseUrl` | 用于把相对链接解析为绝对 URL |
| `settings.maxPages` | 每个列表默认抓取页数（手动触发可用 `--maxPages` 覆盖） |
| `settings.requestDelayMs` | 同源两次请求的间隔，保持礼貌抓取 |
| `lists[].type` | 公告类型：NOTICE 招标 / RESULT 中标 / CHANGE 变更 / INQUIRY 询价竞谈 |
| `lists[].mode` | `html`（cheerio 选择器）或 `json`（接口返回 JSON） |
| `lists[].url` | html 模式列表页地址，`{page}` 为页码占位符 |
| `lists[].request` | json 模式请求定义（method/url/headers/form，值支持 `{page}`） |
| `lists[].parse.itemSelector` | html 模式：每条公告元素的选择器 |
| `lists[].parse.itemsPath` | json 模式：响应中数组所在点路径，如 `data` |
| `lists[].parse.fields.*` | 字段映射。html 为 `{selector, attr, regex}`；json 为点路径字符串；`date/province/city/purchaser/agency/hint` 可省略 |
| `fields.date` | 任意常见中文日期写法均可识别；缺省时以抓取时间代替 |
| `fields.hint` | 额外摘要文本，仅用于辅助地区识别 |
| `lists[].detail` | 详情页正文抽取：`contentSelector` 必填，`removeSelector` 剔除正文内噪音；缺省则不抓详情，以 hint 作正文 |

地区识别由执行器统一完成：对 `province/city 字段 + 标题 + hint + 正文前 300 字` 做省市级区划名匹配，config 里无需额外配置。

## 诊断与修复流程（站点改版时）

1. 在后台「数据源」页查看该源状态与错误信息，或 `npm run crawl -- <skillCode>` 复现
2. 错误若为「列表解析失败」，说明 `itemSelector` / `itemsPath` 失效：
   - 用浏览器或 `curl` 打开列表页，找到公告条目的新选择器
   - 更新 config.yaml 后重跑
3. 错误若为 `HTTP 403/429`，检查是否被反爬：调整 `settings.userAgent`、增大 `requestDelayMs`
4. 修改后务必试跑并核对入库数据（标题/日期/地区/类型/正文）是否正确

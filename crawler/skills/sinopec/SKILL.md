# 中国石化物资招标投标网（sinopec）

## 站点档案
- **站点名称**：中国石化物资招标投标网
- **官网主页**：https://bidding.sinopec.com
- **公告频道**：https://bidding.sinopec.com/bidding/bidNoticeList.html
- **数据分类**：央企采购电商
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `table.list_table tr:gt(0)` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.article-content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：TLS 指纹 WAF

bidding.sinopec.com 对非浏览器 TLS 指纹直接重置连接（curl 与 node 均复现，legacy-renegotiation 选项无效）。需住宅代理或 TLS 指纹伪装（curl-impersonate 等）。

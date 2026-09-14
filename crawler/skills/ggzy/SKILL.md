# 全国公共资源交易平台（ggzy）

## 站点档案
- **站点名称**：全国公共资源交易平台
- **官网主页**：http://www.ggzy.gov.cn
- **公告频道**：http://www.ggzy.gov.cn/information/html/a/trade.html
- **数据分类**：国家公共资源交易
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.publicont > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.detail-content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：站点改版

`/information/html/a/trade.html` 404，站点信息发布结构已调整。需按新版全国公共资源交易平台重新定位频道页。

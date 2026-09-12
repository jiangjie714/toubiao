# 中国中铁采购电子商务平台（crec）

## 站点档案
- **站点名称**：中国中铁采购电子商务平台
- **官网主页**：https://www.crecgec.com
- **公告频道**：https://www.crecgec.com/cms/channel/purchase_notice/index.htm
- **数据分类**：央企采购电商
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.notice-ul > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.notice-info` 是否有嵌套 iframe 或动态渲染。

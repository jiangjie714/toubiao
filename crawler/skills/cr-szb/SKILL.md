# 华润守正电子招标平台（cr-szb）

## 站点档案
- **站点名称**：华润守正电子招标平台
- **官网主页**：https://szb.crc.com.cn
- **公告频道**：https://szb.crc.com.cn/tzgg/index.jhtml
- **数据分类**：央企采购电商
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.news-ul > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.content_detail` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：TLS 指纹 WAF

szb.crc.com.cn 对非浏览器 TLS 指纹立即重置连接（curl 与 node 均复现）。同石化站点，需 TLS 指纹伪装。

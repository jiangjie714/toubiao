# 中国联通采购与招标网（chinaunicombidding）

## 站点档案
- **站点名称**：中国联通采购与招标网
- **官网主页**：http://www.chinaunicombidding.cn
- **公告频道**：http://www.chinaunicombidding.cn/jsp/cninfo/listProcurementNotice.jsp
- **数据分类**：央企采购电商
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `table.noticeTable tr:gt(0)` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.notice-box` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：WAF 拦截

listProcurementNotice.jsp 返回 412 Precondition Failed（JS 挑战型 WAF）。静态抓取不可行，需带 Cookie 会话或无头浏览器。

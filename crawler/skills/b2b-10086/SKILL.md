# 中国移动采购与招标网（b2b-10086）

## 站点档案
- **站点名称**：中国移动采购与招标网
- **官网主页**：https://b2b.10086.cn
- **公告频道**：https://b2b.10086.cn/b2b/main/listVendorsNoticeResult.html
- **数据分类**：央企采购电商
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `table.notice-table tr:gt(0)` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.notice-content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：TLS+SPA 双重障碍

传输层：站点使用老式 TLS 重协商，OpenSSL3 默认拒绝（undici Agent `secureOptions: SSL_OP_LEGACY_SERVER_CONNECT` 可通过，已验证 HTTP 200）；应用层：页面为 Vue SPA（/js/app.*.js），列表需逆向其 XHR 接口（app bundle 内可见 /noticeDetail 等路由）。

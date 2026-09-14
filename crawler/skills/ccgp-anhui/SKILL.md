# 安徽省政府采购网（ccgp-anhui）

## 站点档案
- **站点名称**：安徽省政府采购网
- **官网主页**：http://www.ccgp-anhui.gov.cn
- **公告频道**：http://www.ccgp-anhui.gov.cn/cms/channel/purchase_notice/index.htm
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.line_list > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.detail_con` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：站点改版(SPA)

页面已迁移至政采云(ZCY)平台，列表/详情均由 axios 动态渲染，静态 HTML 无列表项，`ul.line_list` 选择器失效。
修复方向：逆向 `searchUrl: /site/search` JSON 接口（注意 headers/签名），或改用无头浏览器渲染。

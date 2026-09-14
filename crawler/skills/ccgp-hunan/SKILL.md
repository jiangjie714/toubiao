# 湖南省政府采购网（ccgp-hunan）

## 站点档案
- **站点名称**：湖南省政府采购网
- **官网主页**：http://www.ccgp-hunan.gov.cn
- **公告频道**：http://www.ccgp-hunan.gov.cn/mvc/getNoticeList4Web.do
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.list_news > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.art-content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：后端接口下线

列表接口 `mvc/getNoticeList4Web.do` 返回 404；首页 169KB 但无静态公告链接。需抓包找新接口。

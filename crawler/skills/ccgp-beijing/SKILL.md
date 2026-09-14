# 北京市政府采购网（ccgp-beijing）

## 站点档案
- **站点名称**：北京市政府采购网
- **官网主页**：http://www.ccgp-beijing.gov.cn
- **公告频道**：http://www.ccgp-beijing.gov.cn/xxgg/sjzfcggg/
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.listBox > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.articleBox` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：列表XHR动态加载

`/xxgg/A002004index_1.htm` 信息公告频道可访问但列表由 JS 加载（页面仅导航）。另发现意向公开静态频道 `/yxgk/sjcgyx/A002003001index_1.htm` 可作备选。需抓包定位公告列表 XHR 接口。


## 2026-09-14 修复记录：市级采购意向公开频道

- 原 `/xxgg/sjzfcggg/` 主公告频道 404，且信息公告主频道 `/xxgg/` 已改为 XHR 动态加载（页面仅剩导航，列表由前端拉取），静态抓取无数据，待抓包逆向后接入。
- 已接入静态可用的**市级采购意向公开**频道：`/yxgk/sjcgyx/A002003001index_{page}.htm`，选择器 `ul.inner-ul > li`，日期 `span.datetime`，详情正文 `#mainText`。
- 未验证：区级意向公开子频道（A002003 系列其它编号）。

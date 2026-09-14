# 广东省政府采购网（ccgp-guangdong）

## 站点档案
- **站点名称**：广东省政府采购网
- **官网主页**：https://gdgpo.czt.gd.gov.cn
- **公告频道**：https://gdgpo.czt.gd.gov.cn/freecms/rest/v1/notice/selectNoticeInfoList
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.m-list > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.notice-detail` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：接口维护中

配置 URL 本身是 freecms REST 接口 `/freecms/rest/v1/notice/selectNoticeInfoList`，POST 各类分页参数均返回「维护中」提示页（接口被官方停用）。需等接口恢复或改抓 gdgpo 前端页。

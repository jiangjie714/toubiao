# 浙江省政府采购网（ccgp-zhejiang）

## 站点档案
- **站点名称**：浙江省政府采购网
- **官网主页**：http://zfcg.czt.zj.gov.cn
- **公告频道**：http://zfcg.czt.zj.gov.cn/innerUsed_noticeList/index.html
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.notice-list > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.notice-content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：站点改版(SPA)

`zfcg.czt.zj.gov.cn/innerUsed_noticeList/index.html` 为政采云 SPA（95KB 壳页 + luban 组件），静态抓取无数据。修复方向同政采云系：逆向 /site/search 接口。

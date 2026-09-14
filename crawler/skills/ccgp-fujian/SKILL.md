# 福建省政府采购网（ccgp-fujian）

## 站点档案
- **站点名称**：福建省政府采购网
- **官网主页**：http://zfcg.czt.fujian.gov.cn
- **公告频道**：http://zfcg.czt.fujian.gov.cn/notice/index.htm
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.list-group > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 采集诊断：WAF 拦截

`notice/index.htm` 返回 403（反爬拦截）。需检查 UA/Cookie 策略或代理出口。

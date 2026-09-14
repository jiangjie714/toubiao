# 河南省政府采购网（ccgp-henan）

## 站点档案
- **站点名称**：河南省政府采购网
- **官网主页**：http://www.ccgp-henan.gov.cn
- **公告频道**：http://www.ccgp-henan.gov.cn/henan/ggcx
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，核对前端 DOM 选择器 `ul.List2 > li` 是否有改版更新；
3. 若详情页截取空白，检查正文容器 `div.Content` 是否有嵌套 iframe 或动态渲染。


## 2026-09-14 修复记录：通知公告频道

- 列表改用 `list2?gglx=2`（通知公告，含框架协议征集/成交等混合公告），选择器 `div.List2 > ul > li`，日期取 `span.Gray`。
- 详情壳页 `/henan/content?infoId=…` 由前端渲染，正文实际存于静态文件 `/webfile/henan/wzxx/tzgg/webinfo/{发布年}/{发布月}/{infoId}.htm`；runner 新增 `detail.urlTemplate` 支持（`{query:参数名}/{YYYY}/{MM}/{DD}` 占位）直取静态文件。
- 该频道更新频率低（多为框架协议类公告）。
- **未修复**：首页「采购信息」主公告流（H600101 采购公告/H600102 中标成交/H600103 更正等）在 `/henan/ggcx` 内由 XHR 出数，详情 webfile 路径带随机前缀（`/cmsweb35rc67w/henan/cgxx/jggg/webinfo/{年}/{月}/{日}/{infoId}.htm`）且按频道分目录，需抓包逆向后另行接入。

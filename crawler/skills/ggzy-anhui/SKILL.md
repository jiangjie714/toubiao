# 安徽省公共资源交易平台（ggzy-anhui）

## 站点档案
- **站点名称**：安徽省公共资源交易监管网
- **官网主页**：https://ggzy.ah.gov.cn
- **数据分类**：工程建设（`/jsgc`）+ 政府采购（`/zfcg`），共 5 个频道
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome UA；列表是传统 HTML 表单 POST，无验证码

## 列表（2026-11-07 接入实测）

服务端渲染 HTML，`<form id="mySearch" action="/jsgc/list" method="post">`，
分页字段是 **`currentPage`**（不是 `page`）：

```
POST https://ggzy.ah.gov.cn/jsgc/list
Content-Type: application/x-www-form-urlencoded; charset=UTF-8

currentPage=1&tenderProjectType=1&bulletinNature=1&jyptId=&region=
```

- 工程建设 `/jsgc/list`：`tenderProjectType=1`，`bulletinNature` 1=招标公告 / 2=中标候选人 / 3=中标结果
- 政府采购 `/zfcg/list`：`bulletinNature` 1=采购公告 / 3=中标结果（另有 `time` 字段，留空即全部）

条目结构：

```html
<li class="list-item">
  <a href="/jsgc/newDetail?guid=...&tenderProjectType=1&bulletinNature=1">
    <span class="area m-l-25">【滁州市-来安县-招标公告】</span>
    <span class="title clamp-1" title="完整标题">截断的标题…</span>
  </a>
  <span class="date float-r m-r-40">2026-11-06</span>
</li>
```

- `title` 必须取 `.title[title]` 属性，文本节点是省略号截断的
- 地区取 `.area` 的正则 `^【([^-]+)-` → 市级名（如「滁州市」）

## 详情：POST 异步接口

`/jsgc/newDetail` 只是**壳页**，正文由页面底部 `start()` 再发一次 Ajax 取回：

```js
$.ajax({ type:'POST', url:'/jsgc/newDetailSub',
  data:{ type:'tender', bulletinNature:'1', guid:'<uuid>', statusGuid:'' } })
```

- 工程建设：`/jsgc/newDetailSub`，`type` 取 `tender`(招标) / `pbjg`(候选人) / `zbjg`(结果)
- 政府采购：`/zfcg/newDetailSub`，`type` 取 `bulletin`(采购公告) / `zbjg`(中标结果)
- 响应体根节点即正文容器 `.article-text-box`（不是整页 HTML）
- config 用 `detail.request.form` + `{query:guid}` / `{query:bulletinNature}` 从条目地址回填参数

## 已知问题：502 抖动

站方 `newDetailSub` 对本机出口 IP（`121.32.243.71`）**约 30%~50% 概率直接返回 HTTP 502**，
且失败固定耗时 ~6.3s（网关超时）；同一时刻换出口（如走本地代理）则 100% 200。
已排查并排除：连接复用（`Connection: close` / `keepAliveTimeout` / `pipelining:0` 均无效）、
HTTP/2（站点只支持 1.1）、请求头差异（curl 与 undici 对齐后仍抖动）。

处置：`settings.retries: 4`（共 5 次尝试，单条成功率 ≈ 99%）。代价是失败条目会拖慢整轮
（单列表 30 条最坏约 10 分钟），但 doctor 5/5 列表全部 OK。

## 字段说明

- `title` = `.title` 的 `title` 属性
- `url` = `a[href]`（相对路径，runner 按页面地址解析）
- `date` = `.date` 文本 `YYYY-MM-DD`
- `city` = `.area` 正则 `^【([^-]+)-`
- `province` = 常量 `34`
- 列表无采购人，靠正文 `extractPurchaser()` 兜底（实测 67%）

## 诊断排查步骤

1. **列表 0 条**：确认 POST 而不是 GET；确认 `currentPage` 字段名；`Referer` 缺失时部分
   频道会返回空列表页。
2. **详情正文为空**：说明走成了壳页——检查 `detail.request.url` 是否指向 `newDetailSub`，
   以及 `{query:guid}` 是否渲染成功（列表地址必须带 `guid=`）。
3. **大面积 502**：见上节，先确认是站方抖动而不是配置；提高 `retries` 或换出口验证。
4. **类型错位**：`bulletinNature` 与 `detail.request.form.type` 必须成对（1↔tender/bulletin、
   2↔pbjg、3↔zbjg），否则接口返回另一类公告或空。

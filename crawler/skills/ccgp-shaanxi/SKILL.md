# 陕西省政府采购网（ccgp-shaanxi）

## 站点档案
- **站点名称**：陕西省政府采购网
- **官网主页**：http://www.ccgp-shaanxi.gov.cn
- **公告频道**：http://www.ccgp-shaanxi.gov.cn/cms-sx/site/shanxi/xxgg/index.html?result=result
- **数据分类**：省级政府采购
- **反爬策略**：同源请求间隔 ≥1.5s，标准 Chrome User-Agent，自动解析编码

## 诊断排查步骤
1. 若拨测探测超时，检查目标官网防火墙或 CDN 状态；
2. 若列表解析为 0，先看下方「2026-10-29 逆向结论」——接口需签名头且**强制验证码**；
3. 若详情页截取空白，检查正文容器是否嵌套 iframe 或动态渲染。

## 2026-09-14 采集诊断：列表XHR动态加载

xxgg 频道壳页无静态列表（freecms templetPro.do 模板引擎动态出数）。需抓包定位列表数据接口。

## 2026-10-29 逆向结论：签名已破解，但验证码是硬门（保持停用）

站点已整站改版为 `/cms-sx/site/shanxi/`（旧 `notice/noticeaframe.do` 404）。列表走 JSON 接口：

```
GET http://www.ccgp-shaanxi.gov.cn/freecms/rest/v1/notice/selectInfoMoreChannel.do
    ?siteId=a7a15d60-de5b-42f2-b35a-7e3efc34e54f
    &channel=1eb454a2-7ff7-4a3b-b12c-12acc2685bd1
    &currPage=1&pageSize=10
    &noticeType=00101,001011        # 公告类型码（左侧栏目各有映射，见频道页内联 JS）
    &regionCode=610001&purchaseManner=&title=&verifyCode=&openTenderCode=
    &purchaseNature=&operationStartTime=&operationEndTime=<yyyy-MM-dd HH:mm:ss>
    &selectTimeName=noticeTime&cityOrArea=
```

### 签名算法（已在 Node 复现成功，HTTP 200）

请求头四个（页面内联 JS + `resources/js/publicMethods.js`、`sha1.js`、`md5.js`、`jsencrypt.min.js`）：

```ts
const P = '/freecms/rest/v1/notice/selectInfoMoreChannel.do';   // getFreecms() + 路径，不含 query
const ts = Date.now();
sign    = md5Hex(sha1Hex(`${ts}_${P}_bosssoft_platform_095285`));   // 标准 sha1/md5 小写 hex
nsssjss = base64(RSA_PKCS1_encrypt(`${P}$$${ts}`));                 // jsencrypt 同款 PKCS#1 v1.5
// headers: { nsssjss, time: String(ts), url: P, sign }
```

RSA 公钥（`publicMethods.js` 内置，X.509 SubjectPublicKeyInfo）：

```
MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQCS2TZDs5+orLYCL5SsJ54+bPCV
s1ZQQwP2RoPkFQF2jcT0HnNNT8ZoQgJTrGwNi5QNTBDoHC4oJesAVYe6DoxXS9Nl
s8WbGE8ZNgOC5tVv1WVjyBw7k2x72C/qjPoyo/kO7TYl6Qnu4jqW/ImLoup/nsJp
pUznF0YgbyU/dFFNBQIDAQAB
```

响应 JSON：`{ code, total, data: [{ id, title, noticeTime, regionName, noticeType, pageurl, ... }] }`；
详情页地址 = `pageurl?noticeType=<noticeType>&noticeId=<id>`。

### 硬门：接口强制验证码（勿绕过）

**任何**未携带有效 `verifyCode` 的请求（包括干净会话、完整签名头、浏览器等价首访）都返回
`{"msg":"验证码错误或已失效，请刷新或者重试","code":"-1"}`。频道页交互也是同样的验证码弹窗——
这是站方对列表接口的**人类验证门**，属于本仓库合规红线（`docs/商业化计划书.md` 第八章）明确
不绕过的类型；不做 OCR/打码。

### 复活条件与下一步

- 若站方放开验证码（或出现无需验证码的栏目/区县子站/移动端接口），接入方案已就绪：
  签名算法如上；但 runner 目前只支持静态 `settings.headers`，需先在 `crawler/fetcher.ts`
  增加「按 skillCode 注册的动态签名钩子」（每请求重算 ts/sign/nsssjss），届时一并实现。
- 时间戳、公钥、参数名均以本次实测为准；若再次改版，从频道页内联 JS 重新提取。

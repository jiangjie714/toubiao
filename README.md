# 标讯通 —— 招投标信息服务平台

类千里马的招投标信息聚合站：登录后按**地区 + 类型**筛选公告，支持**关键字全文搜索**；
数据由 Skills 化爬虫从公开渠道自动抓取，管理后台可管用户、管公告、管数据源。

> 📈 商业化升级规划（竞品分析 / 采集技能 v2 / 配置中心 / 会员支付 / 路线图）见
> [docs/商业化计划书.md](docs/商业化计划书.md)
> 🔧 配套技术架构详细方案（数据模型 / 技能体系 / 调度队列 / 丰富化管道）见
> [docs/技术架构方案.md](docs/技术架构方案.md)

## 功能

**前台**（登录后可用）

- `/` 首页：关键字搜索、四类信息入口、省级快捷导航、最新公告
- `/list` 信息检索：关键字 + 省/市级联地区 + 类型（招标公告 / 中标公告 / 变更更正 / 询价竞谈）+ 发布日期区间 + 分页，筛选条件全部在 URL 参数中，可直接分享
- `/tender/[id]` 公告详情：摘要字段 + 正文 + 原文链接

**管理后台**（`/admin`，仅 ADMIN 角色）

- 仪表盘：总量 / 今日新增 / 分类统计 / 数据源异常 / 最近抓取
- 信息管理：公告的手动补录、编辑、删除、搜索
- 用户管理：账号管理、密码重置、启用/停用与邮箱激活状态
- 订单管理：线下对公转账订单确认与开通、微信与支付宝线上订单状态监控
- 支付事件：微信支付与支付宝异步回调事件明细、签名与幂等校验、失败排查
- 导出审计：记录用户在何时基于何种条件导出了多少条数据、客户端 IP 与 User Agent，供风控与客户对账
- 推送监控：关键词推送监控、订阅规则与历史投递记录
- 数据源：启用/停用、状态监控、一键手动抓取
- 抓取日志：每次抓取的结果与失败原因

## 快速开始

要求 Node.js ≥ 20。

```bash
npm install

# 1. 建库 + 生成 Prisma 客户端
npx prisma db push

# 2. 初始化数据（全国省市区划、管理员账号、示例公告、默认数据源）
npm run db:seed

# 3. 启动
npm run dev            # 开发模式，http://localhost:3000
# 或
npm run build && npm start
```

默认管理员：`admin / admin123`（在 `.env` 中修改，登录后请尽快在后台重置密码）。

环境变量（`.env`）：

| 变量 | 说明 |
|---|---|
| `DATABASE_URL` | PostgreSQL 连接串，本地默认 `postgresql://toubiao:toubiao@127.0.0.1:5432/toubiao?schema=public` |
| `AUTH_SECRET` | 登录会话签名密钥，生产必须换成随机长字符串 |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | 初始管理员账号（仅 seed 使用） |
| `APP_URL` | 邮件中的站点链接，生产必须使用 HTTPS 域名 |
| `CRAWL_CRON` | 定时抓取的 cron 表达式，默认 `0 */2 * * *`（每 2 小时） |
| `CRAWL_MAX_PAGES` | 每个列表频道每次抓取的页数，默认 2 |
| `PUSH_CRON` | 每日邮件推送 cron，默认 `0 8 * * *` |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_SECURE` | SMTP 服务地址、端口与是否使用隐式 TLS |
| `SMTP_USER` / `SMTP_PASSWORD` | SMTP 认证信息；无需认证的邮件服务可留空 |
| `SMTP_FROM` | 发件人地址，必须符合邮件服务商的域名/发件人策略 |
| `ALIPAY_APP_ID` / `ALIPAY_PRIVATE_KEY` | 支付宝应用 ID 与商户私钥，用于生成扫码预支付订单 |
| `ALIPAY_PUBLIC_KEY` / `ALIPAY_PUBLIC_CERT` | 支付宝异步通知验签公钥或证书 |
| `WECHAT_PAY_MERCHANT_CERT_SERIAL` | 微信支付商户证书序列号，用于 APIv3 请求签名 |
| `WECHAT_PAY_MERCHANT_PRIVATE_KEY` | 微信支付商户私钥，用于 APIv3 请求签名 |
| `WECHAT_PAY_PLATFORM_CERT_SERIAL` | 微信支付平台证书序列号，用于回调证书校验 |
| `WECHAT_PAY_PLATFORM_PUBLIC_KEY` / `WECHAT_PAY_PLATFORM_CERT` | 微信支付平台公钥或证书，用于回调验签 |
| `WECHAT_PAY_API_V3_KEY` | 微信支付 APIv3 密钥，32 位，用于回调报文解密 |
| `ALIPAY_NOTIFY_URL` / `WECHAT_PAY_NOTIFY_URL` | 提供给支付平台的 HTTPS 回调地址 |

## 数据抓取（Skills 架构）

每个数据源网站打包为一个 **skill**：`crawler/skills/<代号>/` 目录内含站点档案
`SKILL.md`（页面结构、字段口径、反爬注意事项、诊断修复流程）和结构化抓取规则
`config.yaml`（列表地址、翻页、选择器/字段映射、详情正文提取）。**加新站 = 复制
`_template` 目录改两份文件，不改任何核心代码。**

```
crawler/
├── cli.ts        # 手动抓取：npm run crawl [skillCode...]
├── worker.ts     # 定时抓取：npm run crawl:worker（node-cron，按 CRAWL_CRON）
├── runner.ts     # 通用执行器：读 config.yaml → 抓列表翻页 → 解析 → 抓详情 → 去重入库 → 写日志
├── fetcher.ts    # 带超时/重试/GBK 兼容的抓取库
├── regions.ts    # 省市区划文本识别（自动归类公告地区）
├── dates.ts      # 中文日期解析
└── skills/
    ├── _template/      # 新增数据源从这里复制
    ├── ccgp/           # 中国政府采购网（中央单位公告）
    └── ccgp-dfgg/      # 中国政府采购网（地方单位公告）
```

当前内置源：**中国政府采购网**（中央 + 地方两组频道，覆盖招标 / 中标（成交）/
更正 / 询价 / 竞争性谈判 / 竞争性磋商七类频道）。全国公共资源交易平台
（deal.ggzy.gov.cn）2026-09 实测整站不可达（502），待其恢复后可按模板添加。

试跑与排障：

```bash
npm run crawl -- ccgp              # 只抓指定源
CRAWL_MAX_PAGES=1 npm run crawl    # 控制抓取深度
```

数据源失效（站点改版/反爬）时：后台「数据源」页会标红，进入对应 skill 的
`SKILL.md` 按「诊断与修复」章节更新 `config.yaml` 即可，无需改代码。

抓取策略：同源请求间隔 ≥ 1.2s、Chrome UA、失败重试 2 次；按 `sourceUrl` 唯一去重，
重复公告只更新不重复入库。

## 数据库

Prisma + PostgreSQL。迁移与种子数据：

```bash
docker compose up -d postgres
npx prisma migrate deploy
npm run db:seed
```

升级搜索：当前使用 PostgreSQL `contains` 匹配；数据到百万级可迁移 Meilisearch 或
PostgreSQL 全文索引，`src/lib/query.ts` 的 `buildWhere` 是唯一需要替换的查询构造点。

## 部署

推荐使用 Docker Compose 启动完整生产拓扑：

```bash
cp .env.example .env   # 按生产环境修改
docker compose up -d app worker push-worker
```

服务说明：

- `app`：Next.js 站点与 API，默认 3000 端口
- `worker`：定时抓取与附件任务
- `push-worker`：每日关键词邮件推送，默认北京时间 08:00
- `postgres`：数据库，数据持久化在 `postgres-data` 卷

生产环境注意：修改 `AUTH_SECRET`、`APP_URL`、`SMTP_*`，用 Nginx 反代 HTTPS。
`SMTP_HOST` 未配置时，邮件只输出 `[mailer:dev]` 日志，不会真实发送；上线前必须配置
SMTP 并用真实邮箱验证注册邮件和每日推送。

### 支付回调

支付宝与微信支付回调必须使用公网 HTTPS 域名，并保持反向代理 **不修改原始请求体**：

- 支付宝：`POST /api/payment/alipay/notify`
- 微信支付：`POST /api/payment/wechat/notify`

支付宝通知使用支付宝公钥 RSA2 验签；微信支付通知使用平台证书/公钥验签，并用 APIv3
密钥解密报文。回调处理内置订单号、渠道、金额与状态校验，并通过 `PaymentEvent`
表保证同一通知幂等。验签或金额不匹配时不会开通订阅。

用户在套餐页选择微信或支付宝后，系统创建待支付订单，调用对应渠道预下单接口并把
返回的 `code_url` / `qr_code` 渲染为本地二维码。支付页每 5 秒刷新订单状态，收到成功
回调后自动显示开通成功。商户私钥只透传给 `app` 服务，不传给抓取和推送 worker。

### 运营审计与风控对账

- **导出审计**（`/admin/audits/exports`）：每次用户成功导出 Excel 时，系统记录 `ExportAudit` 审计记录（导出用户、检索条件、匹配条数、导出条数、客户端 IP 与 User Agent），用于防爬监控与企业客户对账。
- **支付事件监控**（`/admin/payment-events`）：记录微信支付与支付宝的全部异步回调事件、处理状态、关联订单与异常错误信息，支持异常事件排查与人工对账。

## 目录结构

```
src/
├── app/
│   ├── (site)/        # 前台：首页 /list /tender/[id]
│   ├── admin/         # 后台：仪表盘、信息、用户、数据源、日志
│   ├── api/crawl/run/ # 手动触发抓取（ADMIN）
│   ├── login/         # 登录页
│   └── actions/       # 登录/登出 server actions
├── components/        # 筛选栏等
├── lib/               # prisma 单例、会话、常量、查询构造
└── middleware.ts      # 会话守卫（未登录跳 /login，/admin 要求 ADMIN）
```

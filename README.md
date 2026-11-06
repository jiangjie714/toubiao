# 标讯通 —— 招投标信息服务平台

类千里马的招投标信息聚合 + 商业化 SaaS 平台：游客可浏览 SEO 公开页，登录后按**地区 + 类型**
筛选公告、关键字检索、订阅关键词推送；企业订阅解锁供应商全景、竞对雷达、历史大数据、
标书装配、销售 CRM 等模块；数据由 Skills 化爬虫集群从公开渠道自动抓取，自带队列调度、
健康分告警与熔断自愈。

技术栈：Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript，
Prisma 6 + PostgreSQL 16，Docker Compose 生产部署。

> 📈 商业化方向与 M0–M2 需求基线（竞品分析 / 采集技能 v2 / 配置中心 / 会员支付 / 路线图）
> 见 [docs/商业化计划书.md](docs/商业化计划书.md)，配套技术详设见
> [docs/技术架构方案.md](docs/技术架构方案.md)（两份为 2026-09 设计基线，M0/M1 已实施完毕）。
> 🚀 上线前合法运营检查项见 [docs/生产部署配置清单.md](docs/生产部署配置清单.md)；
> 战略取舍（深耕 / 冻结清单）见 [docs/商业化深耕与冻结决策.md](docs/商业化深耕与冻结决策.md)。

## 功能全景

**游客（免登录 SEO 区）**

- `/gonggao` 公开公告大厅：类型×省份维度落地页矩阵、公告脱敏详情页，配合 `sitemap.ts`/`robots.ts` 做搜索引擎收录

**登录用户（免费/个人）**

- `/` 一站检索首页、`/list` 信息检索（关键字 + 省/市级联地区 + 四类公告 + 日期区间 + 预算区间 + 行业，条件全在 URL 参数可分享）
- `/tender/[id]` 公告详情（正文分区解析、字段溯源、查看配额扣减）、`/tenders/compare` 多标横向对比
- `/calendar` 招投标日历、`/watches` 关键词订阅推送、`/purchasers` 买方大厅、`/regions` 区域大盘、`/industries` 行业情报包、`/brief` 决策周报
- `/pricing` 套餐价格 → `/pay/[orderNo]` 收银台（扫码/对公转账）→ `/contract/[orderNo]` 电子合同 → `/invoices` 发票中心

**企业付费模块**（订阅门禁 + 配额）

- 商机侧：`/suppliers` 供应商全景与 PK、`/competitors` 竞对攻防雷达、`/history` 历史大数据与价格下浮罗盘、`/intentions` 采购意向雷达、`/qualifications` 资质库匹配、`/cases` 业绩案例资产库
- 投标侧：`/projects` 项目生命周期穿透、`/proposals` 标书装配工场、`/audit` 清标查重质检、`/reviews` 失标归因复盘、`/deposits` 保证金罗盘、`/compliance` 等保合规中心
- 协作侧：`/pipeline` 销售 CRM 漏斗、`/tracker` 协同看板、`/team` 团队席位、`/webhooks` 预警路由、`/exports` 批量导出、`/analytics` 行业大盘、`/developer` 开放 API

**管理后台**（`/admin`，RBAC 分角色）

- 仪表盘、公告管理、项目主数据（多源仲裁）、数据纠错核准、用户全景画像、组织与席位
- 角色权限（RBAC）与动态菜单、订单管理、订阅与流失分析、发票审核、支付事件监控、Jeepay 支付配置
- 导出审计、推送监控、数据源监控（告警/队列任务/配置版本回滚）、抓取日志

## 快速开始

要求 Node.js ≥ 20、Docker（跑 PostgreSQL）。

```bash
npm install

# 方式一：一键起本地环境（Docker PostgreSQL + next dev）
npm run service:start          # 停止：npm run service:stop

# 方式二：手动
docker compose up -d postgres  # 启动数据库
npm run db:push                # 建表 + 生成 Prisma 客户端
npm run db:seed                # 省市区划、管理员、示例公告、数据源
npm run dev                    # http://localhost:3000
```

默认管理员：`admin / admin123`（seed 默认值，仅本地开发；生产在 `.env` 的
`ADMIN_USERNAME/ADMIN_PASSWORD` 中指定，登录后立即改密）。

环境变量以根目录 `.env` 为唯一来源，模板见 [.env.example](.env.example)（分组注释齐全），
常用分组：

| 分组 | 变量 | 说明 |
|---|---|---|
| 数据库 | `DATABASE_URL`、`POSTGRES_PASSWORD` | PostgreSQL 连接串与容器密码（本地默认 `toubiao:toubiao@127.0.0.1:5432`） |
| 会话 | `APP_URL`、`AUTH_SECRET`、`SECURE_COOKIE` | 站点地址（生产必须 https）、签名密钥、强制 Secure Cookie |
| 检索 | `SEARCH_MODE` | `like`（默认，PG contains）/ `fulltext`（PG tsvector） |
| 支付 | `JEEPAY_*`、`WECHAT_PAY_*`、`ALIPAY_*` | Jeepay 聚合为主通道；微信/支付宝直连可选 |
| 收款主体 | `COMPANY_*` | 对公账户、税号等，用于订单/合同/发票页 |
| 邮件 | `SMTP_*` | 留空只打日志不真实发信 |
| 触达 | `WECOM_*`、`WECHAT_MP_*`、`ALERT_WECOM_WEBHOOK` | 企业微信 OAuth/机器人、公众号模板消息、爬虫告警 |
| AI | `AI_*` / `OPENAI_*` | 标书解读/生成等智能功能，未配置自动降级 |
| 定时 | `PUSH_CRON`、`CRAWL_CRON`、`CRAWL_POLL_MS` | 推送与抓取调度（默认推送每日 08:00、抓取每 2 小时、队列 tick 30s） |

## 数据抓取（Skills v2 架构）

每个数据源网站打包为一个 **skill**：`crawler/skills/<代号>/` 目录内含站点档案
`SKILL.md`（页面结构、字段口径、反爬注意事项、诊断修复流程）和结构化抓取规则
`config.yaml`（列表地址、翻页、选择器/字段映射、详情正文提取与字段抽取、
`settings.enabled` 启停开关）。**加新站 = 复制 `_template` 目录改两份文件，不改任何核心代码。**

```
crawler/
├── cli.ts                       # 手动抓取：npm run crawl [skillCode...]
├── worker.ts                    # 常驻采集 worker：调度到期源入队 + 消费队列（默认 30s tick）
├── runner.ts                    # 通用执行器：normal / resume 断点续采 / timerange 补采
├── config-loader.ts             # config.yaml zod 校验 + SkillRevision 版本化（后台可回滚）
├── queue.ts / scheduler.ts      # CrawlTask 队列（指数退避重试）与 cron 调度
├── persist.ts                   # 落库：字段置信度竞争更新 + 来源溯源，HTML 快照存 data/storage
├── enrichment/project-cluster.ts# 公告级联聚类为项目主数据，自动推进生命周期阶段
├── extraction.ts                # 项目编号/预算/中标额/开标时间等 10 字段内置正则抽取
├── fidelity.ts                  # 保真 HTML 净化与附件发现
├── health.ts / alerts.ts        # 健康分算法与企微/钉钉/飞书 webhook 告警、熔断
├── doctor.ts                    # 无数据库离线巡检
├── fetcher.ts / regions.ts / dates.ts   # 抓取库（超时/重试/GBK）、省市区识别、中文日期解析
└── skills/                      # 23 个数据源 + _template
```

当前内置源覆盖中国政府采购网（中央 + 地方 + 15 省市）、全国公共资源交易平台、
江西省（`ggzy-jiangxi`）与贵州省（`ggzy-guizhou`）公共资源交易平台（省级 JSON 接口）、
运营商与央企采购站等 25 个 skill；部分源因站点改版（SPA/签名墙）已按配置停用，
健康现状与修复优先级见 [docs/数据源巡检报告.md](docs/数据源巡检报告.md)。

试跑与排障：

```bash
npm run crawl -- ccgp        # 只抓指定源
npm run crawl:dry            # 干跑（不落库，单页），改 config 后先试跑
npm run crawl:doctor         # 无数据库巡检全部 skill（--only=ccgp --detail --json）
```

抓取策略：同源请求间隔 ≥ 1.2s、Chrome UA、失败指数退避重试；按 `sourceUrl` 唯一去重，
重复公告按字段置信度竞争更新；连续失败触发熔断降频探活，后台「数据源」页可手动恢复。

## 数据库

Prisma + PostgreSQL 16（Docker，数据持久化在 `postgres-data` 卷）：

```bash
npm run db:push              # 开发态同步 schema
npx prisma migrate deploy    # 生产按 prisma/migrations 迁移（勿在生产 db push）
npm run db:seed              # 初始化数据（仅首次）
npm run migrate:sqlite       # 旧 SQLite 库一次性搬运脚本（已完成，留档）
```

共 50 个 model，覆盖核心标讯/项目主数据、爬虫运维（数据源/队列/告警/配置版本）、
订阅支付（套餐/订单/配额台账/发票）、CRM 投标管理、RBAC 与推送等域。
`src/lib/query.ts` 的 `buildWhere()` 是唯一筛选条件构造点：`SEARCH_MODE=like` 用
PG `contains`，`fulltext` 走 `src/lib/fulltext.ts` 的 PG tsvector 全文检索。

## 部署（生产）

```bash
cp .env.example .env          # 逐项填写【必填】：APP_URL / AUTH_SECRET / POSTGRES_PASSWORD
docker compose config         # 预检（缺必填项 fail-fast）
docker compose up -d --build
```

服务拓扑（同一镜像）：

- `app`：Next.js 站点与 API，端口只绑 `127.0.0.1:3000`，由 Caddy/Nginx 前置终止 TLS
- `crawler-worker`：采集调度 + 队列消费 worker
- `push-worker`：关键词推送 worker（`PUSH_CRON`，默认北京时间 08:00）
- `postgres`：数据库

`RUN_DB_PUSH` / `RUN_DB_SEED` 控制容器启动时的库同步与种子（生产默认关闭，防破坏性同步）。
域名/HTTPS/备案/SMTP/支付回调等合法运营检查项见
[docs/生产部署配置清单.md](docs/生产部署配置清单.md)。

### 支付回调

- Jeepay（主通道）：`POST /api/payment/jeepay/notify`
- 微信直连（可选）：`POST /api/payment/wechat/notify`
- 支付宝直连（可选）：`POST /api/payment/alipay/notify`

回调必须使用公网 HTTPS 域名，反向代理不得修改原始请求体。回调处理内置验签、订单号、
渠道、金额与状态校验，并通过 `PaymentEvent` 表保证幂等；对公转账走 4 位附言对账码 +
后台人工核验开通。验签或金额不匹配不会开通订阅。

### 推送与告警

- `push:worker`：每日关键词命中推送，渠道含邮件（SMTP）、企业微信/钉钉/飞书 webhook 机器人，未配置的渠道自动跳过
- 爬虫侧健康告警（连续失败/零解析/健康分低于阈值）推送到 `ALERT_WECOM_WEBHOOK`

## 目录结构

```
src/
├── app/
│   ├── (public)/gonggao/   # 游客 SEO 公开页矩阵
│   ├── (site)/             # 登录后主站：检索、详情、20+ 企业模块、收银台/合同/发票
│   ├── admin/              # 管理后台：16 个模块 + RBAC 角色菜单
│   ├── actions/            # Server Actions（全部写操作）
│   ├── api/                # 支付回调 / 企微 OAuth / 手动抓取 / 导出下载 / 开放 API v1
│   ├── login|register|verify-email|terms|privacy
│   └── sitemap.ts|robots.ts
├── components/             # 业务视图组件（看板/雷达/装配器等）+ icons.tsx
├── lib/
│   ├── auth.ts|rbac.ts|quota.ts|commerce.ts|payments.ts|jeepay.ts   # 会话/权限/配额/支付
│   ├── crawler/|pipeline/|ai/                                       # 爬虫后台、增值管道、AI 能力
│   └── query.ts|tender-sections.ts|constants.ts                     # 检索构造/正文分区/口径
└── middleware.ts           # 会话守卫（公开前缀放行；/admin 要求 ADMIN）
crawler/                    # 采集器 v2（见上）+ skills/<源>/
prisma/                     # schema.prisma（50 model）、migrations、seed.ts
scripts/                    # push-daily / push-worker / migrate-sqlite-to-postgres
docs/                       # 商业化计划书、技术架构方案、生产部署清单、巡检报告等
docker-compose.yml|Dockerfile|start.sh|stop.sh
```

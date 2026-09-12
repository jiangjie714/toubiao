<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 标讯通 —— 招投标信息服务平台

类千里马的招投标公告聚合站：登录后按地区 + 类型筛选公告、关键字全文搜索；数据由 Skills 化爬虫从公开渠道抓取。Next.js 16 (App Router, Turbopack) + React 19 + Tailwind CSS v4 + TypeScript，数据库 Prisma 6 + SQLite。无 git 仓库。

> 商业化升级的方向、路线图与模型/字段级设计决策见 `docs/商业化计划书.md`（第五章采集技能 v2、5.4 配置中心、第九章 M0–M2 排期为后续开发的需求基线）。
> 数据采集平台的技术架构详细设计（Prisma v2 模型、技能 Schema、配置中心、调度队列、丰富化管道、PG 迁移）见 `docs/技术架构方案.md`——**实施 M0 前必读**。

## 常用命令

```bash
npm run dev          # 开发（http://localhost:3000）
npm run build        # 生产构建（Turbopack，含 tsc 检查）
npm run lint         # ESLint（当前应保持零警告）
npx tsc --noEmit     # 单独类型检查
npm run db:push      # Prisma 建库/更新 + 生成客户端
npm run db:seed      # 初始化：省市区划、admin 账号、示例公告、数据源
npm run crawl        # 手动抓取（可跟 skillCode：npm run crawl -- ccgp）
npm run crawl:worker # 定时抓取 worker（node-cron，默认每 2 小时）
```

环境变量在 `.env`：`DATABASE_URL`、`AUTH_SECRET`（登录签名密钥）、`ADMIN_USERNAME/PASSWORD`（仅 seed 用）、`CRAWL_CRON`、`CRAWL_MAX_PAGES`。默认管理员 admin / admin123。

## 目录与架构边界

- `src/app/(site)/` 前台（首页 / `/list` 检索 / `/tender/[id]` 详情），`src/app/login/` 登录页，二者共用会话
- `src/app/admin/` 管理后台（仪表盘、公告、用户、数据源、日志），仅 ADMIN 角色
- `src/app/actions/auth.ts` 与 `src/app/admin/actions.ts`：全部写操作走 Server Actions，不走 REST
- `src/app/api/crawl/run/` 唯一 API 路由（后台手动触发抓取，POST）
- `src/middleware.ts` 路由守卫：未登录 302 → `/login`，`/admin` 要求 ADMIN；但 **middleware 不查库**，页面层（各 layout 的 `getSession()`）负责校验用户仍存在且启用
- `crawler/` 与 `src/` 平级、共用数据库：`runner.ts` 通用执行器、`fetcher.ts`（超时/重试/GBK 解码）、`regions.ts`（省市区文本识别）、`dates.ts`（中文日期解析）、`worker.ts`（cron）、`cli.ts`（手动）
- `crawler/skills/<代号>/` 每个数据源一个 skill：`config.yaml`（抓取规则）+ `SKILL.md`（站点档案与修复流程）。**加数据源 = 复制 `_template` 改两份文件，不改核心代码**。现有：`ccgp`（政采网中央）、`ccgp-dfgg`（政采网地方）
- 数据库 5 张表：User / Region / Tender / CrawlSource / CrawlLog，见 `prisma/schema.prisma`；`Tender.sourceUrl` 唯一约束是爬虫去重的关键，手动数据该字段为 null

## 关键实现与约定

- **详情内容分类**：`src/lib/tender-sections.ts` 把公告正文解析为分类区块（项目信息/资格与要求/时间安排/联系方式/公告说明），每节含 `blocks`（paragraph/table/link，表格用 cheerio 解析 HTML）；`src/components/tender-rich-content.tsx` 负责渲染。爬虫抓的正文常无换行，解析器会按序号标题模式先 normalize 再切分
- **UI 设计系统**：扁平明亮科技风，主题令牌在 `src/app/globals.css` 的 `@theme`（`primary`/`accent`/`highlight`/`canvas` 等，Tailwind v4 类名如 `bg-primary` 可直接用）；图标一律用 `src/components/icons.tsx` 的 SVG 组件，禁止 emoji 图标；正文对比度下限 slate-500（4.5:1），数字/日期加 `tnum`（tabular-nums）；动效需尊重 `prefers-reduced-motion`（globals.css 已有全局降级）
- **认证**：bcryptjs 哈希 + jose JWT 写 httpOnly Cookie `tb_session`，会话逻辑集中在 `src/lib/auth.ts`
- **检索查询**：`src/lib/query.ts` 的 `buildWhere()` 是唯一的筛选条件构造点（SQLite LIKE），后续换全文检索引擎只改这里
- 地区数据来自 `china-division` 包（prisma/seed.ts），省级 code 如 `11`、市级 `1101`，占位城市名（市辖区/县等）已被过滤

## 已知坑（改代码前必读）

- **Turbopack root**：上级目录存在 package-lock.json，`next.config.ts` 里已显式设置 `turbopack.root`，删掉会导致模块解析错乱（误以 `Claude/` 为根）
- **跨目录导入**：`src/` 内引用爬虫代码用别名 `@/../crawler/runner`（`@` 映射 `./src`），不要用相对路径（层级易错且 Turbopack 对超出 root 的相对路径解析不稳定）
- **Prisma 锁定 v6**：npm 装最新会拿到 v8 RC（生成器行为不同、且与 @prisma/client 版本错配），保持 `prisma@^6` + `@prisma/client@^6`
- **本机 Node**：PATH 里的 `~/bin/node` shim 已损坏（报 `_load_nvm` 错误），用 `~/.nvm/versions/node/v24.15.0/bin` 或先 `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`
- SQLite 并发写有限，worker 抓取与站点同时运行属正常场景（短写锁），不必加队列
- 爬虫礼貌抓取：同源请求间隔 ≥1.2s、Chrome UA；ccgp 的 search 接口有 IP 频控（「频繁访问」页），skill 只抓静态频道页，勿改用搜索接口


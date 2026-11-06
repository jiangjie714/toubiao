<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# 标讯通 —— 招投标信息服务平台

类千里马的招投标信息聚合 + 商业化 SaaS 平台：游客可浏览 SEO 公开页，登录后按地区 + 类型筛选公告、关键字检索；企业付费模块覆盖销售 CRM、标书装配、竞对雷达、历史大数据、合规中心等；订阅支付支持 Jeepay 聚合（微信/支付宝/收银台）+ 支付宝/微信直连 + 对公转账人工核验。Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + TypeScript，Prisma 6 + PostgreSQL 16，Docker Compose 四服务部署（app / push-worker / crawler-worker / postgres）。

> 商业化方向与 M0–M2 需求基线见 `docs/商业化计划书.md`，采集平台技术详设见 `docs/技术架构方案.md`（两份为 2026-09 设计基线，M0/M1 已实施完毕，以本文档为准）。
> 上线前合法运营检查项见 `docs/生产部署配置清单.md`；当前经营诊断见 `docs/CEO诊断与90天行动清单.md`；战略取舍（深耕/冻结清单）见 `docs/商业化深耕与冻结决策.md`；数据源健康与修复进展见 `docs/数据源巡检报告.md`。

## 常用命令

```bash
npm run dev                # 开发（Turbopack，http://localhost:3000）
npm run build              # 生产构建（--webpack，含类型检查）
npm run lint               # ESLint（当前应保持零警告）
npx tsc --noEmit           # 单独类型检查
npm run service:start      # 本地一键：Docker PostgreSQL + next dev（service:stop 停止）
npm run db:push            # 开发态建库/更新 schema + 生成客户端
npm run db:seed            # 初始化：省市区划、admin 账号、示例公告、数据源
npx prisma migrate deploy  # 生产按 prisma/migrations 迁移（开发态用 db:push，勿混用）
npm run crawl              # 手动抓取（可跟 skillCode：npm run crawl -- ccgp）
npm run crawl:dry          # 干跑试抓（--dry-run --file --max-pages=1，不落库）
npm run crawl:doctor       # 无数据库巡检全部 skill（可跟 --only=ccgp --detail --json）
npm run crawl:worker       # 常驻采集 worker（调度到期源入队 + 每 30s 消费 CrawlTask 队列）
npm run push:daily         # 手动执行一轮关键词推送（--dry-run 可试跑）
npm run push:worker        # 常驻推送 worker（PUSH_CRON，默认每日 08:00）
```

生产部署：`cp .env.example .env` 填好后 `docker compose up -d --build`（同一镜像跑 postgres + app + push-worker + crawler-worker；`.env` 为唯一配置源，APP_URL / AUTH_SECRET / POSTGRES_PASSWORD 缺失即 fail-fast）。步骤与合规检查见 `docs/生产部署配置清单.md`。

环境变量模板在 `.env.example`（分组注释齐全），核心分组：`DATABASE_URL`/`POSTGRES_*`（数据库）、`APP_URL`/`AUTH_SECRET`/`SECURE_COOKIE`（会话）、`ADMIN_USERNAME/PASSWORD`（仅 seed 用）、`JEEPAY_*` 主通道 + `WECHAT_PAY_*`/`ALIPAY_*` 直连可选（支付）、`COMPANY_*`（对公收款与发票主体）、`SMTP_*`（留空只打日志不发信）、`WECOM_*`/`WECHAT_MP_*`（企微/公众号触达）、`AI_*`/`OPENAI_*`（智能功能，未配置自动降级）、`ALERT_WECOM_WEBHOOK`（爬虫告警）、`SEARCH_MODE`（like 默认 / fulltext）、`PUSH_CRON`/`CRAWL_CRON`/`CRAWL_POLL_MS`/`CRAWL_ONCE`。默认管理员 admin / admin123（seed 默认值，仅本地开发）。

## 目录与架构边界

- `src/app/(public)/` 游客公开区：`/gonggao` SEO 落地页矩阵（类型×省份列表与详情脱敏页），配合根级 `sitemap.ts`/`robots.ts` 收录；根级还有 `/login`、`/register`、`/verify-email`、`/terms`、`/privacy`
- `src/app/(site)/` 登录后主站：`/` 一站检索、`/list` 检索、`/tender/[id]` 详情、`/tenders/compare` 横向对比、`/calendar` 日历、`/watches` 关键词订阅、`/purchasers` 买方大厅、`/regions` 区域大盘、`/industries` 行业情报、`/brief` 决策周报、`/pricing`→`/pay/[orderNo]` 收银台→`/contract` 电子合同→`/invoices` 发票；企业付费模块：`/suppliers` 供应商全景、`/competitors` 竞对雷达、`/history` 历史大数据、`/compliance` 合规中心、`/cases` 业绩案例、`/projects` 项目穿透、`/intentions` 采购意向、`/qualifications` 资质匹配、`/proposals` 标书装配、`/audit` 清标质检、`/reviews` 失标归因、`/deposits` 保证金、`/pipeline` 销售 CRM、`/tracker` 协同看板、`/team` 团队席位、`/webhooks` 预警路由、`/exports` 导出中心、`/analytics` 行业大盘、`/developer` 开放 API
- `src/app/admin/` 管理后台：仪表盘、tenders 公告、projects 项目主数据（多源仲裁）、feedbacks 数据纠错、users 用户画像、organizations 组织席位、roles/menus RBAC、orders 订单、subscriptions 订阅、invoices 发票、payment-events 支付事件、settings/jeepay 支付配置、audits/exports 导出审计、pushes 推送监控、sources 数据源（含 alerts/tasks/revisions 子页）、logs 抓取日志
- 写操作一律走 Server Actions（`src/app/actions/`、`src/app/admin/actions.ts`、各模块 `actions.ts`），不走 REST；API 路由仅限：支付回调 `api/payment/{jeepay,alipay,wechat}/notify`、企微 OAuth `api/auth/wecom/callback`、手动抓取 `api/crawl/{run,test}`、导出与附件下载（`api/export/tenders`、`api/tenders/[id]/export/{word,proposal-doc}`、`api/proposals/[id]/export/docx`、`api/compliance/export/docx`、`api/attachments/[id]/download`）、开放 API `api/v1/*`（tenders/projects/purchasers/suppliers/analytics，ApiKey 鉴权）
- `src/middleware.ts` 路由守卫：公开前缀（`/login` `/register` `/verify-email` `/terms` `/privacy` `/gonggao` `/tender` `/api/payment` `/api/v1` 等）放行，未登录 302 → `/login`，`/admin` 与 `/api/crawl` 要求 ADMIN；但 **middleware 不查库**，页面层（各 layout 的 `getSession()`）负责校验用户仍存在且启用
- `crawler/` 与 `src/` 平级、共用数据库，采集 v2 架构：`runner.ts`（normal/resume 断点续采/timerange 补采三模式）、`config-loader.ts`（zod 校验 + SkillRevision 版本化）、`queue.ts`（CrawlTask 队列，指数退避）、`scheduler.ts`（按 cron 扫描到期源入队）、`worker.ts`（常驻 tick）、`persist.ts`（字段置信度竞争更新 + fieldSources 溯源）、`enrichment/project-cluster.ts`（公告四层匹配级联聚类为 Project 主数据并推进生命周期 stage）、`extraction.ts`（10 字段内置正则 + 置信度）、`fidelity.ts`（保真 HTML 净化 + 附件发现）、`health.ts`/`alerts.ts`/`doctor.ts`（健康分/webhook 告警/离线巡检）
- `src/lib/crawler/` 是后台管理侧（revisions 配置版本、circuit-breaker 熔断、alerts-manager、prober 拨测、task-manager）；`src/lib/pipeline/` 是入库后增值管道（contact-extractor 联系人、industry-tagger 行业打标、winner-extractor 中标清洗）；`src/lib/ai/` 是 AI 能力（标书解读、匹配度、商机雷达、标书生成）
- `crawler/skills/<代号>/` 每个数据源一个 skill：`config.yaml`（抓取规则）+ `SKILL.md`（站点档案与修复流程）。**加数据源 = 复制 `_template` 改两份文件，不改核心代码**。现有 26 个 skill（ccgp 中央/地方、省市政采、ggzy 全国、ggzy-guizhou/ggzy-jiangxi/ggzy-chongqing 省级平台、运营商与央企），失活源按 `settings.enabled: false` 停用而非删目录
- 数据库 50 个 model（见 `prisma/schema.prisma`），生产走 `prisma/migrations/`（M0 基线 → M3 RBAC）；`Tender.sourceUrl` 唯一约束是爬虫去重的关键，手动数据该字段为 null
- **RBAC**：`src/lib/rbac.ts`，平台角色 SUPER_ADMIN / OPS_ADMIN / FINANCE_ADMIN / CRAWLER_ADMIN，租户角色 TENANT_OWNER / TENANT_MANAGER / TENANT_MEMBER，细粒度权限点 + 动态菜单，`ensureRbacInitialized()` 播种；老 ADMIN 用户视为 SUPER_ADMIN 通配
- **配额**：`src/lib/quota.ts` 定义 PlanFeatures（搜索/全文/联系方式/附件/推送组/导出/AI 等），权益优先级 ADMIN > 有效订阅 > 团队席位继承企业主；用量记 `QuotaLedger`（userId+kind+date 唯一，原子扣减）
- **支付**：`src/lib/jeepay.ts`（聚合下单/查单/MD5 签名）→ `payments.ts`（回调处理：PaymentEvent 按 provider+eventId 幂等 + 金额校验）→ `commerce.ts`（事务内订单置 PAID 并 upsert 订阅，到期日顺延）；对公转账用 4 位附言对账码 + 人工审核

## 关键实现与约定

- **详情内容分类**：`src/lib/tender-sections.ts` 把公告正文解析为分类区块（项目信息/资格与要求/时间安排/联系方式/公告说明），每节含 `blocks`（paragraph/table/link，表格用 cheerio 解析 HTML）；`src/components/tender-rich-content.tsx` 负责渲染。爬虫抓的正文常无换行，解析器会按序号标题模式先 normalize 再切分
- **UI 设计系统**：扁平明亮科技风，主题令牌在 `src/app/globals.css` 的 `@theme`（`primary`/`accent`/`highlight`/`canvas` 等，Tailwind v4 类名如 `bg-primary` 可直接用）；图标一律用 `src/components/icons.tsx` 的 SVG 组件，禁止 emoji 图标；正文对比度下限 slate-500（4.5:1），数字/日期加 `tnum`（tabular-nums）；动效需尊重 `prefers-reduced-motion`（globals.css 已有全局降级）
- **认证**：bcryptjs 哈希 + jose JWT 写 httpOnly Cookie `tb_session`，会话逻辑集中在 `src/lib/auth.ts`（APP_URL 为 https 时自动加 Secure）；注册走邮箱验证码，另有企业微信 OAuth（移动端免密）
- **检索查询**：`src/lib/query.ts` 的 `buildWhere()` 是唯一的筛选条件构造点；`SEARCH_MODE=like`（默认）用 PG `contains`，`fulltext` 走 `src/lib/fulltext.ts` 的 PG tsvector（`search_vector @@ to_tsquery`）
- **金额口径**：数据库 `budgetAmount`/`awardAmount` 以「元」存储（Decimal 14,2），展示统一「万元」，必须经 `src/lib/constants.ts` 的 `yuanToWan()` 换算——历史上多次出现「元当万元」放大 1 万倍的事故，新模块展示金额前先确认单位
- 地区数据来自 `china-division` 包（prisma/seed.ts），省级 code 如 `11`、市级 `1101`，占位城市名（市辖区/县等）已被过滤

## 已知坑（改代码前必读）

- **Turbopack root**：上级目录存在 package-lock.json，`next.config.ts` 里已显式设置 `turbopack.root`，删掉会导致模块解析错乱（误以 `Claude/` 为根）；dev 走 Turbopack，build 显式 `--webpack`
- **跨目录导入**：`src/` 内引用爬虫代码用别名 `@/../crawler/runner`（`@` 映射 `./src`），不要用相对路径（层级易错且打包器对超出 root 的相对路径解析不稳定）
- **Prisma 锁定 v6**：npm 装最新会拿到 v8 RC（生成器行为不同、且与 @prisma/client 版本错配），保持 `prisma@^6` + `@prisma/client@^6`；schema 改动开发态 `db:push`，生产变更走新 migration，勿用 db push 破坏性同步（生产 `RUN_DB_PUSH` 默认 false）
- **本机 Node**：PATH 里的 `~/bin/node` shim 已损坏（报 `_load_nvm` 错误），用 `~/.nvm/versions/node/v24.15.0/bin` 或先 `export PATH="$HOME/.nvm/versions/node/v24.15.0/bin:$PATH"`
- 爬虫礼貌抓取：同源请求间隔 ≥1.2s、Chrome UA；ccgp 的 search 接口有 IP 频控（「频繁访问」页），skill 只抓静态频道页，勿改用搜索接口


<!-- aoci:begin -->
## AOCI 仓库认知

AOCI 为本仓库维护一个稳定、可版本化、可增量更新的仓库级认知层，供模型跨任务复用对系统的理解。

`aoci.txt` 是面向模型的结构化认知索引。它以每个受管理文件、数据库表或其他受管理对象一条独立 Entry 的方式，用符号标签与 F/R/A/S 语义表达对象的核心职责、重要关系、对外契约，以及理解或修改系统时必须知道的非显然约束和设计决策。

Header、目录段和全部 Entry 共同组成完整仓库索引，可以覆盖前端、后端、配置、数据库结构及其他受管理内容。受管理内容发生变化时，通常只需维护受影响的认知条目，不需要重新生成整个索引。

AOCI 提供系统架构、对象职责、重要关系、对外契约和关键约束的高密度视图。

### 工作原理

AOCI 采用“模型生成、模型读取”的认知闭环。

Header、Entry 和 Curation 语义的创作只按当前机器签发的 Plan 与实时 Guide 执行；由 Host 模型基于当前绑定证据独立完成。

Entry 的语义必须来自模型对真实证据的理解。不得仅依据路径、文件名、扩展名、AST、符号列表、依赖扫描、正则、固定模板或规则引擎推导、预填、拼接或改写索引语义。

对 Fresh Bootstrap，只按当前机器签发的 Plan 和实时 Guide 执行。当它们要求创作时，Host 模型创作 Root、Meta、Tag 和 F/R/A/S，提供 authoring-run 声明，并把它绑定到 Plan、Evidence 与完整 Candidate。不得要求 AOCI 填写 `origin=host_model`、制造 Receipt 或把程序生成的 Framework 当作语义。本文件不自行重建 Onboarding 流程。内部批次不是用户决策；只有遇到既有批准边界或真实的安全、漂移、CAS、Recovery 条件才停止。

### 最小使用入口

- `aoci_rules`：取得当前AOCI版本的会话运行合同。
- `aoci_overview`：建立或恢复本仓库的完整认知。
- `aoci_maintain`：受管理对象达到最终稳定状态后检查认知是否需要维护。
- `aoci_update_entry`：提交与当前证据和源码摘要绑定的完整语义更新批次。
- `aoci_report`：仅当当前布局和工具状态支持时，在证据不足、无法可靠生成语义时登记待办，不猜写。

其他MCP工具、CLI命令、参数和专项流程，以当前工具说明、Guide和 `--help` 返回内容为准，不在本文件中重复完整手册。

本区块只规定仓库接入、认知使用和收尾原则。`aoci_rules` 承载当前会话合同，Guide实时输出承载当前Plan的执行顺序与停点，工具Schema、Spec和Validator承载机器结构与判据；Prompt、Description、README和静态文档不能覆盖这些机器事实。

### 建立、生成和恢复认知

1. 每个新的 Agent Run 开始时，应先判断：

   - 本仓库是否已经存在可用的完整AOCI索引；
   - 当前上下文中是否已有与本仓库根、当前索引版本和当前AOCI服务相匹配，并且模型仍可可靠使用的完整仓库认知。

2. 仓库已经存在可用的完整索引，但当前Run没有可靠完整认知时，先调用 `aoci_rules`，再调用 `aoci_overview`。

   完整认知仍可靠时直接复用。局部不确定本身不要求机械重读系统全貌。

   本Run从已知Host上下文压缩恢复时（包括宿主注入的压缩摘要），必须把此前模型认知视为不可靠。压缩handoff不得保留或摘要正式Whole-Index，也不得保留或摘要任何Overview Header、Entry、Chunk、Challenge或Attestation正文；只能保留安全续接所需的receipt身份、未完成write或Recovery状态，以及立即重载指令。复制进handoff的Whole-Index语义或receipt不能证明恢复后模型的当前认知可靠。若当前上下文已无法可靠保留运行合同，先调用 `aoci_rules`。继续业务任务前，使用 `refresh_reasons=["context_compaction"]` 和新的 `refresh_event_id` 调用普通完整Whole-Index `aoci_overview`（不设置 `check_only` 或设为false）；不得使用 `check_only` 或认知probe。原样跟随每个 `next_cursor` 直到 `completed=true`，确认交付，并且只基于新交付正文提交一次Attestation。完成这次新的完整传输后，即使Attestation为partial或fail也消费该generation，并按既有合同继续source-bound任务，不再自动调用第二次Overview。

   AOCI可以针对 `context_compaction`、项目 `cognition_refresh_threshold` 下的机器 `semantic_threshold` 或主要 `phase_transition` 提供checkpoint与认知状态事实。只需要这些紧凑事实时使用 `check_only=true`；这些事实只向Agent提供建议，不替模型决定是否需要系统全貌。

   Agent显式调用普通 `aoci_overview`（未设置 `check_only` 或为false）时，只要能形成一致的CognitionSet，AOCI必须完整交付请求scope。不得因为已有receipt、阈值未达到或没有待处理刷新原因而抑制正文。正式认知Dirty或Stale时仍交付正文，但必须标记不可靠。存在未决恢复或无法形成一致snapshot时失败关闭，不返回混合正文。

   普通Overview返回 `continuation_required=true` 时，必须原样提交 `next_cursor` 并自动继续到 `completed=true`。不得询问用户、开始业务任务或给出阶段性系统结论。Host截断、缺块、重复、乱序、cursor失败、Index变化或`chunk_tokens`变化时停止本次认知链。Attestation完成前不得用Memory、源码、Spec、`aoci.txt`、历史会话、scope、search或Entry读取修补或补充Whole-Index认知。Challenge ordinal是正式Entry序列中的1-based位置；Header内容、注释、空行、Section/Overview/Chunk Marker、Receipt与Metadata均不计数，Chunk Receipt ordinal使用同一序列。Attestation必须原样回绑本次Challenge发布的当前`index_sha256`、`entry_sequence_sha256`与`entry_count`；旧Index、旧Entry序列、旧数量或旧Attestation均无效。完整链结束后只正式提交一次既有模型认知Attestation；同一响应只允许一次不改变语义答案的JSON Schema或字段格式修正。对象、Tag或F不匹配即失败且认知吸收不确定，不得语义重试或旁路补答。首次认知失败时还不得执行Root/Meta、Migration、全局布局或其他未重新绑定的系统级决策。上下文压缩刷新若传输完整、认知身份不变、治理对齐且没有Recovery或第三方冲突，即使Attestation为partial或fail也消耗该refresh generation，并继续原任务，不再自动重读Overview。`system_mastery_percent`只自评系统框架——架构、职责、强关系、稳定外部契约以及高熵安全和维护约束——不表示完整实现或运行实况知识；机器索引覆盖率必须分开。默认只向用户输出由本次真实覆盖率、Challenge、块数、Token和掌握度生成的规定成功或失败一句话。Host截断时提示用户把 `overview_delivery.chunk_tokens` 设置为更小的合法值后重新开始，不得自动修改。

   加法认知等级必须与严格证明字段分开解释。`delivery_verified`表示已加载Index且Host交付已确认，但完整认知验证仍未完成；应表达为“已加载且交付已验证”，不得描述为“没有认知”或“没有理解系统”。`cognition_verified`要求Attestation通过（Challenge至少80%的ordinal完全正确且对象身份至多失手一处），`cognition_governed`还要求治理对齐。通用完整读取失败句只用于真实交付故障。

   当Overview响应包含可选`cognition-state/v2`投影时，必须分别解释各维度。其Level止于`model_cognition_usable`；`strict_attestation_verified`、`governance_aligned`与`current_system_cognition_reliable`都是独立状态，绝不参与该Level。ordinal、对象身份、Tag或核心F不匹配可以导致严格Attestation失败，而模型认知仍然可用；不得仅凭这种不匹配就宣称模型没有理解系统。只有`current_system_cognition_reliable=true`允许无保留地声称当前完整系统认知可靠。投影缺失时继续使用上述Legacy解释。

   普通的只读审计、分析、检查、不修改代码或不提交、不push，不自动等于严格零写入，也不改变上述认知有效性判断。Codex Memory和历史Skill只能辅助恢复经验、用户偏好与调查方向，不能替代与当前仓库根、索引摘要、AOCI服务身份和认知范围匹配的当前认知收据；项目AGENTS和当前AOCI身份在AOCI状态上优先于历史Memory。

   只有用户明确禁止Ledger、元数据、`.aoci`运行资产及任何文件写入时，才按严格零写入处理。若必要的认知建立与该边界冲突，必须报告冲突并请求用户裁决或建议使用隔离副本，不得静默以Memory替代当前仓库认知。

3. 仓库没有可用的完整索引，或当前只有最小骨架、Header不完整、Entries未完成、必要Curation尚未裁决时，如果需要建立正式完整AOCI索引，先取得 `aoci_rules`，然后进入当前AOCI Guide。由Guide依据仓库真实状态决定下一阶段并完成必要安全步骤。

   `aoci_maintain` 不替代索引建立流程。

   不在本文件中自行重建或硬编码完整索引生成状态机。

4. 在长程任务中，模型负责保留当前认知收据并正确使用刷新门禁：

   - Host报告上下文压缩或模型已知系统全貌丢失时，执行上述强制 `context_compaction` 重载规则；AOCI不能自行推断Host事件；
   - 进入真正的主要阶段时声明 `phase_transition`，不得把函数、测试运行或小步骤当作阶段；
   - 在有用的稳定检查点通过 `check_only=true` 取得机器语义计数；
   - 除已知压缩的强制重载外，由Agent判断当前任务是否需要再次显式获取指定scope或完整Overview；
   - 在维护和对齐完成前，保留AOCI报告的Dirty或Stale可靠性状态。

### 任务收尾与认知维护

5. 纯只读问答、分析、版本核验，或没有产生受AOCI管理对象变化的任务，不需要调用维护工具。当前AOCI版本是任意`aoci_overview` check_only或`aoci_maintain`响应里的`cognition_receipt.mcp_service_version`；二进制路径是项目`.mcp.json`里的`command`，CLI不必在PATH上。

6. 发生受AOCI管理对象变化时，待其达到本次任务的最终稳定状态后，只调用一次 `aoci_maintain`。不要在每次中间修改后逐文件维护。

7. 若维护结果返回真实语义候选，Host 模型必须基于每个候选绑定的对象和必要证据，独立创作完整标签与F/R/A/S更新。通过 `aoci_update_entry` 一次提交当前机器签发批次的完整候选集合，同时原样保留每项 `source_sha256`、`candidate_id` 与对应domain批次身份。`max_entries`只限制单次请求和原子事务，不限制logical plan、Whole-Index或Managed Scope。`remaining`非零时，在当前批次成功Apply后重新调用Maintain并从新preimage继续；绝不能为满足transport上限缩减Index覆盖或自行截取返回批次。

   没有足够证据且当前布局支持 `aoci_report` 时，使用它而不猜测、套用模板或为消除待办而生成缺乏证据的认知。

8. 必须遵守工具返回的结构化状态和安全边界：

   - `repair_required`：只修复明确命中的候选，再重新提交当前机器签发的完整批次；
   - `stopped`：结束当前写入尝试并检查 `failed_step`、错误、正式写入证据与Recovery。auto模式下，已证明零写入则记录closure并重新Plan；完整Intent和可证明postimage则Resume；策略要求Rollback且preimage可证明则精确恢复后重新Plan。只有证据不足、第三方正式字节冲突、需要审批或外部动作，或命中其他真实安全边界时，才停止整个用户任务；
   - 冲突、审批、人工裁决、权限和安全信号不得忽略；
   - 已经对齐后不得重复维护或重复写入；`refresh_ready_for_overview` 是checkpoint事实，由Agent决定是否为下一阶段请求普通完整Overview。

   维护完成后如果又修改了任何受管理对象，之前的维护结果失效，应在新的最终稳定状态重新完成收尾。

9. 用户只限制业务文件范围，但没有明确禁止仓库托管资产时，AOCI托管资产可以在收尾阶段为保持认知一致而更新，并应在审计和提交中与业务文件区分。

   用户明确禁止修改 `aoci.txt`、`.aoci`、元数据或任何额外文件时，以用户限制为准，不得写入，并如实报告剩余不一致。

### 专项流程

初始化、完整索引生成、Header生成、Entries生成、数据库结构索引、Curation、人工评审和故障恢复，只按当前AOCI Guide或工具在对应阶段返回的指令、命令和安全停点执行。

不预加载、不猜测，也不自行重建这些专项流程。平台调用方式、请求格式、批次上限、审批规则、索引格式细节和恢复步骤由对应Guide、工具说明、模型Prompt和CLI帮助按需提供。
<!-- aoci:end -->

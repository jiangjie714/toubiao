# P0 商业支付与双轨收银闭环 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 构建针对“暂无对公商户号”场景的生产级双轨收银台（个人码极速核销 + 企业对公电汇与盖章合同 PDF）、移动端/企微免登秒级放行、自适应轻量轮询与订阅权益事务激活，并在底层解耦网关为后续官方商户号留出无感升级通道。

**Architecture:** 
1. **数据层**：Prisma Schema 扩展 `Order` 模型（附言识别码 `matchingCode`、底单 `proofUrl`、审核状态 `auditStatus`/`auditNote`/`auditByUserId`/`auditAt`）；
2. **网关层**：抽象统一 `PaymentGateway` 接口，当前实现 `ManualTransferGateway`（个人码 + 对公打款），未来通过开关无缝切换 `OfficialApiGateway`；
3. **合同层**：增强服务合同与付款通知单生成器，动态注入订单号、金额大写、税号与平台电子印章；
4. **前端交互**：重塑 `/pay/[orderNo]` 收银台，支持微信/支付宝个人二维码平滑切换、大字 4 位附言码一键复制、底单上传，以及 3 秒自适应状态轮询；
5. **通知与审核流**：用户点击“我已支付”后触发企微 Webhook / 邮件卡片（带高强度 HMAC 免密审核 Token），管理员在手机端或管理后台（`/admin/orders`）一键放行；
6. **权益履约**：原子事务激活 `Subscription`、重置 `quota` 配额并写入 `Invoice` 待办。

**Tech Stack:** Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4, Prisma 6 + PostgreSQL 16, Crypto (HMAC-SHA256), QRCode, Heroicons SVG.

---

## 任务拆解与执行步骤

### Task 1: 数据库模型扩充与迁移 (Prisma Schema)

**Files:**
- Modify: `prisma/schema.prisma`
- Test: `scripts/test-order-schema.ts`

**Step 1: 修改 schema.prisma 增加核销字段**
在 `model Order` 中增加：
```prisma
matchingCode    String?   @db.VarChar(16)   // 专属附言识别码 (如 "8921", 建立唯一检索索引)
proofUrl        String?                     // 付款凭证截图/回单路径
paidNoticeAt    DateTime?                   // 用户点击“我已支付”时间
auditStatus     String    @default("PENDING") // PENDING / APPROVED / REJECTED
auditNote       String?                     // 审核备注或驳回说明
auditByUserId   Int?                        // 审核人 ID
auditAt         DateTime?                   // 审核时间戳

@@index([matchingCode])
@@index([auditStatus, createdAt])
```

**Step 2: 执行 Prisma 迁移与客户端生成**
```bash
npx prisma db push
```

**Step 3: 编写并运行模型验证脚本**
验证新增字段的 CRUD 与唯一索引，确认通过。

---

### Task 2: 支付网关层抽象与附言码生成器 (`src/lib/payments.ts`)

**Files:**
- Modify: `src/lib/payments.ts`
- Modify: `src/lib/payment-prepay.ts`

**Step 1: 定义统一网关接口与附言码算法**
- 编写 `generateMatchingCode(orderNo: string): string`：提取订单号关键哈希或后 4~6 位数字，保证同一时段不碰撞；
- 扩展 `PaymentGateway` 接口定义；
- 实现 `ManualTransferGateway`：生成带附言码的二维码链接与对公打款要素；
- 保留 `isPrepayUsable` 与官方商户号自动降级逻辑。

---

### Task 3: 电子服务协议与付款通知书生成器 (`src/lib/contract-generator.ts`)

**Files:**
- Create: `src/lib/contract-generator.ts`
- Modify: `src/app/(site)/contract/[orderNo]/page.tsx`

**Step 1: 编写合规合同与大写金额转换函数**
- 实现 `numberToChinese(amount: number): string`（金额转中文大写，如 `¥2,999.00` ➔ `贰仟玖佰玖拾玖元整`）；
- 动态生成带标讯通平台公章（SVG/Canvas 透明图层）、双方权责条款、增值税开票约定的标准打印格式；
- 支持用户直接在收银台点击「预览/下载企业采购合同 PDF」。

---

### Task 4: 前台双轨收银台与状态轮询组件改造

**Files:**
- Modify: `src/app/(site)/pay/[orderNo]/page.tsx`
- Modify: `src/components/payment-status-poller.tsx`

**Step 1: 重塑收银台双 Tab 视觉与交互**
- **Tab 1（手机扫码快捷付）**：微信/支付宝收款码切换，大字加粗展示「附言识别码」，一键复制功能；
- **Tab 2（企业对公转账）**：公司四要素一键复制卡片，合同下载入口，网银回单拖拽上传；
- **状态流转**：点击「我已完成支付」后切换为「正在核实流水」波纹倒计时；
- **自适应轮询**：`PaymentStatusPoller` 挂载，每 3 秒检测一次状态，检测到 `PAID` 立即触发烟花动画并跳转至开通成功页。

---

### Task 5: 支付状态流转 Server Actions 与企微/邮件即时通知

**Files:**
- Modify: `src/app/actions/payments.ts`
- Create: `src/lib/payment-notify.ts`

**Step 1: 编写通知与审核 Server Actions**
- `notifyOrderPaidAction({ orderNo, proofUrl, channel })`：
  - 更新订单状态为 `WAIT_VERIFY`，记录 `paidNoticeAt`；
  - 生成带 HMAC 签名的一键放行 Token：`generateAuditToken(orderNo, 24 * 3600)`；
  - 调用 `sendAdminPaymentNotification()` 发送企微机器人 Webhook 与邮件卡片；
- `pollOrderStatusAction(orderNo)`：轻量只读查询订单当前状态与到期时间；
- `auditOrderPaymentAction({ orderNo, action, auditToken, auditNote })`：
  - 校验管理员会话或 HMAC 签名；
  - 开启 Prisma 事务：更新订单为 `PAID`，调用 `activatePaidOrder(order)`，顺延或激活会员天数与查阅配额。

---

### Task 6: 移动端免密一键审核页与后台订单工作台

**Files:**
- Create: `src/app/(site)/pay/verify/page.tsx`（手机端点击企微卡片直达的极速审核页）
- Modify: `src/app/admin/orders/page.tsx`（电脑端待核销工作台）

**Step 1: 手机端极速放行页**
- 通过 URL 中的 `token` 校验放行权限；
- 手机屏幕清晰呈现：买方名称、购买套餐、金额、附言码、转账截图大图；
- 底部两个大按钮：`[ ✓ 确认到账并开通 ]` 与 `[ ✗ 金额不符驳回 ]`。

**Step 2: 电脑端后台订单列表增强**
- 新增「待核销待办」标签过滤；
- 提供截图凭证预览浮层、流水关联与手动核销入口。

---

### Task 7: 完整端到端测试与质量验证

**Files:**
- Create: `scripts/test-payment-e2e.ts`

**Step 1: 自动化端到端测试覆盖**
- 测试 1：创建订单 ➔ 提取 `matchingCode` 验证唯一性；
- 测试 2：触发“我已支付” ➔ 状态变为 `WAIT_VERIFY` 并生成有效 Audit Token；
- 测试 3：调用核销 Action ➔ 订单变为 `PAID`，对应 User 的 `Subscription` 正确更新，到期日精准顺延；
- 测试 4：非法 Token / 金额不符驳回流测试。

**Step 2: 编译与代码规范检查**
- `npx tsc --noEmit`（零类型错误）
- `npm run lint`（零 ESLint 警告）
- 启动本地验证与验收。

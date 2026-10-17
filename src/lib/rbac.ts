import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth";

/* -------------------------------------------------------------------------- */
/*                                基础字典定义                                  */
/* -------------------------------------------------------------------------- */

export interface SystemPermissionDef {
  code: string;
  name: string;
  category: "TENDER" | "FINANCE" | "OPS" | "SYSTEM" | "CRM" | "DATA" | "AI";
  type?: "MENU" | "BUTTON" | "API" | "DATA";
  description?: string;
}

export const SYSTEM_PERMISSIONS: SystemPermissionDef[] = [
  // 标讯与项目管理
  { code: "tender:view", name: "浏览标讯数据", category: "TENDER", type: "MENU" },
  { code: "tender:create", name: "录入发布标讯", category: "TENDER", type: "BUTTON" },
  { code: "tender:edit", name: "修改标讯信息", category: "TENDER", type: "BUTTON" },
  { code: "tender:delete", name: "删除下架标讯", category: "TENDER", type: "BUTTON" },
  { code: "project:manage", name: "项目主数据管理", category: "OPS", type: "MENU" },
  { code: "feedback:manage", name: "数据纠错反馈处理", category: "OPS", type: "MENU" },

  // 财务与交易
  { code: "invoice:view", name: "查阅发票申请", category: "FINANCE", type: "MENU" },
  { code: "invoice:audit", name: "审核开具专票/普票", category: "FINANCE", type: "BUTTON" },
  { code: "invoice:reject", name: "驳回/作废发票", category: "FINANCE", type: "BUTTON" },
  { code: "order:view", name: "查看交易订单", category: "FINANCE", type: "MENU" },
  { code: "order:manage", name: "订单退款与状态核销", category: "FINANCE", type: "BUTTON" },
  { code: "payment:view", name: "查阅支付事件流水", category: "FINANCE", type: "MENU" },

  // 爬虫与数据运维
  { code: "crawler:view", name: "查看爬虫源状态", category: "DATA", type: "MENU" },
  { code: "crawler:run", name: "手动触发采集抓取", category: "DATA", type: "BUTTON" },
  { code: "crawler:config", name: "管理爬虫规则与告警", category: "DATA", type: "BUTTON" },
  { code: "log:view", name: "查阅采集运行日志", category: "DATA", type: "MENU" },
  { code: "push:manage", name: "订阅推送监控与重发", category: "OPS", type: "MENU" },

  // 用户与权限中枢
  { code: "user:view", name: "查看用户与客户全景", category: "SYSTEM", type: "MENU" },
  { code: "user:manage", name: "新增/编辑/冻结用户", category: "SYSTEM", type: "BUTTON" },
  { code: "role:view", name: "查看角色与权限配置", category: "SYSTEM", type: "MENU" },
  { code: "role:manage", name: "创建/修改角色权限树", category: "SYSTEM", type: "BUTTON" },
  { code: "menu:manage", name: "动态导航菜单管理", category: "SYSTEM", type: "MENU" },
  { code: "audit:view", name: "查看全站导出审计", category: "SYSTEM", type: "MENU" },
  { code: "audit:export", name: "执行全量数据导出", category: "SYSTEM", type: "BUTTON" },

  // 企业租户与 CRM
  { code: "tenant:manage", name: "企业租户与多席位管理", category: "CRM", type: "BUTTON" },
  { code: "company:verify", name: "企业实名资质审核", category: "CRM", type: "BUTTON" },
];

export interface SystemRoleDef {
  code: string;
  name: string;
  scope: "PLATFORM" | "TENANT";
  description: string;
  permissions: string[]; // 允许的权限点列表 (* 代表全量)
}

export const SYSTEM_ROLES: SystemRoleDef[] = [
  {
    code: "SUPER_ADMIN",
    name: "超级管理员",
    scope: "PLATFORM",
    description: "拥有平台后台全域最高掌控权，可配置所有角色、菜单与操作",
    permissions: ["*"],
  },
  {
    code: "OPS_ADMIN",
    name: "平台运营主管",
    scope: "PLATFORM",
    description: "负责标讯维护、数据反馈、项目主数据、数据源监控及推送中心",
    permissions: [
      "tender:view",
      "tender:create",
      "tender:edit",
      "tender:delete",
      "project:manage",
      "feedback:manage",
      "crawler:view",
      "crawler:run",
      "log:view",
      "push:manage",
      "user:view",
    ],
  },
  {
    code: "FINANCE_ADMIN",
    name: "财务审核主管",
    scope: "PLATFORM",
    description: "专职负责企业增值税发票审核、订单流向监管与公对公支付对账",
    permissions: [
      "invoice:view",
      "invoice:audit",
      "invoice:reject",
      "order:view",
      "order:manage",
      "payment:view",
      "audit:view",
    ],
  },
  {
    code: "CRAWLER_ADMIN",
    name: "爬虫数据运维",
    scope: "PLATFORM",
    description: "负责公开渠道爬虫技能状态监控、手动调度与任务日志排查",
    permissions: ["crawler:view", "crawler:run", "crawler:config", "log:view"],
  },
  {
    code: "TENANT_OWNER",
    name: "企业法定代表(主账号)",
    scope: "TENANT",
    description: "企业订阅主账号，掌管公对公转账、专票申请、团队多席位增删",
    permissions: ["tenant:manage"],
  },
  {
    code: "TENANT_MANAGER",
    name: "投标总监(业务经理)",
    scope: "TENANT",
    description: "掌管企业 CRM 漏斗、标书智能装配工场、保证金台账与失标复盘",
    permissions: [],
  },
  {
    code: "TENANT_MEMBER",
    name: "投标专员(销售新人)",
    scope: "TENANT",
    description: "日常标讯跟进、意向收藏、个人标书装配与资质查阅",
    permissions: [],
  },
];

export interface DefaultMenuDef {
  title: string;
  path: string;
  icon: string;
  sortOrder: number;
  target?: "ADMIN" | "SITE";
  badge?: "CORP" | "VIP" | "HOT";
  permission?: string;
}

export const DEFAULT_ADMIN_MENUS: DefaultMenuDef[] = [
  { title: "仪表盘", path: "/admin", icon: "ChartBarIcon", sortOrder: 10, target: "ADMIN" },
  { title: "信息管理", path: "/admin/tenders", icon: "ClipboardIcon", sortOrder: 20, target: "ADMIN", permission: "tender:view" },
  { title: "项目主数据", path: "/admin/projects", icon: "BriefcaseIcon", sortOrder: 30, target: "ADMIN", permission: "project:manage" },
  { title: "数据反馈", path: "/admin/feedbacks", icon: "ChatBubbleIcon", sortOrder: 40, target: "ADMIN", permission: "feedback:manage" },
  { title: "用户管理", path: "/admin/users", icon: "UsersIcon", sortOrder: 50, target: "ADMIN", permission: "user:view" },
  { title: "企业组织", path: "/admin/organizations", icon: "BuildingIcon", sortOrder: 52, target: "ADMIN", permission: "tenant:manage" },
  { title: "角色权限", path: "/admin/roles", icon: "ShieldCheckIcon", sortOrder: 54, target: "ADMIN", permission: "role:view" },
  { title: "动态菜单", path: "/admin/menus", icon: "FolderIcon", sortOrder: 58, target: "ADMIN", permission: "menu:manage" },
  { title: "订单管理", path: "/admin/orders", icon: "ClipboardIcon", sortOrder: 60, target: "ADMIN", permission: "order:view" },
  { title: "订阅分析", path: "/admin/subscriptions", icon: "TrophyIcon", sortOrder: 70, target: "ADMIN", permission: "order:view" },
  { title: "发票审核", path: "/admin/invoices", icon: "DocumentTextIcon", sortOrder: 80, target: "ADMIN", permission: "invoice:view" },
  { title: "支付事件", path: "/admin/payment-events", icon: "BoltIcon", sortOrder: 90, target: "ADMIN", permission: "payment:view" },
  { title: "Jeepay支付", path: "/admin/settings/jeepay", icon: "CreditCardIcon", sortOrder: 95, target: "ADMIN", permission: "payment:view" },
  { title: "导出审计", path: "/admin/audits/exports", icon: "ShieldCheckIcon", sortOrder: 100, target: "ADMIN", permission: "audit:view" },
  { title: "推送监控", path: "/admin/pushes", icon: "ChartBarIcon", sortOrder: 110, target: "ADMIN", permission: "push:manage" },
  { title: "数据源", path: "/admin/sources", icon: "DatabaseIcon", sortOrder: 120, target: "ADMIN", permission: "crawler:view" },
  { title: "抓取日志", path: "/admin/logs", icon: "HomeIcon", sortOrder: 130, target: "ADMIN", permission: "log:view" },
];

export const DEFAULT_SITE_MENUS: DefaultMenuDef[] = [
  { title: "标讯检索", path: "/list", icon: "SearchIcon", sortOrder: 10, target: "SITE" },
  { title: "标讯雷达", path: "/radar", icon: "MegaphoneIcon", sortOrder: 20, target: "SITE", badge: "HOT" },
  { title: "历史标讯库", path: "/history", icon: "ClockIcon", sortOrder: 30, target: "SITE", badge: "VIP" },
  { title: "标讯跟进", path: "/follows", icon: "StarIcon", sortOrder: 40, target: "SITE" },
  { title: "商机漏斗", path: "/pipeline", icon: "FunnelIcon", sortOrder: 50, target: "SITE", badge: "CORP" },
  { title: "标书工场", path: "/proposals", icon: "DocumentPlusIcon", sortOrder: 60, target: "SITE", badge: "CORP" },
  { title: "智能清标", path: "/audit", icon: "SparklesIcon", sortOrder: 70, target: "SITE", badge: "CORP" },
  { title: "保证金台账", path: "/deposits", icon: "CreditCardIcon", sortOrder: 80, target: "SITE", badge: "CORP" },
  { title: "企业资质库", path: "/qualifications", icon: "ShieldCheckIcon", sortOrder: 90, target: "SITE", badge: "CORP" },
  { title: "案例业绩库", path: "/cases", icon: "FolderIcon", sortOrder: 100, target: "SITE", badge: "CORP" },
  { title: "失标复盘", path: "/reviews", icon: "ScaleIcon", sortOrder: 110, target: "SITE", badge: "CORP" },
  { title: "竞对监控", path: "/competitors", icon: "UsersIcon", sortOrder: 120, target: "SITE", badge: "CORP" },
  { title: "预警推送", path: "/webhooks", icon: "BoltIcon", sortOrder: 130, target: "SITE", badge: "CORP" },
];

/* -------------------------------------------------------------------------- */
/*                           初始化与自愈机制                                   */
/* -------------------------------------------------------------------------- */

let isInitializing = false;

/** 确保 RBAC 权限与默认菜单在数据库中完备，若缺失则自动幂等补齐 */
export async function ensureRbacInitialized(): Promise<void> {
  if (isInitializing) return;
  isInitializing = true;
  try {
    // 1. 同步权限点
    for (const p of SYSTEM_PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code: p.code },
        update: { name: p.name, category: p.category, type: p.type ?? "BUTTON" },
        create: {
          code: p.code,
          name: p.name,
          category: p.category,
          type: p.type ?? "BUTTON",
        },
      });
    }

    // 2. 同步内置角色
    for (const r of SYSTEM_ROLES) {
      const role = await prisma.role.upsert({
        where: { code: r.code },
        update: {
          name: r.name,
          scope: r.scope,
          description: r.description,
          isSystem: true,
        },
        create: {
          code: r.code,
          name: r.name,
          scope: r.scope,
          description: r.description,
          isSystem: true,
        },
      });

      // 绑定对应权限点
      if (r.permissions.includes("*")) {
        const allPerms = await prisma.permission.findMany({ select: { id: true } });
        for (const p of allPerms) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
            update: {},
            create: { roleId: role.id, permissionId: p.id },
          });
        }
      } else if (r.permissions.length > 0) {
        const targetPerms = await prisma.permission.findMany({
          where: { code: { in: r.permissions } },
          select: { id: true },
        });
        for (const p of targetPerms) {
          await prisma.rolePermission.upsert({
            where: { roleId_permissionId: { roleId: role.id, permissionId: p.id } },
            update: {},
            create: { roleId: role.id, permissionId: p.id },
          });
        }
      }
    }

    // 3. 同步默认菜单
    const allDefaultMenus = [
      ...DEFAULT_ADMIN_MENUS.map((m) => ({ ...m, target: "ADMIN" as const })),
      ...DEFAULT_SITE_MENUS.map((m) => ({ ...m, target: "SITE" as const })),
    ];
    for (const m of allDefaultMenus) {
      const existing = await prisma.menu.findFirst({
        where: { path: m.path, target: m.target },
      });
      if (!existing) {
        await prisma.menu.create({
          data: {
            title: m.title,
            path: m.path,
            icon: m.icon,
            sortOrder: m.sortOrder,
            target: m.target,
            badge: m.badge ?? null,
            permission: m.permission ?? null,
            active: true,
          },
        });
      }
    }

    // 4. 将所有 ADMIN 菜单挂接至 SUPER_ADMIN
    const superAdminRole = await prisma.role.findUnique({ where: { code: "SUPER_ADMIN" } });
    if (superAdminRole) {
      const adminMenus = await prisma.menu.findMany({ where: { target: "ADMIN" } });
      for (const m of adminMenus) {
        await prisma.roleMenu.upsert({
          where: { roleId_menuId: { roleId: superAdminRole.id, menuId: m.id } },
          update: {},
          create: { roleId: superAdminRole.id, menuId: m.id },
        });
      }
    }
  } catch (error) {
    // 数据库可能正在迁移或处于离线构建模式，捕获异常不阻断
    console.warn("[RBAC] Auto-initialization warning:", error instanceof Error ? error.message : String(error));
  } finally {
    isInitializing = false;
  }
}

/* -------------------------------------------------------------------------- */
/*                              权限与菜单鉴权引擎                              */
/* -------------------------------------------------------------------------- */

export interface MenuItemDto {
  id: number;
  title: string;
  path: string;
  icon?: string | null;
  sortOrder: number;
  target: string;
  badge?: string | null;
  permission?: string | null;
  children?: MenuItemDto[];
}

/** 获取用户拥有的所有原子权限点编码列表 */
export async function getUserPermissions(userId: number): Promise<string[]> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      userRoles: {
        include: {
          role: {
            include: {
              rolePerms: {
                include: { permission: true },
              },
            },
          },
        },
      },
    },
  });

  if (!user) return [];

  // 判定是否具备超级管理员权限：
  // 显式拥有 SUPER_ADMIN 角色，或老版未配置具体子角色的纯 ADMIN 用户直接拥有全权限通配符 "*"
  const isSuper =
    user.userRoles.some((ur) => ur.role.code === "SUPER_ADMIN") ||
    (user.role === "ADMIN" && user.userRoles.length === 0);

  if (isSuper) {
    return ["*"];
  }

  const perms = new Set<string>();
  for (const ur of user.userRoles) {
    for (const rp of ur.role.rolePerms) {
      perms.add(rp.permission.code);
    }
  }

  return Array.from(perms);
}

/** 校验用户是否拥有指定权限点 */
export async function checkPermission(userId: number, permissionCode: string): Promise<boolean> {
  const perms = await getUserPermissions(userId);
  if (perms.includes("*")) return true;
  return perms.includes(permissionCode);
}

/** 服务端 Action 拦截器：校验当前登录用户是否拥有某权限 */
export async function requirePermission(permissionCode: string): Promise<SessionUser> {
  const { getSession } = await import("@/lib/auth");
  const session = await getSession();
  if (!session) {
    throw new Error("请先登录系统");
  }

  const allowed = await checkPermission(session.uid, permissionCode);
  if (!allowed) {
    throw new Error(`权限不足：需要 [${permissionCode}] 操作权限`);
  }

  return session;
}

/** 获取指定用户有权访问的动态菜单列表（按层级和排序整理） */
export async function getUserMenus(
  userId: number,
  target: "ADMIN" | "SITE" = "ADMIN",
): Promise<MenuItemDto[]> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        userRoles: {
          include: {
            role: {
              include: {
                roleMenus: true,
              },
            },
          },
        },
      },
    });

    if (!user) return [];

    const isSuper =
      user.userRoles.some((ur) => ur.role.code === "SUPER_ADMIN") ||
      (user.role === "ADMIN" && user.userRoles.length === 0);

    // 取出所有启用的菜单
    const allMenus = await prisma.menu.findMany({
      where: { target, active: true },
      orderBy: { sortOrder: "asc" },
    });

    if (allMenus.length === 0) {
      // 数据库暂无菜单，返回默认菜单降级结构
      const defaults = target === "ADMIN" ? DEFAULT_ADMIN_MENUS : DEFAULT_SITE_MENUS;
      return defaults.map((m, idx) => ({
        id: idx + 1,
        title: m.title,
        path: m.path,
        icon: m.icon,
        sortOrder: m.sortOrder,
        target: m.target ?? target,
        badge: m.badge ?? null,
        permission: m.permission ?? null,
      }));
    }

    if (isSuper) {
      return allMenus.map((m) => ({
        id: m.id,
        title: m.title,
        path: m.path,
        icon: m.icon,
        sortOrder: m.sortOrder,
        target: m.target,
        badge: m.badge,
        permission: m.permission,
      }));
    }

    // 普通角色：按绑定的 roleMenu 或用户拥有的 permission 过滤
    const roleMenuIds = new Set<number>();
    for (const ur of user.userRoles) {
      for (const rm of ur.role.roleMenus) {
        roleMenuIds.add(rm.menuId);
      }
    }

    const userPerms = await getUserPermissions(userId);

    const filtered = allMenus.filter((m) => {
      // 1. 显式绑定了该菜单
      if (roleMenuIds.has(m.id)) return true;
      // 2. 菜单未设置任何权限门槛
      if (!m.permission) return true;
      // 3. 用户拥有该菜单对应的权限点
      if (userPerms.includes("*") || userPerms.includes(m.permission)) return true;
      return false;
    });

    return filtered.map((m) => ({
      id: m.id,
      title: m.title,
      path: m.path,
      icon: m.icon,
      sortOrder: m.sortOrder,
      target: m.target,
      badge: m.badge,
      permission: m.permission,
    }));
  } catch (err) {
    console.warn("[RBAC] getUserMenus fallback:", err);
    const defaults = target === "ADMIN" ? DEFAULT_ADMIN_MENUS : DEFAULT_SITE_MENUS;
    return defaults.map((m, idx) => ({
      id: idx + 1,
      title: m.title,
      path: m.path,
      icon: m.icon,
      sortOrder: m.sortOrder,
      target: m.target ?? target,
      badge: m.badge ?? null,
      permission: m.permission ?? null,
    }));
  }
}

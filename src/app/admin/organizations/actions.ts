"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { requirePermission } from "@/lib/rbac";

async function verifyAdminOrTenantManage() {
  const session = await getSession();
  if (!session) throw new Error("请先登录");
  if (session.role === "ADMIN") return session;
  return await requirePermission("tenant:manage");
}

export interface OrgMemberItem {
  id: number;
  userId: number;
  username: string;
  name: string;
  email: string | null;
  role: string;
  title: string | null;
  joinedAt: Date;
}

export interface OrganizationRecord {
  id: number;
  name: string;
  maxSeats: number;
  usedSeats: number;
  availableSeats: number;
  utilizationRate: number;
  createdAt: Date;
  updatedAt: Date;
  owner: {
    id: number;
    username: string;
    name: string;
    email: string | null;
    companyName: string | null;
    registeredCapital: string | null;
    planName: string;
    planCode: string;
  };
  members: OrgMemberItem[];
}

export interface OrganizationsOverviewData {
  metrics: {
    totalOrgs: number;
    totalMaxSeats: number;
    totalUsedSeats: number;
    avgUtilizationRate: number;
  };
  organizations: OrganizationRecord[];
}

/** 获取全平台企业组织全景列表与核心指标 */
export async function getOrganizationsOverviewAction(): Promise<OrganizationsOverviewData> {
  await verifyAdminOrTenantManage();

  const teams = await prisma.team.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      owner: {
        select: {
          id: true,
          username: true,
          name: true,
          email: true,
          companyProfile: {
            select: {
              companyName: true,
              registeredCapital: true,
            },
          },
          subscription: {
            select: {
              status: true,
              plan: {
                select: {
                  code: true,
                  name: true,
                },
              },
            },
          },
        },
      },
      members: {
        orderBy: { joinedAt: "asc" },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              name: true,
              email: true,
            },
          },
        },
      },
    },
  });

  let totalMaxSeats = 0;
  let totalUsedSeats = 0;

  const organizations: OrganizationRecord[] = teams.map((t) => {
    const used = t.members.length;
    const max = t.maxSeats;
    totalMaxSeats += max;
    totalUsedSeats += used;

    const rate = max > 0 ? Math.round((used / max) * 100) : 0;
    const plan = t.owner.subscription?.status === "ACTIVE" ? t.owner.subscription.plan : null;

    const members: OrgMemberItem[] = t.members.map((m) => ({
      id: m.id,
      userId: m.user.id,
      username: m.user.username,
      name: m.user.name,
      email: m.user.email,
      role: m.role,
      title: m.title,
      joinedAt: m.joinedAt,
    }));

    return {
      id: t.id,
      name: t.name,
      maxSeats: max,
      usedSeats: used,
      availableSeats: Math.max(0, max - used),
      utilizationRate: rate,
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      owner: {
        id: t.owner.id,
        username: t.owner.username,
        name: t.owner.name,
        email: t.owner.email,
        companyName: t.owner.companyProfile?.companyName ?? null,
        registeredCapital: t.owner.companyProfile?.registeredCapital ?? null,
        planName: plan?.name ?? "未激活企业套餐",
        planCode: plan?.code ?? "NONE",
      },
      members,
    };
  });

  const avgUtilizationRate =
    totalMaxSeats > 0 ? Math.round((totalUsedSeats / totalMaxSeats) * 100) : 0;

  return {
    metrics: {
      totalOrgs: teams.length,
      totalMaxSeats,
      totalUsedSeats,
      avgUtilizationRate,
    },
    organizations,
  };
}

/** 运营调整企业组织的最大席位上限 */
export async function adjustTeamSeatsAction(
  teamId: number,
  newMaxSeats: number,
): Promise<{ success: boolean; error?: string }> {
  await verifyAdminOrTenantManage();

  const seats = Math.floor(Number(newMaxSeats));
  if (isNaN(seats) || seats < 1 || seats > 200) {
    return { success: false, error: "席位上限需设置在 1 至 200 席之间" };
  }

  try {
    const team = await prisma.team.findUnique({
      where: { id: teamId },
      include: { _count: { select: { members: true } } },
    });

    if (!team) return { success: false, error: "未找到目标企业团队" };

    if (seats < team._count.members) {
      return {
        success: false,
        error: `调减失败：该团队已有 ${team._count.members} 位在职成员，席位上限不可低于在席人数`,
      };
    }

    await prisma.team.update({
      where: { id: teamId },
      data: { maxSeats: seats },
    });

    revalidatePath("/admin/organizations");
    revalidatePath("/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "调整席位配额失败" };
  }
}

/** 运营修改企业团队名称 */
export async function adminUpdateTeamNameAction(
  teamId: number,
  name: string,
): Promise<{ success: boolean; error?: string }> {
  await verifyAdminOrTenantManage();

  const trimmed = name.trim();
  if (!trimmed || trimmed.length > 50) {
    return { success: false, error: "企业组织名称须在 1-50 个字符之间" };
  }

  try {
    await prisma.team.update({
      where: { id: teamId },
      data: { name: trimmed },
    });

    revalidatePath("/admin/organizations");
    revalidatePath("/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "修改组织名称失败" };
  }
}

/** 运营强制解绑指定成员的席位 */
export async function adminRemoveMemberFromTeamAction(
  memberId: number,
): Promise<{ success: boolean; error?: string }> {
  await verifyAdminOrTenantManage();

  try {
    const member = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: true },
    });

    if (!member) return { success: false, error: "成员席位不存在或已被解绑" };

    if (member.role === "OWNER") {
      return { success: false, error: "企业团队所有者席位不可强制移除" };
    }

    await prisma.$transaction(async (tx) => {
      // 1. 移除团队成员
      await tx.teamMember.delete({ where: { id: memberId } });

      // 2. 解除该用户相关的租户角色绑定 (TENANT_MANAGER / TENANT_MEMBER)
      const tenantRoles = await tx.role.findMany({
        where: { scope: "TENANT" },
        select: { id: true },
      });
      const tenantRoleIds = tenantRoles.map((r) => r.id);

      if (tenantRoleIds.length > 0) {
        await tx.userRole.deleteMany({
          where: {
            userId: member.userId,
            roleId: { in: tenantRoleIds },
          },
        });
      }
    });

    revalidatePath("/admin/organizations");
    revalidatePath("/team");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "强制解绑成员席位失败" };
  }
}

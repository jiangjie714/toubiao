"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEntitlement } from "@/lib/quota";
import { revalidatePath } from "next/cache";

export interface TeamMemberInfo {
  id: number;
  userId: number;
  username: string;
  email: string | null;
  role: string; // OWNER | MANAGER | MEMBER
  title: string | null;
  joinedAt: string;
  isCurrentUser: boolean;
}

export interface MyTeamData {
  id: number;
  name: string;
  ownerId: number;
  ownerName: string;
  isOwner: boolean;
  userRole: string;
  maxSeats: number;
  usedSeats: number;
  availableSeats: number;
  planName: string;
  members: TeamMemberInfo[];
}

export interface TeamActionResult {
  success: boolean;
  error?: string;
  data?: MyTeamData;
}

export async function getMyTeamAction(): Promise<TeamActionResult> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const userId = session.uid;
    const entitlement = await getEntitlement(userId);

    // 1. 查找用户自身拥有的团队
    let ownedTeam = await prisma.team.findUnique({
      where: { ownerId: userId },
      include: {
        owner: { select: { id: true, username: true, email: true } },
        members: {
          include: {
            user: { select: { id: true, username: true, email: true } },
          },
          orderBy: { joinedAt: "asc" },
        },
      },
    });

    // 若用户无自有团队，但拥有白金/企业版权限或管理员，且未加入其他团队，则自动为该账号初始化默认团队
    if (!ownedTeam) {
      const existingMembership = await prisma.teamMember.findUnique({
        where: { userId },
      });

      if (!existingMembership) {
        // 如果是白金、企业版或管理员，自动初始化企业团队
        const isEligible =
          session.role === "ADMIN" ||
          entitlement.planCode.startsWith("PLATINUM") ||
          entitlement.planCode.startsWith("ENTERPRISE");

        if (isEligible) {
          const maxSeats = entitlement.planCode.includes("PRO") ? 10 : 3;
          ownedTeam = await prisma.team.create({
            data: {
              name: `${session.username} 的企业团队`,
              ownerId: userId,
              maxSeats,
              members: {
                create: {
                  userId: userId,
                  role: "OWNER",
                  title: "团队负责人",
                },
              },
            },
            include: {
              owner: { select: { id: true, username: true, email: true } },
              members: {
                include: {
                  user: { select: { id: true, username: true, email: true } },
                },
                orderBy: { joinedAt: "asc" },
              },
            },
          });
        }
      }
    }

    // 2. 如果找到了自有团队
    if (ownedTeam) {
      // 确保 owner 在 members 中
      const hasOwnerInMembers = ownedTeam.members.some((m) => m.userId === userId);
      if (!hasOwnerInMembers) {
        await prisma.teamMember.create({
          data: {
            teamId: ownedTeam.id,
            userId: userId,
            role: "OWNER",
            title: "团队负责人",
          },
        });
        // 重新拉取一次
        ownedTeam = await prisma.team.findUnique({
          where: { id: ownedTeam.id },
          include: {
            owner: { select: { id: true, username: true, email: true } },
            members: {
              include: {
                user: { select: { id: true, username: true, email: true } },
              },
              orderBy: { joinedAt: "asc" },
            },
          },
        });
      }

      const members: TeamMemberInfo[] = (ownedTeam?.members ?? []).map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        email: m.user.email,
        role: m.role,
        title: m.title,
        joinedAt: m.joinedAt.toISOString(),
        isCurrentUser: m.userId === userId,
      }));

      return {
        success: true,
        data: {
          id: ownedTeam!.id,
          name: ownedTeam!.name,
          ownerId: ownedTeam!.ownerId,
          ownerName: ownedTeam!.owner.username,
          isOwner: true,
          userRole: "OWNER",
          maxSeats: ownedTeam!.maxSeats,
          usedSeats: members.length,
          availableSeats: Math.max(0, ownedTeam!.maxSeats - members.length),
          planName: entitlement.planName,
          members,
        },
      };
    }

    // 3. 检查是否作为成员加入了别人的团队
    const membership = await prisma.teamMember.findUnique({
      where: { userId },
      include: {
        team: {
          include: {
            owner: {
              select: { id: true, username: true, email: true },
            },
            members: {
              include: {
                user: { select: { id: true, username: true, email: true } },
              },
              orderBy: { joinedAt: "asc" },
            },
          },
        },
      },
    });

    if (membership && membership.team) {
      const team = membership.team;
      const members: TeamMemberInfo[] = team.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        username: m.user.username,
        email: m.user.email,
        role: m.role,
        title: m.title,
        joinedAt: m.joinedAt.toISOString(),
        isCurrentUser: m.userId === userId,
      }));

      return {
        success: true,
        data: {
          id: team.id,
          name: team.name,
          ownerId: team.ownerId,
          ownerName: team.owner.username,
          isOwner: false,
          userRole: membership.role,
          maxSeats: team.maxSeats,
          usedSeats: members.length,
          availableSeats: Math.max(0, team.maxSeats - members.length),
          planName: entitlement.planName,
          members,
        },
      };
    }

    // 既没有团队也不是成员，且不是白金/企业账号
    return {
      success: true,
      data: undefined, // 前端显示创建或升级企业版指引
    };
  } catch (error) {
    console.error("getMyTeamAction error:", error);
    return { success: false, error: "获取团队信息失败，请稍后重试" };
  }
}

export async function addTeamMemberAction(
  identifier: string,
  title?: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const trimmed = identifier.trim();
    if (!trimmed) {
      return { success: false, error: "请输入成员用户名或绑定邮箱" };
    }

    // 查找用户管理的团队 (OWNER 或 MANAGER)
    const team = await prisma.team.findUnique({
      where: { ownerId: session.uid },
      include: { members: true },
    });

    if (!team) {
      return { success: false, error: "您尚未创建团队或不是团队负责人" };
    }

    if (team.members.length >= team.maxSeats) {
      return {
        success: false,
        error: `席位已达上限（${team.maxSeats} 人），无法添加更多成员，请联系客服扩容席位`,
      };
    }

    // 查找目标用户
    const targetUser = await prisma.user.findFirst({
      where: {
        OR: [{ username: trimmed }, { email: trimmed }],
      },
    });

    if (!targetUser) {
      return { success: false, error: `未找到用户 "${trimmed}"，请核对用户名或注册邮箱` };
    }

    if (targetUser.id === session.uid) {
      return { success: false, error: "您已是团队创建人，无需重复添加自己" };
    }

    // 检查是否已被其他团队绑定
    const existingMembership = await prisma.teamMember.findUnique({
      where: { userId: targetUser.id },
      include: { team: true },
    });

    if (existingMembership) {
      if (existingMembership.teamId === team.id) {
        return { success: false, error: "该用户已经是本团队成员" };
      }
      return {
        success: false,
        error: `该用户已加入 "${existingMembership.team.name}"，需退出原团队后方可加入`,
      };
    }

    // 添加成员
    await prisma.teamMember.create({
      data: {
        teamId: team.id,
        userId: targetUser.id,
        role: "MEMBER",
        title: title?.trim() || "项目组员",
      },
    });

    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    console.error("addTeamMemberAction error:", error);
    return { success: false, error: "添加成员失败，请稍后重试" };
  }
}

export async function removeTeamMemberAction(
  memberId: number,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const membership = await prisma.teamMember.findUnique({
      where: { id: memberId },
      include: { team: true },
    });

    if (!membership) {
      return { success: false, error: "席位成员不存在或已被移除" };
    }

    // 只有所有者可以移除他人；普通成员可以主动退出
    const isOwner = membership.team.ownerId === session.uid;
    const isSelf = membership.userId === session.uid;

    if (!isOwner && !isSelf) {
      return { success: false, error: "仅团队负责人有权移除成员" };
    }

    if (isSelf && isOwner) {
      return { success: false, error: "团队负责人不能移除自己的席位" };
    }

    await prisma.teamMember.delete({
      where: { id: memberId },
    });

    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    console.error("removeTeamMemberAction error:", error);
    return { success: false, error: "移除席位成员失败，请稍后重试" };
  }
}

export async function updateTeamNameAction(
  newName: string,
): Promise<{ success: boolean; error?: string }> {
  try {
    const session = await getSession();
    if (!session) {
      return { success: false, error: "请先登录" };
    }

    const trimmed = newName.trim();
    if (!trimmed || trimmed.length > 50) {
      return { success: false, error: "团队名称需在 1-50 个字符之间" };
    }

    const team = await prisma.team.findUnique({
      where: { ownerId: session.uid },
    });

    if (!team) {
      return { success: false, error: "未找到您负责的团队" };
    }

    await prisma.team.update({
      where: { id: team.id },
      data: { name: trimmed },
    });

    revalidatePath("/team");
    return { success: true };
  } catch (error) {
    console.error("updateTeamNameAction error:", error);
    return { success: false, error: "修改团队名称失败" };
  }
}

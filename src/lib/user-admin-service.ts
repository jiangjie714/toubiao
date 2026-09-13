import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";

function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export interface UserAdminQueryOptions {
  search?: string;
  filter?: "ALL" | "COMPANY" | "PAID" | "TEAM" | "ADMIN";
  page?: number;
  pageSize?: number;
}

export interface AdminUserProfileInput {
  userId: number;
  name?: string;
  email?: string;
  role?: "USER" | "ADMIN";
  status?: "ACTIVE" | "DISABLED";
  companyName?: string;
  registeredCapital?: string;
  planCode?: string;
  extendMonths?: number;
  newPassword?: string;
}

export interface AdminCreateUserInput {
  username: string;
  name: string;
  password: string;
  role?: "USER" | "ADMIN";
  email?: string;
  companyName?: string;
  registeredCapital?: string;
  planCode?: string;
}

export async function getUserAdminOverview(options: UserAdminQueryOptions = {}) {
  const { search = "", filter = "ALL", page = 1, pageSize = 15 } = options;

  const [totalUsers, companyUsers, activeSubscribers, totalTeams, plans] = await Promise.all([
    prisma.user.count(),
    prisma.companyProfile.count(),
    prisma.subscription.count({
      where: {
        status: "ACTIVE",
        plan: { code: { not: "FREE" } },
      },
    }),
    prisma.team.count(),
    prisma.plan.findMany({
      where: { active: true },
      orderBy: { sortOrder: "asc" },
      select: { id: true, code: true, name: true, priceYearly: true },
    }),
  ]);

  const whereConditions: Prisma.UserWhereInput[] = [];

  // 搜索关键词：匹配用户名、姓名、邮箱、企业名
  const trimmedSearch = search.trim();
  if (trimmedSearch) {
    whereConditions.push({
      OR: [
        { username: { contains: trimmedSearch, mode: "insensitive" } },
        { name: { contains: trimmedSearch, mode: "insensitive" } },
        { email: { contains: trimmedSearch, mode: "insensitive" } },
        {
          companyProfile: {
            companyName: { contains: trimmedSearch, mode: "insensitive" },
          },
        },
      ],
    });
  }

  // 状态与分类标签
  if (filter === "COMPANY") {
    whereConditions.push({
      companyProfile: { isNot: null },
    });
  } else if (filter === "PAID") {
    whereConditions.push({
      subscription: {
        status: "ACTIVE",
        plan: { code: { not: "FREE" } },
      },
    });
  } else if (filter === "TEAM") {
    whereConditions.push({
      OR: [{ ownedTeam: { isNot: null } }, { teamMembership: { isNot: null } }],
    });
  } else if (filter === "ADMIN") {
    whereConditions.push({
      role: "ADMIN",
    });
  }

  const where = whereConditions.length > 0 ? { AND: whereConditions } : {};

  const [totalCount, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { id: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: {
        companyProfile: true,
        subscription: {
          include: {
            plan: true,
          },
        },
        ownedTeam: {
          include: {
            members: {
              include: {
                user: {
                  select: { id: true, username: true, name: true, role: true },
                },
              },
            },
          },
        },
        teamMembership: {
          include: {
            team: {
              include: {
                owner: {
                  select: { id: true, username: true, name: true },
                },
              },
            },
          },
        },
        _count: {
          select: {
            orders: true,
            tenderFollows: true,
          },
        },
      },
    }),
  ]);

  return {
    metrics: {
      totalUsers,
      companyUsers,
      activeSubscribers,
      totalTeams,
    },
    plans,
    pagination: {
      page,
      pageSize,
      totalCount,
      totalPages: Math.ceil(totalCount / pageSize) || 1,
    },
    users,
  };
}

export async function adminCreateUserWithProfile(input: AdminCreateUserInput) {
  const {
    username,
    name,
    password,
    role = "USER",
    email,
    companyName,
    registeredCapital,
    planCode,
  } = input;

  const passwordHash = await hashPassword(password);

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        username,
        name,
        passwordHash,
        role,
        email: email?.trim() || null,
        status: "ACTIVE",
      },
    });

    if (companyName?.trim()) {
      await tx.companyProfile.create({
        data: {
          userId: user.id,
          companyName: companyName.trim(),
          registeredCapital: registeredCapital?.trim() || null,
        },
      });
    }

    if (planCode && planCode !== "FREE") {
      const plan = await tx.plan.findUnique({ where: { code: planCode } });
      if (plan) {
        const startsAt = new Date();
        const endsAt = new Date();
        endsAt.setFullYear(endsAt.getFullYear() + 1); // 默认开通1年
        await tx.subscription.create({
          data: {
            userId: user.id,
            planId: plan.id,
            status: "ACTIVE",
            billingCycle: "yearly",
            startsAt,
            endsAt,
          },
        });
      }
    }

    return user;
  });
}

export async function adminUpdateUserProfile(input: AdminUserProfileInput) {
  const {
    userId,
    name,
    email,
    role,
    status,
    companyName,
    registeredCapital,
    planCode,
    extendMonths,
    newPassword,
  } = input;

  return await prisma.$transaction(async (tx) => {
    const user = await tx.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new Error(`用户 ID ${userId} 不存在`);
    }

    const userData: Prisma.UserUpdateInput = {};
    if (name !== undefined) userData.name = name.trim();
    if (email !== undefined) userData.email = email.trim() || null;
    if (role !== undefined) userData.role = role;
    if (status !== undefined) userData.status = status;
    if (newPassword && newPassword.length >= 6) {
      userData.passwordHash = await hashPassword(newPassword);
    }

    if (Object.keys(userData).length > 0) {
      await tx.user.update({
        where: { id: userId },
        data: userData,
      });
    }

    // 企业信息处理
    if (companyName !== undefined || registeredCapital !== undefined) {
      const existingProfile = await tx.companyProfile.findUnique({ where: { userId } });
      const targetCompany = (companyName !== undefined ? companyName.trim() : existingProfile?.companyName) || "";
      const targetCapital = registeredCapital !== undefined ? registeredCapital.trim() || null : existingProfile?.registeredCapital ?? null;

      if (targetCompany) {
        await tx.companyProfile.upsert({
          where: { userId },
          update: {
            companyName: targetCompany,
            registeredCapital: targetCapital,
          },
          create: {
            userId,
            companyName: targetCompany,
            registeredCapital: targetCapital,
          },
        });
      }
    }

    // 套餐与权益延期处理
    if (planCode) {
      const plan = await tx.plan.findUnique({ where: { code: planCode } });
      if (plan) {
        const existingSub = await tx.subscription.findUnique({ where: { userId } });
        const now = new Date();
        let baseDate = now;
        if (existingSub?.endsAt && existingSub.endsAt > now) {
          baseDate = existingSub.endsAt;
        }

        const months = Number(extendMonths) || 12;
        const newEndsAt = new Date(baseDate);
        newEndsAt.setMonth(newEndsAt.getMonth() + months);

        if (existingSub) {
          await tx.subscription.update({
            where: { userId },
            data: {
              planId: plan.id,
              status: "ACTIVE",
              endsAt: plan.code === "FREE" ? null : newEndsAt,
            },
          });
        } else {
          await tx.subscription.create({
            data: {
              userId,
              planId: plan.id,
              status: "ACTIVE",
              billingCycle: "yearly",
              startsAt: now,
              endsAt: plan.code === "FREE" ? null : newEndsAt,
            },
          });
        }
      }
    }

    return { success: true };
  });
}

"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import {
  ensureRbacInitialized,
  DEFAULT_ADMIN_MENUS,
  DEFAULT_SITE_MENUS,
} from "@/lib/rbac";

async function requireSuperAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("无权操作：仅超级管理员可管理系统导航菜单");
  }
  return user;
}

export interface SaveMenuInput {
  id?: number;
  parentId?: number | null;
  title: string;
  path: string;
  icon?: string;
  sortOrder: number;
  target: "ADMIN" | "SITE";
  badge?: string;
  permission?: string;
  active: boolean;
}

export async function getMenusDataAction() {
  await requireSuperAdmin();
  await ensureRbacInitialized();

  const [menus, permissions] = await Promise.all([
    prisma.menu.findMany({
      orderBy: [{ target: "asc" }, { sortOrder: "asc" }, { id: "asc" }],
      include: {
        parent: { select: { id: true, title: true } },
        _count: { select: { roleMenus: true, children: true } },
      },
    }),
    prisma.permission.findMany({
      select: { code: true, name: true, category: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return { menus, permissions };
}

export async function saveMenuAction(
  payload: SaveMenuInput,
): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();

  const { id, parentId, title, path, icon, sortOrder, target, badge, permission, active } = payload;
  const trimmedTitle = title.trim();
  const trimmedPath = path.trim();

  if (!trimmedTitle) return { success: false, error: "请输入菜单标题" };
  if (!trimmedPath) return { success: false, error: "请输入路由路径" };

  try {
    if (id) {
      await prisma.menu.update({
        where: { id },
        data: {
          parentId: parentId || null,
          title: trimmedTitle,
          path: trimmedPath,
          icon: icon?.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          target,
          badge: badge?.trim() || null,
          permission: permission?.trim() || null,
          active,
        },
      });
    } else {
      await prisma.menu.create({
        data: {
          parentId: parentId || null,
          title: trimmedTitle,
          path: trimmedPath,
          icon: icon?.trim() || null,
          sortOrder: Number(sortOrder) || 0,
          target,
          badge: badge?.trim() || null,
          permission: permission?.trim() || null,
          active,
        },
      });
    }

    revalidatePath("/admin/menus");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "保存菜单失败" };
  }
}

export async function toggleMenuActiveAction(
  id: number,
  active: boolean,
): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();

  try {
    await prisma.menu.update({
      where: { id },
      data: { active },
    });
    revalidatePath("/admin/menus");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "状态切换失败" };
  }
}

export async function deleteMenuAction(
  id: number,
): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();

  try {
    const childrenCount = await prisma.menu.count({ where: { parentId: id } });
    if (childrenCount > 0) {
      return { success: false, error: `该菜单下包含 ${childrenCount} 个子菜单，请先删除或移除子菜单` };
    }

    await prisma.menu.delete({ where: { id } });
    revalidatePath("/admin/menus");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "删除菜单失败" };
  }
}

/** 一键重置/补齐系统预设标准菜单 */
export async function resetDefaultMenusAction(): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();

  try {
    const allDefs = [...DEFAULT_ADMIN_MENUS, ...DEFAULT_SITE_MENUS];
    for (const d of allDefs) {
      const existing = await prisma.menu.findFirst({
        where: { path: d.path, target: d.target },
      });
      if (existing) {
        await prisma.menu.update({
          where: { id: existing.id },
          data: {
            title: d.title,
            icon: d.icon,
            sortOrder: d.sortOrder,
            badge: d.badge ?? null,
            permission: d.permission ?? null,
            active: true,
          },
        });
      } else {
        await prisma.menu.create({
          data: {
            title: d.title,
            path: d.path,
            icon: d.icon,
            sortOrder: d.sortOrder,
            target: d.target,
            badge: d.badge ?? null,
            permission: d.permission ?? null,
            active: true,
          },
        });
      }
    }

    revalidatePath("/admin/menus");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "重置预设菜单失败" };
  }
}

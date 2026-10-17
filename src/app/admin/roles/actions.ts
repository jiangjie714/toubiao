"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { ensureRbacInitialized } from "@/lib/rbac";

async function requireSuperAdmin() {
  const user = await getSession();
  if (!user || user.role !== "ADMIN") {
    throw new Error("无权操作：仅超级管理员可管理角色与权限");
  }
  return user;
}

export interface SaveRoleInput {
  id?: number;
  code: string;
  name: string;
  scope: "PLATFORM" | "TENANT";
  description?: string;
  permissionIds: number[];
  menuIds: number[];
}

/** 获取全部角色及权限字典和菜单树 */
export async function getRoleOverviewDataAction() {
  await requireSuperAdmin();
  await ensureRbacInitialized();

  const [roles, permissions, menus] = await Promise.all([
    prisma.role.findMany({
      orderBy: [{ scope: "asc" }, { id: "asc" }],
      include: {
        rolePerms: { select: { permissionId: true } },
        roleMenus: { select: { menuId: true } },
        _count: {
          select: {
            userRoles: true,
            rolePerms: true,
            roleMenus: true,
          },
        },
      },
    }),
    prisma.permission.findMany({
      orderBy: [{ category: "asc" }, { id: "asc" }],
    }),
    prisma.menu.findMany({
      orderBy: [{ target: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  return {
    roles,
    permissions,
    menus,
  };
}

/** 创建或更新角色（含绑定的权限点与菜单） */
export async function saveRoleAction(
  payload: SaveRoleInput,
): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();

  const { id, code, name, scope, description, permissionIds, menuIds } = payload;
  const trimmedCode = code.trim().toUpperCase();
  const trimmedName = name.trim();

  if (!trimmedCode || !/^[A-Z0-9_]{3,30}$/.test(trimmedCode)) {
    return { success: false, error: "角色标识须为 3-30 位大写字母、数字或下划线" };
  }
  if (!trimmedName) {
    return { success: false, error: "请输入角色名称" };
  }

  try {
    await prisma.$transaction(async (tx) => {
      let roleId = id;

      if (roleId) {
        const existing = await tx.role.findUnique({ where: { id: roleId } });
        if (!existing) throw new Error("角色不存在");

        // 系统内置角色不可更改 code 与 scope
        if (existing.isSystem && existing.code !== trimmedCode) {
          throw new Error("系统内置角色标识不可更改");
        }

        await tx.role.update({
          where: { id: roleId },
          data: {
            code: existing.isSystem ? existing.code : trimmedCode,
            name: trimmedName,
            scope: existing.isSystem ? existing.scope : scope,
            description: description?.trim() || null,
          },
        });
      } else {
        const duplicate = await tx.role.findUnique({ where: { code: trimmedCode } });
        if (duplicate) throw new Error(`角色标识 ${trimmedCode} 已存在`);

        const created = await tx.role.create({
          data: {
            code: trimmedCode,
            name: trimmedName,
            scope,
            description: description?.trim() || null,
            isSystem: false,
          },
        });
        roleId = created.id;
      }

      // 同步权限关联
      await tx.rolePermission.deleteMany({ where: { roleId } });
      if (permissionIds.length > 0) {
        for (const pId of permissionIds) {
          await tx.rolePermission.create({
            data: { roleId, permissionId: pId },
          });
        }
      }

      // 同步菜单关联
      await tx.roleMenu.deleteMany({ where: { roleId } });
      if (menuIds.length > 0) {
        for (const mId of menuIds) {
          await tx.roleMenu.create({
            data: { roleId, menuId: mId },
          });
        }
      }
    });

    revalidatePath("/admin/roles");
    revalidatePath("/admin");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "保存角色失败" };
  }
}

/** 删除自定义角色（系统内置角色不可删除） */
export async function deleteRoleAction(
  roleId: number,
): Promise<{ success: boolean; error?: string }> {
  await requireSuperAdmin();

  try {
    const role = await prisma.role.findUnique({
      where: { id: roleId },
      include: {
        _count: { select: { userRoles: true } },
      },
    });

    if (!role) return { success: false, error: "角色不存在" };
    if (role.isSystem) return { success: false, error: "系统内置角色受保护，禁止删除" };
    if (role._count.userRoles > 0) {
      return {
        success: false,
        error: `该角色当前关联有 ${role._count.userRoles} 位用户，请先解除绑定后再删除`,
      };
    }

    await prisma.role.delete({ where: { id: roleId } });
    revalidatePath("/admin/roles");
    return { success: true };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "删除角色失败" };
  }
}

"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";

async function requireUser() {
  const user = await getSession();
  if (!user) redirect("/login?next=/watches");
  return user;
}

export type WatchState = { error?: string };

export async function createWatchAction(
  _previous: WatchState,
  formData: FormData,
): Promise<WatchState> {
  const user = await requireUser();
  const entitlement = await getEntitlement(user.uid);
  if (!user.emailVerified) return { error: "请先完成邮箱验证" };
  if (entitlement.features.pushGroups <= 0) return { error: "当前套餐不支持关键词订阅" };

  const count = await prisma.pushWatch.count({ where: { userId: user.uid } });
  if (count >= entitlement.features.pushGroups) {
    return { error: `当前套餐最多支持 ${entitlement.features.pushGroups} 组关键词` };
  }

  const name = String(formData.get("name") ?? "").trim();
  const keyword = String(formData.get("keyword") ?? "").trim();
  const type = String(formData.get("type") ?? "");
  const provinceCode = String(formData.get("provinceCode") ?? "").trim();
  const cityCode = String(formData.get("cityCode") ?? "").trim();
  const channel = String(formData.get("channel") ?? "email").trim();
  const webhookUrl = String(formData.get("webhookUrl") ?? "").trim();

  if (!name || name.length > 30) return { error: "请填写 1-30 位订阅名称" };
  if (!keyword || keyword.length > 50) return { error: "请填写 1-50 位关键词" };
  if (channel !== "email" && webhookUrl && !webhookUrl.startsWith("http")) {
    return { error: "请输入有效的机器人 Webhook 完整链接" };
  }

  const channels = channel === "email" ? ["email"] : [channel, "email"];

  await prisma.pushWatch.create({
    data: {
      userId: user.uid,
      name,
      keyword,
      type: ["NOTICE", "RESULT", "CHANGE", "INQUIRY"].includes(type) ? type : null,
      provinceCode: provinceCode || null,
      cityCode: cityCode || null,
      frequency: "daily",
      channels,
      webhookUrl: webhookUrl || null,
      enabled: true,
    },
  });
  revalidatePath("/watches");
  redirect("/watches?created=1");
}

export async function toggleWatchAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  const watch = await prisma.pushWatch.findFirst({ where: { id, userId: user.uid } });
  if (watch) {
    await prisma.pushWatch.update({ where: { id }, data: { enabled: !watch.enabled } });
  }
  revalidatePath("/watches");
}

export async function deleteWatchAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const id = Number(formData.get("id"));
  await prisma.pushWatch.deleteMany({ where: { id, userId: user.uid } });
  revalidatePath("/watches");
}

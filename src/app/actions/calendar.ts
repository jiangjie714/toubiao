"use server";

import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";
import {
  detectCalendarConflicts,
  formatDateKey,
  generateICalendarString,
  generateScheduleWeeklyReportMarkdown,
  type CalendarEventItem,
  type CalendarEventType,
  type CalendarMonthData,
} from "@/lib/calendar-manager";

export interface SaveMilestoneInput {
  id?: number;
  followId?: number;
  title: string;
  type: string;
  targetDate: string; // YYYY-MM-DD 或 ISO
  assignee?: string;
  notes?: string;
}

/**
 * 获取指定年月的所有日历事件与排期冲突预警
 */
export async function getCalendarEventsAction(options?: {
  year?: number;
  month?: number; // 1-12
  mode?: "personal" | "team";
  typeFilter?: string;
  assigneeFilter?: string;
}): Promise<{
  success: boolean;
  data?: CalendarMonthData;
  teamMembers?: Array<{ username: string; name: string }>;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    const now = new Date();
    const currentYear = options?.year || now.getFullYear();
    const currentMonth = options?.month || now.getMonth() + 1;

    // 确定查询的月范围（前后扩充 7 天以支持日历网格跨月展示）
    const startDate = new Date(currentYear, currentMonth - 1, 1 - 7, 0, 0, 0);
    const endDate = new Date(currentYear, currentMonth, 7, 23, 59, 59);

    // 查询团队信息
    const teamMember = await prisma.teamMember.findUnique({
      where: { userId: user.uid },
      select: { teamId: true },
    });
    const ownedTeam = await prisma.team.findUnique({
      where: { ownerId: user.uid },
      include: {
        members: {
          include: {
            user: { select: { username: true, name: true } },
          },
        },
      },
    });

    const effectiveTeamId = teamMember?.teamId || ownedTeam?.id || null;
    const requestedMode = options?.mode || (effectiveTeamId ? "team" : "personal");

    let teamMembersList: Array<{ username: string; name: string }> = [];
    if (ownedTeam) {
      teamMembersList = ownedTeam.members.map((m) => ({
        username: m.user.username,
        name: m.user.name,
      }));
    } else if (teamMember?.teamId) {
      const fullTeam = await prisma.team.findUnique({
        where: { id: teamMember.teamId },
        include: {
          members: {
            include: {
              user: { select: { username: true, name: true } },
            },
          },
        },
      });
      if (fullTeam) {
        teamMembersList = fullTeam.members.map((m) => ({
          username: m.user.username,
          name: m.user.name,
        }));
      }
    }

    const events: CalendarEventItem[] = [];

    // 1. 抓取跟进项目及开标节点 (TenderFollow.tender.expireDate & remindDate)
    const followWhere: Record<string, unknown> = {};
    if (effectiveTeamId && requestedMode === "team") {
      followWhere.teamId = effectiveTeamId;
    } else {
      followWhere.userId = user.uid;
    }

    const follows = await prisma.tenderFollow.findMany({
      where: followWhere,
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            purchaser: true,
            expireDate: true,
            budgetAmount: true,
          },
        },
      },
    });

    for (const f of follows) {
      // 1.1 截标/开标事件
      if (f.tender.expireDate) {
        const d = new Date(f.tender.expireDate);
        if (d >= startDate && d <= endDate) {
          const isCompleted = f.status === "WON" || f.status === "LOST";
          events.push({
            id: `sub-${f.id}`,
            title: `${f.tender.title} 截标开标`,
            type: "SUBMISSION",
            date: formatDateKey(d),
            time: d.toTimeString().slice(0, 5),
            urgency: "CRITICAL",
            followId: f.id,
            tenderId: f.tender.id,
            tenderTitle: f.tender.title,
            purchaser: f.tender.purchaser || undefined,
            assignee: f.assignee || undefined,
            status: isCompleted ? "COMPLETED" : "PENDING",
            notes: f.notes || "关注开标倒计时与投标保证金到位情况",
          });
        }
      }

      // 1.2 跟进提醒日事件
      if (f.remindDate) {
        const rd = new Date(f.remindDate);
        if (rd >= startDate && rd <= endDate) {
          events.push({
            id: `remind-${f.id}`,
            title: `项目跟进提醒: ${f.tender.title}`,
            type: "REMIND",
            date: formatDateKey(rd),
            urgency: "NORMAL",
            followId: f.id,
            tenderId: f.tender.id,
            tenderTitle: f.tender.title,
            purchaser: f.tender.purchaser || undefined,
            assignee: f.assignee || undefined,
            status: "PENDING",
            notes: f.notes || "商机推进阶段性备忘",
          });
        }
      }
    }

    // 2. 抓取保证金退款节点 (BidDeposit.refundDeadline)
    const depositWhere: Record<string, unknown> = {
      refundDeadline: {
        gte: startDate,
        lte: endDate,
      },
      status: { notIn: ["REFUNDED", "FORFEITED"] },
    };
    if (effectiveTeamId && requestedMode === "team") {
      depositWhere.teamId = effectiveTeamId;
    } else {
      depositWhere.userId = user.uid;
    }

    const deposits = await prisma.bidDeposit.findMany({
      where: depositWhere,
    });

    for (const dep of deposits) {
      if (dep.refundDeadline) {
        const dd = new Date(dep.refundDeadline);
        events.push({
          id: `dep-${dep.id}`,
          title: `保证金退款截止: ${dep.projectName}`,
          type: "DEPOSIT_DEADLINE",
          date: formatDateKey(dd),
          urgency: "WARNING",
          tenderId: dep.tenderId || undefined,
          tenderTitle: dep.projectName,
          purchaser: dep.purchaser || dep.payeeName || undefined,
          status: dep.status === "REFUNDED" ? "COMPLETED" : "PENDING",
          notes: `金额: ${dep.amount.toString()}元，收款方: ${dep.payeeName || "公共资源交易中心"}`,
        });
      }
    }

    // 3. 抓取资质证书到期事件 (CompanyQualification.expiryDate)
    const qualWhere: Record<string, unknown> = {
      expiryDate: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (effectiveTeamId && requestedMode === "team") {
      qualWhere.teamId = effectiveTeamId;
    } else {
      qualWhere.userId = user.uid;
    }

    const qualifications = await prisma.companyQualification.findMany({
      where: qualWhere,
    });

    for (const q of qualifications) {
      const qd = new Date(q.expiryDate);
      events.push({
        id: `qual-${q.id}`,
        title: `资质证书到期预警: ${q.name}`,
        type: "QUALIFICATION_EXPIRY",
        date: formatDateKey(qd),
        urgency: "CRITICAL",
        status: "PENDING",
        notes: `证书编号: ${q.certNo || "-"}，颁发机构: ${q.issuingAuthority || "-"}`,
      });
    }

    // 4. 抓取自定义里程碑 (BidMilestone)
    const milestoneWhere: Record<string, unknown> = {
      targetDate: {
        gte: startDate,
        lte: endDate,
      },
    };
    if (effectiveTeamId && requestedMode === "team") {
      milestoneWhere.teamId = effectiveTeamId;
    } else {
      milestoneWhere.userId = user.uid;
    }

    const milestones = await prisma.bidMilestone.findMany({
      where: milestoneWhere,
      include: {
        follow: {
          include: {
            tender: {
              select: {
                id: true,
                title: true,
                purchaser: true,
              },
            },
          },
        },
      },
    });

    for (const m of milestones) {
      const md = new Date(m.targetDate);
      let mType: CalendarEventType = "CUSTOM";
      if (
        m.type === "SUBMISSION" ||
        m.type === "CLARIFICATION" ||
        m.type === "SITE_VISIT" ||
        m.type === "DEPOSIT_DEADLINE" ||
        m.type === "INTERNAL_REVIEW"
      ) {
        mType = m.type as CalendarEventType;
      }

      events.push({
        id: `ms-${m.id}`,
        title: m.title,
        type: mType,
        date: formatDateKey(md),
        urgency: mType === "SUBMISSION" ? "CRITICAL" : "NORMAL",
        followId: m.followId || undefined,
        tenderId: m.follow?.tender.id,
        tenderTitle: m.follow?.tender.title,
        purchaser: m.follow?.tender.purchaser || undefined,
        assignee: m.assignee || undefined,
        status: m.status === "COMPLETED" ? "COMPLETED" : "PENDING",
        isMilestoneRecord: true,
        milestoneId: m.id,
        notes: m.notes || undefined,
      });
    }

    // 筛选过滤
    let filteredEvents = events;
    if (options?.typeFilter && options.typeFilter !== "ALL") {
      filteredEvents = filteredEvents.filter((e) => e.type === options.typeFilter);
    }
    if (options?.assigneeFilter && options.assigneeFilter !== "ALL") {
      filteredEvents = filteredEvents.filter((e) => e.assignee === options.assigneeFilter);
    }

    // 排序
    filteredEvents.sort((a, b) => a.date.localeCompare(b.date));

    // 冲突排查
    const conflicts = detectCalendarConflicts(filteredEvents);

    const totalPendingCount = filteredEvents.filter((e) => e.status === "PENDING").length;
    const criticalEventsCount = filteredEvents.filter(
      (e) => e.urgency === "CRITICAL" && e.status === "PENDING"
    ).length;

    return {
      success: true,
      data: {
        year: currentYear,
        month: currentMonth,
        events: filteredEvents,
        conflicts,
        totalPendingCount,
        criticalEventsCount,
      },
      teamMembers: teamMembersList,
    };
  } catch (error) {
    console.error("getCalendarEventsAction error:", error);
    return { success: false, error: "获取日历排期失败" };
  }
}

/**
 * 新增或编辑自定义关键里程碑节点
 */
export async function saveBidMilestoneAction(input: SaveMilestoneInput): Promise<{
  success: boolean;
  milestoneId?: number;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    if (!input.title || !input.title.trim()) {
      return { success: false, error: "请输入里程碑标题" };
    }
    if (!input.targetDate) {
      return { success: false, error: "请选择里程碑发生时间" };
    }

    let teamId: number | null = null;
    if (input.followId) {
      const follow = await prisma.tenderFollow.findUnique({
        where: { id: input.followId },
        select: { teamId: true },
      });
      if (follow) {
        teamId = follow.teamId;
      }
    }

    const targetDateObj = new Date(input.targetDate);

    if (input.id) {
      const updated = await prisma.bidMilestone.update({
        where: { id: input.id },
        data: {
          title: input.title.trim(),
          type: input.type,
          targetDate: targetDateObj,
          assignee: input.assignee?.trim() || null,
          notes: input.notes?.trim() || null,
          followId: input.followId || null,
        },
      });
      revalidatePath("/calendar");
      return { success: true, milestoneId: updated.id };
    } else {
      const created = await prisma.bidMilestone.create({
        data: {
          userId: user.uid,
          teamId,
          followId: input.followId || null,
          title: input.title.trim(),
          type: input.type,
          targetDate: targetDateObj,
          assignee: input.assignee?.trim() || user.name || user.username,
          notes: input.notes?.trim() || null,
        },
      });
      revalidatePath("/calendar");
      return { success: true, milestoneId: created.id };
    }
  } catch (error) {
    console.error("saveBidMilestoneAction error:", error);
    return { success: false, error: "保存里程碑节点失败" };
  }
}

/**
 * 切换里程碑完成状态
 */
export async function toggleMilestoneStatusAction(
  milestoneId: number,
  nextStatus: "PENDING" | "COMPLETED"
): Promise<{ success: boolean; error?: string }> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    await prisma.bidMilestone.update({
      where: { id: milestoneId },
      data: { status: nextStatus },
    });

    revalidatePath("/calendar");
    return { success: true };
  } catch (error) {
    console.error("toggleMilestoneStatusAction error:", error);
    return { success: false, error: "更新里程碑状态失败" };
  }
}

/**
 * 删除自定义里程碑
 */
export async function deleteBidMilestoneAction(milestoneId: number): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const user = await getSession();
    if (!user) {
      return { success: false, error: "请先登录" };
    }

    await prisma.bidMilestone.delete({
      where: { id: milestoneId },
    });

    revalidatePath("/calendar");
    return { success: true };
  } catch (error) {
    console.error("deleteBidMilestoneAction error:", error);
    return { success: false, error: "删除里程碑失败" };
  }
}

/**
 * 导出当前筛选范围的标准 iCalendar (.ics) 字符串
 */
export async function exportCalendarIcsAction(options?: {
  year?: number;
  month?: number;
  mode?: "personal" | "team";
}): Promise<{ success: boolean; icsContent?: string; error?: string }> {
  try {
    const res = await getCalendarEventsAction(options);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "获取日历数据失败" };
    }

    const icsContent = generateICalendarString(res.data.events, "标讯通-投标推进排期日历");
    return { success: true, icsContent };
  } catch (error) {
    console.error("exportCalendarIcsAction error:", error);
    return { success: false, error: "导出日历文件失败" };
  }
}

/**
 * 导出公文级投标周报 Markdown 文本
 */
export async function exportCalendarWeeklyReportAction(options?: {
  year?: number;
  month?: number;
  mode?: "personal" | "team";
}): Promise<{ success: boolean; markdown?: string; error?: string }> {
  try {
    const res = await getCalendarEventsAction(options);
    if (!res.success || !res.data) {
      return { success: false, error: res.error || "获取日历数据失败" };
    }

    const y = res.data.year;
    const m = res.data.month;
    const startDateStr = `${y}-${String(m).padStart(2, "0")}-01`;
    const lastDay = new Date(y, m, 0).getDate();
    const endDateStr = `${y}-${String(m).padStart(2, "0")}-${lastDay}`;

    const markdown = generateScheduleWeeklyReportMarkdown(
      res.data.events,
      res.data.conflicts,
      startDateStr,
      endDateStr
    );

    return { success: true, markdown };
  } catch (error) {
    console.error("exportCalendarWeeklyReportAction error:", error);
    return { success: false, error: "导出日程周报失败" };
  }
}

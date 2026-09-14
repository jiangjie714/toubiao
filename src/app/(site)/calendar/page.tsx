import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCalendarEventsAction } from "@/app/actions/calendar";
import BidCalendarView from "@/components/bid-calendar-view";

export const metadata = {
  title: "企业招投标协同日历与排期大盘 - 标讯通",
  description: "全景聚合标讯截标开标倒计时、答疑澄清、现场踏勘、保证金流转与内部封标关键里程碑，支持排期冲突检测与手机日历一键同步",
};

export default async function CalendarPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/calendar");
  }

  const teamMember = await prisma.teamMember.findUnique({
    where: { userId: user.uid },
    select: { teamId: true },
  });
  const ownedTeam = await prisma.team.findUnique({
    where: { ownerId: user.uid },
    select: { id: true },
  });
  const hasTeam = Boolean(teamMember?.teamId || ownedTeam);

  const now = new Date();
  const res = await getCalendarEventsAction({
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    mode: hasTeam ? "team" : "personal",
  });

  // 获取跟进标讯清单供新建里程碑选择
  const follows = await prisma.tenderFollow.findMany({
    where: hasTeam && (teamMember?.teamId || ownedTeam?.id)
      ? { teamId: teamMember?.teamId || ownedTeam?.id }
      : { userId: user.uid },
    include: {
      tender: { select: { id: true, title: true } },
    },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const followsList = follows.map((f) => ({
    id: f.id,
    title: f.tender.title,
  }));

  const initialData = res.data || {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    events: [],
    conflicts: [],
    totalPendingCount: 0,
    criticalEventsCount: 0,
  };

  return (
    <div className="">
      <BidCalendarView
        initialData={initialData}
        initialTeamMembers={res.teamMembers || []}
        hasTeam={hasTeam}
        followsList={followsList}
      />
    </div>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getReviewAnalyticsAction } from "@/app/actions/review";
import ReviewAnalyticsView from "@/components/review-analytics-view";

export const metadata = {
  title: "企业投标复盘与失标归因诊断罗盘 - 标讯通",
  description: "企业级投标项目开标复盘大盘、六维胜败归因漏斗、价格偏离度精算与经验教训总结报告生成",
};

export default async function ReviewsPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/reviews");
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

  const initialData = await getReviewAnalyticsAction({
    mode: hasTeam ? "team" : "personal",
  });

  return (
    <div className="">
      <ReviewAnalyticsView initialData={initialData} hasTeam={hasTeam} />
    </div>
  );
}

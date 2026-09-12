import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getMyTeamAction } from "@/app/actions/team";
import TeamManagementView from "@/components/team-management-view";

export const metadata = {
  title: "企业团队席位与权益协同 - 标讯通",
  description: "企业级多席位协同、白金权益全员共享、项目跟踪看板与权限配置中心",
};

export default async function TeamPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/team");
  }

  const teamRes = await getMyTeamAction();

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TeamManagementView
        initialTeam={teamRes.data}
        userName={user.name || user.username}
      />
    </div>
  );
}

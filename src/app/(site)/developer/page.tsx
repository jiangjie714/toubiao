import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getUserApiKeysAction } from "@/app/actions/api-key";
import DeveloperConsole from "@/components/developer-console";

export const metadata = {
  title: "开发者中心与开放 API - 标讯通",
  description: "企业级招投标数据开放 API、密钥管理、在线沙盒调试与系统集成指南",
};

export default async function DeveloperPage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/developer");
  }

  const initialData = await getUserApiKeysAction();

  return (
    <div className="">
      <DeveloperConsole
        initialData={initialData}
        userName={user.name || user.username}
      />
    </div>
  );
}

import { Metadata } from "next";
import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { runSecurityComplianceInspection } from "@/lib/compliance";
import ComplianceDashboard from "@/components/compliance-dashboard";

export const metadata: Metadata = {
  title: "网络安全等保二级合规中心 - 标讯通",
  description: "对照国家等保二级 S2A2G2 规范的全量安全合规诊断、审计证据与自评公文报告导出中心。",
};

export default async function CompliancePage() {
  const user = await getSession();
  if (!user) {
    redirect("/login?from=/compliance");
  }

  const inspection = await runSecurityComplianceInspection();

  return (
    <div className="container mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <ComplianceDashboard
        initialData={inspection}
        userName={user.name || user.username}
      />
    </div>
  );
}

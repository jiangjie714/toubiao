import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getEntitlement } from "@/lib/quota";
import { prisma } from "@/lib/prisma";
import { compareSuppliers, getTopSuppliers } from "@/lib/competitor";
import CompetitorCompareView from "@/components/competitor-compare-view";
import Link from "next/link";
import { ArrowsRightLeftIcon } from "@/components/icons";

export const metadata = {
  title: "同业竞争对标PK与标王博弈分析 - 标讯通",
  description:
    "全国招投标同业企业核心战绩量化对标、中标客单价偏好PK、共有核心发包金主穿透与竞争博弈突围策略",
};

export default async function SupplierComparePage({
  searchParams,
}: {
  searchParams: Promise<{ names?: string }>;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/suppliers/compare");
  }

  const { names } = await searchParams;
  const entitlement = await getEntitlement(user.uid);
  const isPremium =
    user.role === "ADMIN" ||
    entitlement.planCode === "PLATINUM" ||
    entitlement.planCode.startsWith("ENTERPRISE") ||
    entitlement.features.contacts === true;

  // 获取用户本企业资料（若已录入）
  const profile = await prisma.companyProfile.findUnique({
    where: { userId: user.uid },
    select: { companyName: true },
  });

  // 解析对比企业名单；若未指定，默认抓取全库中标榜前 2 名标王
  let targetNames: string[] = [];
  if (names && names.trim()) {
    targetNames = names
      .split(",")
      .map((n) => decodeURIComponent(n).trim())
      .filter(Boolean)
      .slice(0, 3);
  }

  if (targetNames.length === 0) {
    const top2 = await getTopSuppliers({ limit: 2 });
    targetNames = top2.map((s) => s.name);
  }

  const comparisonData = await compareSuppliers(
    targetNames,
    Boolean(isPremium),
    entitlement.planCode
  );

  return (
    <div className="space-y-6">
      {/* 顶部面包屑与导航 */}
      <div className="flex items-center justify-between">
        <Link
          href="/suppliers"
          className="cursor-pointer text-sm text-slate-500 hover:text-primary transition-colors flex items-center gap-1"
        >
          <span>← 返回供应商中标情报大厅</span>
        </Link>

        <div className="flex items-center gap-2">
          <Link
            href="/intentions"
            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <span>采购意向雷达</span>
          </Link>
          <Link
            href="/exports"
            className="cursor-pointer inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 shadow-2xs"
          >
            <span>批量商机导出</span>
          </Link>
        </div>
      </div>

      {!comparisonData || comparisonData.suppliers.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-surface p-12 text-center">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-400">
            <ArrowsRightLeftIcon className="h-6 w-6" />
          </span>
          <h3 className="mt-4 text-base font-bold text-slate-800">
            未检索到对比企业的招投标中标记录
          </h3>
          <p className="mt-1 text-xs text-slate-500">
            请确认输入的供应商企业名称是否准确，或返回排行榜选择已有中标数据的代表性企业
          </p>
          <div className="mt-6">
            <Link
              href="/suppliers"
              className="cursor-pointer inline-flex items-center rounded-lg bg-primary px-4 py-2 text-xs font-medium text-white shadow-2xs hover:opacity-90"
            >
              浏览供应商中标排行榜 →
            </Link>
          </div>
        </div>
      ) : (
        <CompetitorCompareView
          initialData={comparisonData}
          initialNames={targetNames}
          userCompanyName={profile?.companyName}
        />
      )}
    </div>
  );
}

import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { getTenderCompareAction } from "@/app/actions/tender-compare";
import TenderCompareView from "@/components/tender-compare-view";
import TenderCompareTray from "@/components/tender-compare-tray";

export const metadata = {
  title: "标讯商机多标横向决策对比罗盘 - 标讯通",
  description:
    "横向穿透商业体量、截标周期、发包金主偏好、评分办法结构与一票否决项，辅助投标决策团队精准选标",
};

export default async function TenderComparePage({
  searchParams,
}: {
  searchParams: Promise<{ ids?: string }>;
}) {
  const user = await getSession();
  if (!user) {
    redirect("/login?next=/tenders/compare");
  }

  const { ids: rawIds } = await searchParams;
  const ids = (rawIds || "")
    .split(",")
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => Number.isInteger(n) && n > 0);

  const res = await getTenderCompareAction(ids);

  const data = res.data || {
    tenders: [],
    isLocked: false,
    maxAllowed: 4,
    planName: "VIP专享",
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <TenderCompareView initialData={data} initialIds={ids} />
      <TenderCompareTray />
    </div>
  );
}

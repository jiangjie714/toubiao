import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { updateTenderAction } from "../../../actions";
import TenderForm from "../../tender-form";

export const metadata = { title: "编辑公告" };

export default async function EditTenderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [tender, provinces, cities] = await Promise.all([
    prisma.tender.findUnique({ where: { id: parseInt(id, 10) || -1 } }),
    prisma.region.findMany({ where: { level: 1 }, orderBy: { code: "asc" } }),
    prisma.region.findMany({ where: { level: 2 }, orderBy: { code: "asc" } }),
  ]);
  if (!tender) notFound();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">编辑公告</h1>
        <p className="mt-1 text-sm text-slate-500">修改公告内容与属性</p>
      </div>
      <TenderForm
        action={updateTenderAction}
        tender={tender}
        provinces={provinces.map((p) => ({ code: p.code, name: p.name }))}
        cities={cities.map((c) => ({ code: c.code, name: c.name, parentCode: c.parentCode ?? "" }))}
      />
    </div>
  );
}

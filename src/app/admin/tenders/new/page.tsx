import { prisma } from "@/lib/prisma";
import { createTenderAction } from "../../actions";
import TenderForm from "../tender-form";

export const metadata = { title: "新增公告" };

export default async function NewTenderPage() {
  const [provinces, cities] = await Promise.all([
    prisma.region.findMany({ where: { level: 1 }, orderBy: { code: "asc" } }),
    prisma.region.findMany({ where: { level: 2 }, orderBy: { code: "asc" } }),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">新增公告</h1>
        <p className="mt-1 text-sm text-slate-500">手动补录招投标公告</p>
      </div>
      <TenderForm
        action={createTenderAction}
        provinces={provinces.map((p) => ({ code: p.code, name: p.name }))}
        cities={cities.map((c) => ({ code: c.code, name: c.name, parentCode: c.parentCode ?? "" }))}
      />
    </div>
  );
}

import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ChatBubbleIcon, BoltIcon, ShieldCheckIcon, ClipboardIcon, ExternalLinkIcon } from "@/components/icons";
import { updateFeedbackStatusAction } from "./actions";
import TenderCorrectionModal from "@/components/admin/tender-correction-modal";

export const metadata = { title: "数据纠错与置信度保护 - 管理后台" };

const ISSUE_TYPE_LABELS: Record<string, string> = {
  AMOUNT_ERROR: "金额不准",
  EXPIRED_ERROR: "时间错误",
  LINK_BROKEN: "链接失效",
  CONTENT_ERROR: "正文缺失/混乱",
  OTHER: "其他问题",
};

const STATUS_BADGES: Record<string, string> = {
  PENDING: "bg-amber-50 text-amber-700 border-amber-200",
  RESOLVED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  REJECTED: "bg-slate-100 text-slate-600 border-slate-200",
};

export default async function AdminFeedbacksPage() {
  const [total, pendingCount, resolvedCount, feedbacks] = await Promise.all([
    prisma.tenderFeedback.count(),
    prisma.tenderFeedback.count({ where: { status: "PENDING" } }),
    prisma.tenderFeedback.count({ where: { status: "RESOLVED" } }),
    prisma.tenderFeedback.findMany({
      include: {
        tender: {
          select: {
            id: true,
            title: true,
            sourceName: true,
            sourceUrl: true,
            budgetAmount: true,
            expireDate: true,
            openTime: true,
            projectNo: true,
            winningSupplier: true,
            purchaser: true,
            fieldsConfidence: true,
          },
        },
        user: { select: { id: true, name: true, username: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
  ]);

  const cards = [
    { label: "累计报错反馈", value: total, Icon: ClipboardIcon, tone: "bg-blue-50 text-blue-700" },
    { label: "待核实处理", value: pendingCount, Icon: BoltIcon, tone: "bg-amber-50 text-amber-600" },
    { label: "已核实解决", value: resolvedCount, Icon: ShieldCheckIcon, tone: "bg-emerald-50 text-emerald-600" },
    { label: "已驳回/忽略", value: total - pendingCount - resolvedCount, Icon: ChatBubbleIcon, tone: "bg-slate-100 text-slate-600" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-slate-900">数据纠错与反馈</h1>
        <p className="mt-1 text-sm text-slate-500">
          用户在公告详情页提交的数据纠错报告，核对后请及时跟进修正
        </p>
      </div>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="flex items-center gap-3.5 rounded-xl border border-slate-200 bg-surface p-5">
            <span className={`flex h-11 w-11 items-center justify-center rounded-lg ${card.tone}`}>
              <card.Icon className="h-5 w-5" />
            </span>
            <div>
              <div className="text-2xl font-bold leading-7 text-slate-900 tnum">{card.value}</div>
              <div className="text-xs text-slate-500">{card.label}</div>
            </div>
          </div>
        ))}
      </section>

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-surface">
        <div className="border-b border-slate-100 px-5 py-3.5 text-sm font-semibold text-slate-800">
          反馈记录列表（最近 50 条）
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/70 text-left text-xs text-slate-500">
                <th className="px-5 py-3 font-medium">提交时间</th>
                <th className="px-5 py-3 font-medium">关联公告</th>
                <th className="px-5 py-3 font-medium">问题类型</th>
                <th className="px-5 py-3 font-medium">问题描述</th>
                <th className="px-5 py-3 font-medium">反馈人 / 联系方式</th>
                <th className="px-5 py-3 font-medium">状态 / 操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {feedbacks.map((fb) => (
                <tr key={fb.id} className="align-top transition-colors duration-150 hover:bg-blue-50/30">
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500 tnum">
                    {fb.createdAt.toLocaleString("zh-CN")}
                  </td>
                  <td className="max-w-[240px] px-5 py-4">
                    <Link
                      href={`/tender/${fb.tender.id}`}
                      target="_blank"
                      className="group flex items-center gap-1 text-xs font-medium text-slate-800 hover:text-primary"
                    >
                      <span className="truncate" title={fb.tender.title}>
                        {fb.tender.title}
                      </span>
                      <ExternalLinkIcon className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-primary" />
                    </Link>
                    <span className="mt-0.5 block text-[11px] text-slate-400">{fb.tender.sourceName}</span>
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <span className="rounded-md bg-blue-50 px-2 py-0.5 text-xs font-medium text-primary">
                      {ISSUE_TYPE_LABELS[fb.issueType] ?? fb.issueType}
                    </span>
                  </td>
                  <td className="max-w-[300px] px-5 py-4">
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-5">{fb.description}</p>
                    {fb.adminNote && (
                      <div className="mt-2 rounded bg-slate-50 p-1.5 text-[11px] text-slate-500 border border-slate-100">
                        <span className="font-semibold text-slate-600">处理备注：</span>
                        {fb.adminNote}
                      </div>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4 text-xs text-slate-600">
                    <div>{fb.user ? `${fb.user.name} (${fb.user.username})` : "访客用户"}</div>
                    {fb.contact && <div className="mt-0.5 text-[11px] text-slate-400 font-mono">{fb.contact}</div>}
                  </td>
                  <td className="whitespace-nowrap px-5 py-4">
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center gap-2">
                        <span
                          className={`inline-flex w-fit rounded border px-2 py-0.5 text-xs font-semibold ${
                            STATUS_BADGES[fb.status] ?? "bg-slate-100 text-slate-600"
                          }`}
                        >
                          {fb.status === "PENDING"
                            ? "待处理"
                            : fb.status === "RESOLVED"
                            ? "已修正 (置信度1.0)"
                            : "已驳回"}
                        </span>
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5 pt-1">
                        <TenderCorrectionModal
                          feedbackId={fb.id}
                          issueType={fb.issueType}
                          issueLabel={ISSUE_TYPE_LABELS[fb.issueType] ?? fb.issueType}
                          description={fb.description}
                          userName={fb.user?.name || fb.user?.username}
                          contact={fb.contact}
                          tender={{
                            id: fb.tender.id,
                            title: fb.tender.title,
                            sourceName: fb.tender.sourceName,
                            sourceUrl: fb.tender.sourceUrl,
                            budgetAmount: fb.tender.budgetAmount ? Number(fb.tender.budgetAmount) : null,
                            expireDate: fb.tender.expireDate ? fb.tender.expireDate.toISOString() : null,
                            openTime: fb.tender.openTime ? fb.tender.openTime.toISOString() : null,
                            projectNo: fb.tender.projectNo,
                            winningSupplier: fb.tender.winningSupplier,
                            purchaser: fb.tender.purchaser,
                            fieldsConfidence: (fb.tender.fieldsConfidence as Record<string, number>) || null,
                          }}
                        />

                        {fb.status === "PENDING" && (
                          <form action={updateFeedbackStatusAction}>
                            <input type="hidden" name="id" value={fb.id} />
                            <input type="hidden" name="status" value="REJECTED" />
                            <input
                              type="hidden"
                              name="adminNote"
                              value="已核实官方公告原文，现有数据与源站一致"
                            />
                            <button
                              type="submit"
                              className="cursor-pointer rounded border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 transition-colors shadow-2xs"
                            >
                              驳回
                            </button>
                          </form>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
              {feedbacks.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-14 text-center text-sm text-slate-500">
                    暂无用户纠错反馈
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

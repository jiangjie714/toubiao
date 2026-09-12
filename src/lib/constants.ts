export const TENDER_TYPES = [
  { value: "NOTICE", label: "招标公告" },
  { value: "RESULT", label: "中标公告" },
  { value: "CHANGE", label: "变更/更正" },
  { value: "INQUIRY", label: "询价/竞谈" },
] as const;

export type TenderType = (typeof TENDER_TYPES)[number]["value"];

export function tenderTypeLabel(value: string): string {
  return TENDER_TYPES.find((t) => t.value === value)?.label ?? value;
}

export function tenderTypeColor(value: string): string {
  switch (value) {
    case "NOTICE":
      return "bg-blue-50 text-blue-700 ring-blue-600/20";
    case "RESULT":
      return "bg-green-50 text-green-700 ring-green-600/20";
    case "CHANGE":
      return "bg-amber-50 text-amber-700 ring-amber-600/20";
    case "INQUIRY":
      return "bg-purple-50 text-purple-700 ring-purple-600/20";
    default:
      return "bg-gray-50 text-gray-600 ring-gray-500/20";
  }
}

export function formatDate(d: Date | null | undefined): string {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

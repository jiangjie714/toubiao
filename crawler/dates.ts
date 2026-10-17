/** 宽松解析常见中文日期写法，无法解析时返回 null */
export function parseDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const text = input.trim();

  // 2026-09-03 / 2026.09.03 / 2026/09/03 / 2026年9月3日（可带时间）
  const m = text.match(
    /(\d{4})[年./\-](\d{1,2})[月./\-](\d{1,2})日?(?:[ T](\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?/,
  );
  if (m) {
    const [, y, mo, d, h = "0", mi = "0", s = "0"] = m;
    const date = new Date(+y, +mo - 1, +d, +h, +mi, +s);
    return isNaN(date.getTime()) ? null : date;
  }

  // ISO / 其他 Date 可识别格式
  const date = new Date(text);
  return isNaN(date.getTime()) ? null : date;
}

/** 格式化日期为 YYYY-MM-DD 字符串 */
export function formatDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 返回指定日期当天的起始时刻（00:00:00.000） */
export function toDayStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/** 返回指定日期当天的结束时刻（23:59:59.999） */
export function toDayEnd(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}


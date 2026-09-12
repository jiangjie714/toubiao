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

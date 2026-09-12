import { prisma } from "@/lib/prisma";

export function canonicalizeTitle(title: string): string {
  return title
    .replace(/[（(][^（）()]*[）)]/g, "")
    .replace(/第?[一二三四五六七八九十\d]+次/g, "")
    .replace(/[\s：:，,。.、\-—_/\\|]+/g, "")
    .toLowerCase();
}

function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const bigrams = (value: string) => {
    const map = new Map<string, number>();
    for (let i = 0; i < value.length - 1; i++) {
      const gram = value.slice(i, i + 2);
      map.set(gram, (map.get(gram) ?? 0) + 1);
    }
    return map;
  };
  const left = bigrams(a);
  const right = bigrams(b);
  let intersection = 0;
  for (const [gram, count] of left) {
    intersection += Math.min(count, right.get(gram) ?? 0);
  }
  return (2 * intersection) / (a.length - 1 + b.length - 1);
}

export async function findOrCreateProjectId(input: {
  projectNo?: string;
  title: string;
  provinceCode?: string | null;
}): Promise<number | null> {
  const canonicalTitle = canonicalizeTitle(input.title);
  if (!canonicalTitle) return null;

  if (input.projectNo) {
    const existing = await prisma.project.findUnique({ where: { projectNo: input.projectNo } });
    if (existing) {
      await prisma.project.update({
        where: { id: existing.id },
        data: {
          canonicalTitle,
          provinceCode: input.provinceCode ?? existing.provinceCode,
        },
      });
      return existing.id;
    }
  }

  const candidates = await prisma.project.findMany({
    where: { canonicalTitle, provinceCode: input.provinceCode ?? undefined },
    take: 1,
  });
  if (candidates[0]) return candidates[0].id;

  const fuzzy = await prisma.project.findMany({ take: 200, orderBy: { updatedAt: "desc" } });
  const match = fuzzy.find((project) => similarity(canonicalTitle, project.canonicalTitle) >= 0.82);
  if (match) return match.id;

  const created = await prisma.project.create({
    data: {
      projectNo: input.projectNo,
      canonicalTitle,
      provinceCode: input.provinceCode ?? null,
    },
  });
  return created.id;
}

import type { Prisma } from '@prisma/client';

/**
 * Build a full‑text search filter for PostgreSQL.
 * Requires a `tsvector` column (e.g. `search_vector`) on the `Tender` table.
 * This helper constructs a Prisma filter using a raw SQL condition.
 */
export function buildFullTextWhere(query: string): Prisma.TenderWhereInput {
  const tokens = query.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return {} as Prisma.TenderWhereInput;
  const tsQuery = tokens.map((t) => t.replace(/'/g, "''")).join(' & ');
  // Prisma does not expose full‑text operators directly; we use `$raw`.
  // The column `search_vector` should be a tsvector generated from title and content.
  return {
    AND: [
      {
        raw: `search_vector @@ to_tsquery('simple', '${tsQuery}')`,
      },
    ],
  } as unknown as Prisma.TenderWhereInput;
}

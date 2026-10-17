import {
  canonicalizeProjectTitle,
  calculateBigramSimilarity,
  cascadeClusterProject,
  type ProjectClusterInput,
} from "./enrichment/project-cluster";

export const canonicalizeTitle = canonicalizeProjectTitle;

export type FindOrCreateProjectOptions = ProjectClusterInput;

export async function findOrCreateProjectId(
  input: {
    projectNo?: string;
    title: string;
    provinceCode?: string | null;
    type?: string;
    purchaser?: string | null;
    content?: string | null;
    budgetAmount?: number | null;
    awardAmount?: number | null;
    openTime?: Date | null;
    clarifyDeadline?: Date | null;
    winningSupplier?: string | null;
  }
): Promise<number | null> {
  return cascadeClusterProject({
    title: input.title,
    type: input.type || "NOTICE",
    projectNo: input.projectNo,
    provinceCode: input.provinceCode,
    purchaser: input.purchaser,
    content: input.content,
    budgetAmount: input.budgetAmount,
    awardAmount: input.awardAmount,
    openTime: input.openTime,
    clarifyDeadline: input.clarifyDeadline,
    winningSupplier: input.winningSupplier,
  });
}

export { calculateBigramSimilarity as similarity };

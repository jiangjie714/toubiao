import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { AttachmentMeta, NormalizedExtraFields } from "./extraction";
import { findOrCreateProjectId } from "./projects";
import { defaultStorage } from "./storage";

export type PersistTenderInput = {
  title: string;
  type: string;
  publishDate: Date;
  expireDate?: Date | null;
  provinceCode?: string | null;
  cityCode?: string | null;
  purchaser?: string | null;
  agency?: string | null;
  sourceName: string;
  sourceUrl: string;
  content: string;
  contentHtml?: string | null;
  extraFields: NormalizedExtraFields;
  attachments: AttachmentMeta[];
  confidence: Record<string, number>;
};

type RegionMatch = {
  match: (text: string) => { provinceCode: string | null; cityCode: string | null };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {};
}

function shouldReplace(
  currentConfidence: number,
  newConfidence: number,
  currentSource: string,
  newSource: string,
  newPriority: number,
): boolean {
  if (currentConfidence >= 1) return false;
  if (newConfidence > currentConfidence) return true;
  if (newConfidence === currentConfidence) {
    return currentSource !== newSource && newPriority >= 50;
  }
  return false;
}

export async function persistTender(
  input: PersistTenderInput,
  context: { skillCode: string; priority: number; regionMatcher: RegionMatch },
): Promise<boolean> {
  const region = context.regionMatcher.match(
    [
      input.provinceCode ? "" : "",
      input.purchaser ?? "",
      input.agency ?? "",
      input.title,
      input.content.slice(0, 300),
    ]
      .join(" ")
      .trim(),
  );

  const projectRefId = await findOrCreateProjectId({
    projectNo: input.extraFields.projectNo,
    title: input.title,
    provinceCode: input.provinceCode ?? region.provinceCode,
  });

  const contentHtml = input.contentHtml?.slice(0, 200_000) ?? null;
  if (contentHtml) {
    await defaultStorage.saveSnapshot(input.sourceUrl, contentHtml);
  }

  const extraData = {
    projectNo: input.extraFields.projectNo,
    budgetAmount: input.extraFields.budgetAmount ?? null,
    awardAmount: input.extraFields.awardAmount ?? null,
    openTime: input.extraFields.openTime ?? null,
    industryCode: input.extraFields.industryCode ?? null,
    winningSupplier: input.extraFields.winningSupplier ?? null,
    contentHtml,
    fieldsConfidence: input.confidence as unknown as object,
    fieldSources: Object.fromEntries(
      Object.keys(input.confidence).map((field) => [field, context.skillCode]),
    ) as unknown as object,
    projectRefId,
  };

  const existing = await prisma.tender.findUnique({ where: { sourceUrl: input.sourceUrl } });
  if (!existing) {
    await prisma.tender.create({
      data: {
        title: input.title,
        type: input.type,
        publishDate: input.publishDate,
        expireDate: input.expireDate ?? null,
        provinceCode: input.provinceCode ?? region.provinceCode,
        cityCode: input.cityCode ?? region.cityCode,
        purchaser: input.purchaser,
        agency: input.agency || input.extraFields.agency || null,
        sourceName: input.sourceName,
        sourceUrl: input.sourceUrl,
        content: input.content,
        ...extraData,
        attachments: {
          create: input.attachments.map((attachment) => ({
            name: attachment.name,
            sourceUrl: attachment.sourceUrl,
            status: "pending",
          })),
        },
      },
    });

    if (input.extraFields.contactPhone || input.extraFields.contactEmail || input.extraFields.contactAddress) {
      const tender = await prisma.tender.findUnique({ where: { sourceUrl: input.sourceUrl } });
      if (tender) {
        await prisma.orgContact.create({
          data: {
            orgName: input.purchaser ?? input.agency ?? input.sourceName,
            role: input.purchaser ? "purchaser" : "agency",
            phone: input.extraFields.contactPhone ?? null,
            email: input.extraFields.contactEmail ?? null,
            address: input.extraFields.contactAddress ?? null,
            tenderId: tender.id,
          },
        });
      }
    }
    return true;
  }

  const currentConfidence = asRecord(existing.fieldsConfidence) as Record<string, number>;
  const currentSources = asRecord(existing.fieldSources) as Record<string, string>;
  const updateData: Record<string, unknown> = {};
  const nextConfidence = { ...currentConfidence };
  const nextSources = { ...currentSources };

  const candidateFields = [
    "projectNo",
    "budgetAmount",
    "awardAmount",
    "openTime",
    "industryCode",
    "winningSupplier",
  ] as const;

  for (const field of candidateFields) {
    const value = extraData[field];
    if (value === null || value === undefined) continue;
    if (
      shouldReplace(
        currentConfidence[field] ?? 0,
        input.confidence[field] ?? 0,
        currentSources[field] ?? "",
        context.skillCode,
        context.priority,
      )
    ) {
      updateData[field] = value;
      nextConfidence[field] = input.confidence[field] ?? 0;
      nextSources[field] = context.skillCode;
    }
  }

  await prisma.tender.update({
    where: { id: existing.id },
    data: {
      ...updateData,
      title: existing.title || input.title,
      type: input.type,
      publishDate: input.publishDate,
      expireDate: input.expireDate ?? existing.expireDate,
      provinceCode: existing.provinceCode ?? input.provinceCode ?? region.provinceCode,
      cityCode: existing.cityCode ?? input.cityCode ?? region.cityCode,
      purchaser: existing.purchaser ?? input.purchaser,
      agency: existing.agency ?? input.agency,
      sourceName: input.sourceName,
      content: input.content,
      contentHtml,
      fieldsConfidence: nextConfidence as unknown as object,
      fieldSources: nextSources as unknown as object,
      projectRefId: existing.projectRefId ?? projectRefId,
    },
  });

  for (const attachment of input.attachments) {
    const exists = await prisma.attachment.findFirst({
      where: { tenderId: existing.id, sourceUrl: attachment.sourceUrl },
    });
    if (!exists) {
      await prisma.attachment.create({
        data: {
          tenderId: existing.id,
          name: attachment.name,
          sourceUrl: attachment.sourceUrl,
          status: "pending",
        },
      });
    }
  }

  if (input.extraFields.contactPhone || input.extraFields.contactEmail || input.extraFields.contactAddress) {
    const contact = await prisma.orgContact.findFirst({
      where: { orgName: input.purchaser ?? input.agency ?? input.sourceName, tenderId: existing.id },
    });
    if (!contact) {
      await prisma.orgContact.create({
        data: {
          orgName: input.purchaser ?? input.agency ?? input.sourceName,
          role: input.purchaser ? "purchaser" : "agency",
          phone: input.extraFields.contactPhone ?? null,
          email: input.extraFields.contactEmail ?? null,
          address: input.extraFields.contactAddress ?? null,
          tenderId: existing.id,
        },
      });
    }
  }

  return false;
}

export type PersistResult = boolean;
export const Decimal = Prisma.Decimal;

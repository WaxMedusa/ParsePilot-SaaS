import { prisma } from '../prisma';
import { ApiError } from '../http/errors';

export type Vendor = {
  id: string;
  canonicalName: string;
  normalizedKey: string;
  taxId: string | null;
  paymentTerms: string | null;
  defaultGlCode: string | null;
  defaultDepartment: string | null;
  currency: string | null;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  aliases: VendorAlias[];
};

export type VendorAlias = {
  id: string;
  name: string;
  normalizedKey: string;
  createdAt: Date;
};

export type VendorMatchResult = {
  vendor: Vendor;
  aliasUsed?: string;
  score: number;
};

/**
 * Levenshtein distance algorithm for fuzzy matching
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1,
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize a string for comparison (lowercase, remove extra spaces)
 */
function normalizeString(str: string): string {
  return str.toLowerCase().replace(/\s+/g, ' ').trim();
}

/**
 * Find the best matching vendor for a given name using fuzzy string matching
 */
export async function matchVendor(
  workspaceId: string,
  extractedName: string,
  threshold: number = 0.7,
): Promise<VendorMatchResult | null> {
  const normalizedInput = normalizeString(extractedName);
  const inputLength = normalizedInput.length;

  // Get all active vendors and their aliases for this workspace
  const [vendors] = await prisma.$transaction([
    prisma.vendor.findMany({
      where: { workspaceId, isActive: true },
      include: { aliases: true },
    }),
  ]);

  if (vendors.length === 0) return null;

  let bestMatch: VendorMatchResult | null = null;
  let bestScore = 0;

  for (const vendor of vendors) {
    // Check canonical name
    const vendorNormalized = normalizeString(vendor.canonicalName);
    const distance = levenshteinDistance(normalizedInput, vendorNormalized);
    const maxLength = Math.max(normalizedInput.length, vendorNormalized.length);
    const score = maxLength > 0 ? 1 - distance / maxLength : 1;

    if (score > bestScore && score >= threshold) {
      bestScore = score;
      bestMatch = { vendor, score };
    }

    // Check aliases
    for (const alias of vendor.aliases) {
      const aliasNormalized = normalizeString(alias.name);
      const aliasDistance = levenshteinDistance(normalizedInput, aliasNormalized);
      const aliasMaxLength = Math.max(normalizedInput.length, aliasNormalized.length);
      const aliasScore = aliasMaxLength > 0 ? 1 - aliasDistance / aliasMaxLength : 1;

      if (aliasScore > bestScore && aliasScore >= threshold) {
        bestScore = aliasScore;
        bestMatch = { vendor, aliasUsed: alias.name, score: aliasScore };
      }
    }
  }

  return bestMatch;
}

export async function listVendors(workspaceId: string): Promise<Vendor[]> {
  return prisma.vendor.findMany({
    where: { workspaceId, isActive: true },
    include: { aliases: true },
    orderBy: { canonicalName: 'asc' },
  });
}

export async function getVendor(id: string, workspaceId: string): Promise<Vendor | null> {
  return prisma.vendor.findFirst({
    where: { id, workspaceId, isActive: true },
    include: { aliases: true },
  });
}

export async function createVendor(params: {
  workspaceId: string;
  name: string;
  taxId?: string | null;
  paymentTerms?: string | null;
  defaultGlCode?: string | null;
  defaultDepartment?: string | null;
  currency?: string | null;
  aliases?: string[];
}): Promise<Vendor> {
  const normalizedKey = normalizeString(params.name);

  const vendor = await prisma.vendor.create({
    data: {
      id: crypto.randomUUID(),
      workspaceId: params.workspaceId,
      canonicalName: params.name,
      normalizedKey,
      taxId: params.taxId || null,
      paymentTerms: params.paymentTerms || null,
      defaultGlCode: params.defaultGlCode || null,
      defaultDepartment: params.defaultDepartment || null,
      currency: params.currency || null,
      aliases: {
        create: (params.aliases || []).map((alias) => ({
          id: crypto.randomUUID(),
          name: alias,
          normalizedKey: normalizeString(alias),
        })),
      },
    },
    include: { aliases: true },
  });

  return {
    id: vendor.id,
    canonicalName: vendor.canonicalName,
    normalizedKey: vendor.normalizedKey,
    taxId: vendor.taxId,
    paymentTerms: vendor.paymentTerms,
    defaultGlCode: vendor.defaultGlCode,
    defaultDepartment: vendor.defaultDepartment,
    currency: vendor.currency,
    isActive: vendor.isActive,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
    aliases: vendor.aliases,
  };
}

export async function updateVendor(
  id: string,
  workspaceId: string,
  data: {
    name?: string;
    taxId?: string | null;
    paymentTerms?: string | null;
    defaultGlCode?: string | null;
    defaultDepartment?: string | null;
    currency?: string | null;
    isActive?: boolean;
    aliases?: { add?: string[]; remove?: string[] };
  },
): Promise<Vendor> {
  const updateData: Record<string, unknown> = {};

  if (data.name) {
    updateData.canonicalName = data.name;
    updateData.normalizedKey = normalizeString(data.name);
  }
  if (data.taxId !== undefined) updateData.taxId = data.taxId;
  if (data.paymentTerms !== undefined) updateData.paymentTerms = data.paymentTerms;
  if (data.defaultGlCode !== undefined) updateData.defaultGlCode = data.defaultGlCode;
  if (data.defaultDepartment !== undefined) updateData.defaultDepartment = data.defaultDepartment;
  if (data.currency !== undefined) updateData.currency = data.currency;
  if (data.isActive !== undefined) updateData.isActive = data.isActive;

  const vendor = await prisma.vendor.update({
    where: { id, workspaceId },
    data: updateData,
    include: { aliases: true },
  });

  return {
    id: vendor.id,
    canonicalName: vendor.canonicalName,
    normalizedKey: vendor.normalizedKey,
    taxId: vendor.taxId,
    paymentTerms: vendor.paymentTerms,
    defaultGlCode: vendor.defaultGlCode,
    defaultDepartment: vendor.defaultDepartment,
    currency: vendor.currency,
    isActive: vendor.isActive,
    createdAt: vendor.createdAt,
    updatedAt: vendor.updatedAt,
    aliases: vendor.aliases,
  };
}

export async function deleteVendor(id: string, workspaceId: string): Promise<void> {
  await prisma.vendor.updateMany({
    where: { id, workspaceId },
    data: { isActive: false },
  });
}
import { prisma } from '../prisma';

export type GlCodingMatch = {
  accountCode: string;
  department: string | null;
  ruleId: string;
};

/**
 * Automatically determine GL account and department cost-center based on workspace rules and vendor/item attributes.
 */
export async function autoCodeDocument(input: {
  workspaceId: string;
  vendorId?: string | null;
  vendorName?: string | null;
  description?: string | null;
  amount?: number | null;
}): Promise<GlCodingMatch | null> {
  const rules = await prisma.glCodingRule.findMany({
    where: { workspaceId: input.workspaceId, isActive: true },
    orderBy: { sortOrder: 'asc' },
  });

  for (const rule of rules) {
    let matched = false;

    // Check vendor match
    if (rule.vendorId && rule.vendorId === input.vendorId) {
      matched = true;
    }

    // Check keyword / condition match from JSON conditions
    if (!matched && rule.conditions) {
      const conditions = rule.conditions as Record<string, string>;
      for (const [key, value] of Object.entries(conditions)) {
        const targetValue = key === 'vendorName' ? input.vendorName : input.description;
        if (targetValue && targetValue.toLowerCase().includes(value.toLowerCase())) {
          matched = true;
          break;
        }
      }
    }

    if (matched) {
      return {
        accountCode: rule.accountCode,
        department: rule.department,
        ruleId: rule.id,
      };
    }
  }

  // Fallback to vendor default GL code if vendor is provided
  if (input.vendorId) {
    const vendor = await prisma.vendor.findUnique({
      where: { id: input.vendorId },
    });
    if (vendor && vendor.defaultGlCode) {
      return {
        accountCode: vendor.defaultGlCode,
        department: vendor.defaultDepartment,
        ruleId: 'vendor-default',
      };
    }
  }

  return null;
}
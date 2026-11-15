import { prisma } from '../prisma';
import { logger } from '../logger';

export type PublicPlan = {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  monthlyPageLimit: number;
  maxUploadMb: number;
  maxMembers: number;
  maxWorkspaces: number;
  features: string[];
  stripeConfigured: boolean;
};

export async function listPublicPlans(): Promise<PublicPlan[]> {
  try {
    const plans = await prisma.plan.findMany({ where: { isPublic: true }, orderBy: { sortOrder: 'asc' } });
    if (plans.length === 0) throw new Error('No plans seeded');
    return plans.map((plan) => ({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      currency: plan.currency,
      monthlyPageLimit: plan.monthlyPageLimit,
      maxUploadMb: plan.maxUploadMb,
      maxMembers: plan.maxMembers,
      maxWorkspaces: plan.maxWorkspaces,
      features: plan.features as string[],
      stripeConfigured: Boolean(plan.stripePriceId),
    }));
  } catch (error) {
    // Marketing pages must still render if the database is unavailable during
    // a cold start; pricing then reflects the documented catalogue defaults.
    logger.warn('plans_unavailable', { message: error instanceof Error ? error.message : 'unknown' });
    const { PLAN_SEEDS } = await import('../../config/plans');
    return PLAN_SEEDS.filter((plan) => plan.isPublic).map((plan) => ({
      code: plan.code,
      name: plan.name,
      description: plan.description,
      priceCents: plan.priceCents,
      currency: plan.currency,
      monthlyPageLimit: plan.monthlyPageLimit,
      maxUploadMb: plan.maxUploadMb,
      maxMembers: plan.maxMembers,
      maxWorkspaces: plan.maxWorkspaces,
      features: [...plan.features],
      stripeConfigured: Boolean(process.env[plan.stripePriceIdEnv]),
    }));
  }
}

export function planSupportsFormat(plan: { features: unknown; code: string }, format: 'csv' | 'xlsx'): boolean {
  if (format === 'csv') return true;
  const features = Array.isArray(plan.features) ? (plan.features as string[]) : [];
  return features.some((feature) => /xlsx/i.test(feature));
}

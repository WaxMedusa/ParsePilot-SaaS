/**
 * Plan catalogue seed source.
 *
 * The database `Plan` table is authoritative for entitlements at runtime —
 * the frontend never decides what a plan allows. This file only defines the
 * catalogue that `npm run db:seed` writes into PostgreSQL, so pricing and
 * limits can be changed without a code deploy in the future.
 */

export type PlanSeed = {
  code: string;
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  monthlyPageLimit: number;
  maxUploadMb: number;
  maxWorkspaces: number;
  maxMembers: number;
  features: string[];
  stripePriceIdEnv: string;
  isPublic: boolean;
  sortOrder: number;
};

export const PLAN_SEEDS: PlanSeed[] = [
  {
    code: 'free',
    name: 'Free',
    description: 'For evaluating ParsePilot on real documents.',
    priceCents: 0,
    currency: 'USD',
    monthlyPageLimit: 100,
    maxUploadMb: 10,
    maxWorkspaces: 1,
    maxMembers: 2,
    features: [
      '100 pages per month',
      '10 MB max file size',
      '2 team seats',
      'CSV exports',
    ],
    stripePriceIdEnv: '',
    isPublic: true,
    sortOrder: 0,
  },
  {
    code: 'starter',
    name: 'Starter',
    description: 'For small teams processing invoices every week.',
    priceCents: 4900,
    currency: 'USD',
    monthlyPageLimit: 1500,
    maxUploadMb: 25,
    maxWorkspaces: 1,
    maxMembers: 5,
    features: [
      '1,500 pages per month',
      '25 MB max file size',
      '5 team seats',
      'CSV and XLSX exports',
    ],
    stripePriceIdEnv: 'STRIPE_PRICE_STARTER',
    isPublic: true,
    sortOrder: 1,
  },
  {
    code: 'growth',
    name: 'Growth',
    description: 'For finance and operations teams with higher volume.',
    priceCents: 14900,
    currency: 'USD',
    monthlyPageLimit: 6000,
    maxUploadMb: 50,
    maxWorkspaces: 3,
    maxMembers: 20,
    features: [
      '6,000 pages per month',
      '50 MB max file size',
      '20 team seats',
      'CSV and XLSX exports',
    ],
    stripePriceIdEnv: 'STRIPE_PRICE_GROWTH',
    isPublic: true,
    sortOrder: 2,
  },
  {
    code: 'enterprise',
    name: 'Enterprise',
    description: 'For organisations that need contractual terms and scale.',
    priceCents: 0,
    currency: 'USD',
    monthlyPageLimit: 25000,
    maxUploadMb: 100,
    maxWorkspaces: 10,
    maxMembers: 100,
    features: [
      '25,000 pages per month',
      '100 MB max file size',
      '100 team seats',
      'Data processing agreement',
    ],
    stripePriceIdEnv: 'STRIPE_PRICE_ENTERPRISE',
    isPublic: true,
    sortOrder: 3,
  },
];

export function planSeedByCode(code: string): PlanSeed | undefined {
  return PLAN_SEEDS.find((plan) => plan.code === code);
}

/**
 * Seeds the plan catalogue and, in non-production environments only, an
 * optional synthetic demo account. Never creates demo users in production.
 *
 *   npm run db:seed
 */
import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'node:crypto';
import { PLAN_SEEDS } from '../src/config/plans';
import { hashPassword } from '../src/lib/auth/password';

const prisma = new PrismaClient();

async function seedPlans() {
  for (const plan of PLAN_SEEDS) {
    const stripePriceId = plan.stripePriceIdEnv ? process.env[plan.stripePriceIdEnv] ?? null : null;
    await prisma.plan.upsert({
      where: { code: plan.code },
      create: {
        code: plan.code,
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        monthlyPageLimit: plan.monthlyPageLimit,
        maxUploadMb: plan.maxUploadMb,
        maxWorkspaces: plan.maxWorkspaces,
        maxMembers: plan.maxMembers,
        features: plan.features,
        stripePriceId,
        isPublic: plan.isPublic,
        sortOrder: plan.sortOrder,
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceCents: plan.priceCents,
        currency: plan.currency,
        monthlyPageLimit: plan.monthlyPageLimit,
        maxUploadMb: plan.maxUploadMb,
        maxWorkspaces: plan.maxWorkspaces,
        maxMembers: plan.maxMembers,
        features: plan.features,
        stripePriceId,
        isPublic: plan.isPublic,
        sortOrder: plan.sortOrder,
      },
    });
  }
  console.log(`Seeded ${PLAN_SEEDS.length} plans`);
}

async function seedDemoAccount() {
  if (process.env.NODE_ENV === 'production') return;
  if (process.env.SEED_DEMO_USER !== 'true') return;

  const email = (process.env.SEED_DEMO_EMAIL ?? 'demo@parsepilot.test').toLowerCase();
  const password = process.env.SEED_DEMO_PASSWORD ?? `demo-${randomBytes(6).toString('hex')}`;
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log(`Demo user already exists: ${email}`);
    return;
  }

  const passwordHash = await hashPassword(password);
  const user = await prisma.user.create({
    data: {
      email,
      name: 'Demo Operator',
      passwordHash,
      emailVerifiedAt: new Date(),
    },
  });
  const workspace = await prisma.workspace.create({
    data: {
      name: 'Northwind Finance',
      slug: `northwind-finance-${randomBytes(3).toString('hex')}`,
      ownerId: user.id,
      billingEmail: email,
      planCode: 'free',
      members: { create: { userId: user.id, role: 'owner' } },
      subscription: { create: { planCode: 'free', status: 'active' } },
    },
  });
  console.log(`Created synthetic demo account ${email} / ${password} in workspace ${workspace.name}`);
}

async function main() {
  await seedPlans();
  await seedDemoAccount();
}

main()
  .catch((error) => {
    console.error('Seed failed', error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

import { describe, expect, it } from 'vitest';
import { PLAN_SEEDS } from './plans';

describe('public plan catalogue', () => {
  it('only advertises features that are implemented', () => {
    const unsupported = /priority|configurable retention|custom retention|email support|dedicated onboarding|multiple workspaces/i;
    for (const plan of PLAN_SEEDS) {
      for (const feature of plan.features) {
        expect(feature).not.toMatch(unsupported);
      }
    }
  });

  it('includes the team seat limit that invitations enforce', () => {
    for (const plan of PLAN_SEEDS) {
      expect(plan.features.some((feature) => feature.includes(`${plan.maxMembers} team seats`))).toBe(true);
    }
  });

  it('does not advertise upload sizes above what direct storage uploads allow', () => {
    for (const plan of PLAN_SEEDS) {
      expect(plan.maxUploadMb).toBeLessThanOrEqual(10);
      expect(plan.features.some((feature) => feature.includes(`${plan.maxUploadMb} MB max file size`))).toBe(true);
    }
  });

  it('keeps Free below the paid upload allowance so it stays an upgrade reason', () => {
    const free = PLAN_SEEDS.find((plan) => plan.code === 'free');
    const paid = PLAN_SEEDS.filter((plan) => plan.code !== 'free');
    expect(free?.maxUploadMb).toBe(4);
    for (const plan of paid) {
      expect(plan.maxUploadMb).toBeGreaterThan(free?.maxUploadMb ?? 0);
    }
  });

  it('grants XLSX exports on every paid plan', () => {
    for (const plan of PLAN_SEEDS) {
      const advertisesXlsx = plan.features.some((feature) => /xlsx/i.test(feature));
      expect(advertisesXlsx).toBe(plan.code !== 'free');
    }
  });
});

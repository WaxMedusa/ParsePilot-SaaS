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

  it('does not advertise upload sizes above the production platform ceiling', () => {
    for (const plan of PLAN_SEEDS) {
      expect(plan.maxUploadMb).toBeLessThanOrEqual(4);
      expect(plan.features.some((feature) => feature.includes(`${plan.maxUploadMb} MB max file size`))).toBe(true);
    }
  });
});

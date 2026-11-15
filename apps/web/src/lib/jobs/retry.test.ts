import { afterEach, describe, expect, it, vi } from 'vitest';
import { retryDelaySeconds } from './service';

describe('retryDelaySeconds', () => {
  afterEach(() => vi.restoreAllMocks());

  it('grows exponentially and caps at fifteen minutes', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    expect(retryDelaySeconds(1)).toBe(30);
    expect(retryDelaySeconds(2)).toBe(60);
    expect(retryDelaySeconds(3)).toBe(120);
    expect(retryDelaySeconds(4)).toBe(240);
    expect(retryDelaySeconds(20)).toBe(900);
  });

  it('adds bounded jitter and never drops below five seconds', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    expect(retryDelaySeconds(1)).toBe(27);
    expect(retryDelaySeconds(20)).toBe(810);
    vi.spyOn(Math, 'random').mockReturnValue(1);
    expect(retryDelaySeconds(20)).toBe(900);
    expect(retryDelaySeconds(0)).toBeGreaterThanOrEqual(5);
  });
});

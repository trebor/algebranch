import { describe, it, expect } from 'vitest';
import { shouldPulseHandle } from '@/components/handlePulse';

describe('shouldPulseHandle', () => {
  const base = { sourcePath: null, isHovered: false, isStackMarked: false, reducedMotion: false };

  it('pulses the hovered node’s handle', () => {
    expect(shouldPulseHandle({ ...base, isHovered: true })).toBe(true);
  });

  it('pulses an onboarding-marked handle even when not hovered', () => {
    expect(shouldPulseHandle({ ...base, isStackMarked: true })).toBe(true);
  });

  it('does not pulse a resting (non-hovered, unmarked) handle', () => {
    expect(shouldPulseHandle(base)).toBe(false);
  });

  it('suppresses the pulse while a transposition source is selected', () => {
    expect(shouldPulseHandle({ ...base, sourcePath: '0/1', isHovered: true })).toBe(false);
  });

  it('suppresses the pulse when the user prefers reduced motion', () => {
    // The pulse is decorative discoverability motion; prefers-reduced-motion
    // users get a still handle (still full-opacity, hue still codes the action).
    expect(shouldPulseHandle({ ...base, isHovered: true, reducedMotion: true })).toBe(false);
    expect(shouldPulseHandle({ ...base, isStackMarked: true, reducedMotion: true })).toBe(false);
  });
});

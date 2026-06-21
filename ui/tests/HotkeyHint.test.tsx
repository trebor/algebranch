import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, within } from '@testing-library/react';
import { HotkeyHint } from '@/components/HotkeyHint';

describe('HotkeyHint', () => {
  afterEach(cleanup);

  it('renders the label text', () => {
    render(<HotkeyHint label="Undo step" keys="⌘Z" />);
    expect(screen.getByText('Undo step')).toBeTruthy();
  });

  it('renders a single key as one keycap', () => {
    const { container } = render(<HotkeyHint label="Copy" keys="C" />);
    const caps = container.querySelectorAll('kbd');
    expect(caps).toHaveLength(1);
    expect(caps[0].textContent).toBe('C');
  });

  it('renders an array of keys as one keycap each, in order', () => {
    const { container } = render(<HotkeyHint label="Toggle sidebar" keys={['W', 'L']} />);
    const caps = within(container).getAllByText(/^[WL]$/);
    expect(caps.map((c) => c.textContent)).toEqual(['W', 'L']);
    expect(container.querySelectorAll('kbd')).toHaveLength(2);
  });

  it('renders a sequence as chips joined by "then"', () => {
    const { container } = render(<HotkeyHint label="Copy derivation" sequence={['C', 'D']} />);
    const caps = container.querySelectorAll('kbd');
    expect([...caps].map((c) => c.textContent)).toEqual(['C', 'D']);
    expect(container.textContent).toContain('then');
  });
});

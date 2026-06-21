import { describe, it, expect, vi } from 'vitest';
import { useState, useRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useFocusTrap } from '@/hooks/useFocusTrap';

/**
 * Test harness: a trigger button that opens a dialog using useFocusTrap.
 * Mirrors the real modal shape — a container holding focusable controls.
 */
function DialogHarness({ onClose }: { onClose?: () => void }) {
  const [open, setOpen] = useState(false);
  const close = () => {
    onClose?.();
    setOpen(false);
  };
  const ref = useFocusTrap<HTMLDivElement>({ isOpen: open, onClose: close });
  return (
    <div>
      <button onClick={() => setOpen(true)}>open</button>
      {open && (
        <div ref={ref} role="dialog" aria-modal="true" aria-label="test dialog">
          <button>first</button>
          <button>middle</button>
          <button>last</button>
        </div>
      )}
    </div>
  );
}

describe('useFocusTrap', () => {
  it('moves focus into the dialog when it opens', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps focus from the last element back to the first on Tab', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    screen.getByRole('button', { name: 'last' }).focus();
    await user.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('wraps focus from the first element to the last on Shift+Tab', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    screen.getByRole('button', { name: 'first' }).focus();
    await user.tab({ shift: true });
    expect(screen.getByRole('button', { name: 'last' })).toHaveFocus();
  });

  it('recaptures focus into the dialog on Tab when focus escaped to the body', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    // Simulate another overlay stealing then releasing focus to the body.
    (document.activeElement as HTMLElement | null)?.blur();
    expect(document.body).toHaveFocus();

    await user.tab();
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();
  });

  it('ignores Escape when focus is on a separate surface outside the dialog', async () => {
    // Models a non-modal banner layered over a trapped dialog: Escape while
    // focus sits on that other surface must not close the underlying dialog.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'open' });
    await user.click(trigger);

    // Move focus to an element outside the dialog container.
    trigger.focus();
    expect(trigger).toHaveFocus();

    await user.keyboard('{Escape}');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('keys Escape off the event origin, not where focus moved mid-event', async () => {
    // Models a sibling overlay that, on Escape, dismisses and restores focus
    // INTO this dialog before the event reaches the trap. The trap must not
    // close: the Escape originated outside, even though focus is now inside.
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    const trigger = screen.getByRole('button', { name: 'open' });
    await user.click(trigger);
    expect(screen.getByRole('button', { name: 'first' })).toHaveFocus();

    // Escape whose target is the outside trigger, while focus is inside.
    fireEvent.keyDown(trigger, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('calls onClose when Escape is pressed', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    render(<DialogHarness onClose={onClose} />);
    await user.click(screen.getByRole('button', { name: 'open' }));

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('honors an explicit initialFocusRef over the first focusable', async () => {
    const user = userEvent.setup();
    function Harness() {
      const [open, setOpen] = useState(false);
      const target = useRef<HTMLButtonElement>(null);
      const ref = useFocusTrap<HTMLDivElement>({
        isOpen: open,
        onClose: () => setOpen(false),
        initialFocusRef: target,
      });
      return (
        <div>
          <button onClick={() => setOpen(true)}>open</button>
          {open && (
            <div ref={ref} role="dialog" aria-modal="true" aria-label="d">
              <button>first</button>
              <button ref={target}>target</button>
            </div>
          )}
        </div>
      );
    }
    render(<Harness />);
    await user.click(screen.getByRole('button', { name: 'open' }));
    expect(screen.getByRole('button', { name: 'target' })).toHaveFocus();
  });

  it('restores focus to the trigger when the dialog closes', async () => {
    const user = userEvent.setup();
    render(<DialogHarness />);
    const trigger = screen.getByRole('button', { name: 'open' });
    await user.click(trigger);
    expect(trigger).not.toHaveFocus();

    await user.keyboard('{Escape}');
    expect(trigger).toHaveFocus();
  });
});

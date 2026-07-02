// SPDX-License-Identifier: GPL-3.0-or-later
// Copyright (C) 2026 Robert Harris

import React from 'react';
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ImaginaryUnitButton } from '@/components/ImaginaryUnitButton';
import { IMAGINARY_UNIT, IMAGINARY_UNIT_HINT } from '@/constants/mathSymbols';

afterEach(cleanup);

const Harness: React.FC<{ disabled?: boolean }> = ({ disabled }) => {
  const ref = React.useRef<HTMLInputElement>(null);
  const [val, setVal] = React.useState('3+2');
  return (
    <div>
      <input ref={ref} value={val} onChange={(e) => setVal(e.target.value)} />
      <ImaginaryUnitButton inputRef={ref} onInsert={setVal} disabled={disabled} />
    </div>
  );
};

describe('ImaginaryUnitButton', () => {
  it('inserts the imaginary unit at the end of the field', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    input.setSelectionRange(3, 3);
    await user.click(screen.getByRole('button', { name: /insert imaginary unit/i }));
    expect(input.value).toBe(`3+2${IMAGINARY_UNIT}`);
  });

  it('does nothing when disabled', async () => {
    const user = userEvent.setup();
    render(<Harness disabled />);
    const input = screen.getByRole('textbox') as HTMLInputElement;
    await user.click(screen.getByRole('button', { name: /insert imaginary unit/i }));
    expect(input.value).toBe('3+2');
  });

  it('renders an upright (non-italic) i so it reads as the unit', () => {
    render(<Harness />);
    const glyph = screen.getByText('i');
    expect(glyph.className).toContain('not-italic');
  });

  it('uses the app tooltip (no ugly native title attribute)', () => {
    render(<Harness />);
    expect(screen.getByRole('button', { name: /insert imaginary unit/i })).not.toHaveAttribute('title');
  });

  it('shows the "i = √−1" identification on hover, matching the glyph hint', async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.hover(screen.getByRole('button', { name: /insert imaginary unit/i }));
    await waitFor(() => expect(screen.getByText(IMAGINARY_UNIT_HINT)).toBeInTheDocument());
  });
});

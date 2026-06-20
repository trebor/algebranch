import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';

/**
 * Smoke test that proves the UI test harness is wired correctly:
 * jsdom rendering, @testing-library/react, jest-dom matchers, and user-event
 * all function. Real component a11y tests build on this baseline (#145).
 */
describe('ui test harness', () => {
  it('renders a component and resolves the @ path alias to jsdom', () => {
    render(<button aria-label="close">x</button>);
    // jest-dom matcher
    expect(screen.getByRole('button')).toHaveAccessibleName('close');
  });

  it('handles user-event interaction', async () => {
    const user = userEvent.setup();
    function Counter() {
      const [n, setN] = useState(0);
      return <button onClick={() => setN((v) => v + 1)}>count: {n}</button>;
    }
    render(<Counter />);
    const btn = screen.getByRole('button');
    expect(btn).toHaveTextContent('count: 0');
    await user.click(btn);
    expect(btn).toHaveTextContent('count: 1');
  });
});

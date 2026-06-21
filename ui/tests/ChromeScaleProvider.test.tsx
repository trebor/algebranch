import { describe, it, expect, afterEach } from 'vitest';
import { render, cleanup, act } from '@testing-library/react';
import { Provider, createStore } from 'jotai';
import { ChromeScaleProvider } from '@/components/ChromeScaleProvider';
import { rawSettingsAtom, DEFAULT_SETTINGS } from '@/store/equation';

function renderWithScale(chromeScale: number) {
  const store = createStore();
  store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, chromeScale });
  const result = render(
    <Provider store={store}>
      <ChromeScaleProvider>
        <div>child</div>
      </ChromeScaleProvider>
    </Provider>,
  );
  return { store, ...result };
}

describe('ChromeScaleProvider', () => {
  afterEach(() => {
    cleanup();
    document.documentElement.style.removeProperty('--chrome-scale');
  });

  it('renders its children', () => {
    const { getByText } = renderWithScale(1);
    expect(getByText('child')).toBeTruthy();
  });

  it('writes the chrome scale to the document root as a CSS variable', () => {
    renderWithScale(1.3);
    expect(document.documentElement.style.getPropertyValue('--chrome-scale')).toBe('1.3');
  });

  it('clamps an out-of-range persisted scale before applying it', () => {
    renderWithScale(99);
    // 99 is past the largest supported step (1.5); it must be clamped.
    expect(document.documentElement.style.getPropertyValue('--chrome-scale')).toBe('1.5');
  });

  it('updates the root variable live when the setting changes', () => {
    const { store } = renderWithScale(1);
    expect(document.documentElement.style.getPropertyValue('--chrome-scale')).toBe('1');
    act(() => {
      store.set(rawSettingsAtom, { ...DEFAULT_SETTINGS, chromeScale: 1.15 });
    });
    expect(document.documentElement.style.getPropertyValue('--chrome-scale')).toBe('1.15');
  });
});

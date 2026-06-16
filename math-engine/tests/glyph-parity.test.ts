import { GREEK_UNICODE } from '../src/serialize';
// Cross-workspace import of the UI's display map (a pure, import-free constants
// module) to guard the two Greek glyph tables against silent drift (#46): the
// Unicode export must match what the renderer shows on screen.
import { SYMBOL_DISPLAY } from '../../ui/src/constants/mathSymbols';

describe('engine Unicode Greek glyphs stay in lockstep with the UI display map (#46)', () => {
  it('covers exactly the same Greek names the UI renders', () => {
    expect(Object.keys(GREEK_UNICODE).sort()).toEqual(Object.keys(SYMBOL_DISPLAY).sort());
  });

  it('agrees with SYMBOL_DISPLAY on every glyph', () => {
    for (const [name, glyph] of Object.entries(GREEK_UNICODE)) {
      expect(SYMBOL_DISPLAY[name]).toBe(glyph);
    }
  });
});

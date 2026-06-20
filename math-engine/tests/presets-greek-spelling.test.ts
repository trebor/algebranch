import { PRESET_LIST } from '../../ui/src/constants/presets';
import { parseEquation } from '../src';

// Guard for the physics-preset re-spelling (#114): a few presets used a Latin
// stand-in (D, L) where the field convention is a Greek symbol. With #65's
// render-time glyph map, spelling them out as `rho`/`lambda` makes the formula
// render authentically (ρ, λ) while the data stays ASCII.
describe('Preset equations', () => {
  test('every preset equation still parses', () => {
    for (const preset of PRESET_LIST) {
      expect(() => parseEquation(preset.equation)).not.toThrow();
    }
  });

  test('physics presets use conventional Greek spellings (#114)', () => {
    const density = PRESET_LIST.find((p) => p.id === 'thermo_density');
    const wave = PRESET_LIST.find((p) => p.id === 'physics_wave');
    expect(density?.equation).toBe('rho = m / V');
    expect(wave?.equation).toBe('v = f * lambda');
  });
});

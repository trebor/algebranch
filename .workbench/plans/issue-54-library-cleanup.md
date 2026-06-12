---
status: active
issue: "#54 — feat: clean, reorganize, and add search to the equation library"
branch: feat/library-cleanup
updated: 2026-06-12
---

# #54 Equation Library Cleanup & Search Design & Execution Plan

## 1. Context & Objectives
The equation library (currently defined in `ui/src/constants/presets.ts`) serves as a starting point for users to explore algebra and calculus derivations. Currently, it has many presets, but some may be redundant, some debugging equations are still present, and there is no way for the user to search through them. 

We want to:
1. **Clean & Complete the Library**: Add missing classical equations/formulas while removing debugging/redundant equations.
2. **Orthogonal Examples**: Make sure each category has distinct structural/pedagogical lessons.
3. **Structured Grouping**: Clean up categories into a unified list.
4. **Searchable Library**: Add a filter/search bar inside the UI (both Desktop Sidebar and Mobile Bottom Sheet) for presets.

---

## 2. Detailed Requirements & Design

### 2.1 Library Reorganization & Categories
We will reorganize the preset list into the following logical, distinct categories:
- **Linear & Basic Algebra**: E.g., `2 * x + 4 = 10`, `3 * x + 5 = x + 13` (two-sided), `3 * (x - 2) = 18` (distribution).
- **Quadratics & Polynomials**: E.g., `x^2 - 4 = 0` (difference of squares), `3 * x^2 + 5 * x - 2 = 0` (general quadratic), `x^3 - 8 = 0` (difference of cubes), factoring identities.
- **Fractions, Radicals & Rationals**: E.g., `(x + 4) / 2 = y - 1`, `a / b = c / d` (proportions), `sqrt(x) + 2 = 5` (radical).
- **Transcendental (Logs & Trig)**: E.g., log rules like `log(x * y) = 5`, trig definitions like `tan(x) = y`, trig identities.
- **Physics & Science Formulas**: E.g., `F = m * a`, `E = m * c^2`, `P * V = n * R * T`.

*Action*:
- Remove any redundant or debugging presets. (Verify presets that do not match rule verification tests or are purely duplicate steps).
- Ensure examples teach orthogonal concepts.

### 2.2 Searchable Library UI
We will add a search bar at the top of the Library tab/sidebar.
- **Location**:
  - **Desktop**: In `<ControlPanel />` or `<Sidebar />` under the "Library" section, above the categories accordion.
  - **Mobile**: In the Library bottom sheet.
- **Features**:
  - Filter by title/label, category, equation string, and variables.
  - Smooth search transitions with clear state and "No results found" placeholder.
- **Styling**:
  - Use glassmorphic tokens like `THEME_GLASS.INPUT` or equivalent semantic theme constants.
  - Include search icon on the left, close/clear button on the right.

---

## 3. Implementation Steps

### Phase 1: Clean & Curate Presets (`presets.ts`)
- [ ] Review `ui/src/constants/presets.ts` and curate the equations.
- [ ] Ensure all presets are compatible with the math-engine parser and match rule integration tests in `math-engine/tests/presets.test.ts`.

### Phase 2: Add Search State & Logic
- [ ] Create a new Atom `presetSearchQueryAtom` in `ui/src/store/equation.ts`.
- [ ] Create a derived Atom `filteredPresetsAtom` that filters `presetsAtom` based on title, category, formula string, and variables.
- [ ] Update `presetCategoriesAtom` to group the *filtered* presets instead of the raw list.

### Phase 3: Build Search UI Component
- [ ] Implement the search input component in the library UI.
- [ ] Verify accessibility, keyboard navigation (Escape key clears search), and visual states.
- [ ] Test styling under both light and dark themes using Glassmorphism tokens.

### Phase 4: Verification & Test Coverage
- [ ] Run `npm test` to verify math engine and preset validation tests still pass.
- [ ] Run `npm run build` to ensure type check and Next.js compiler correctness.

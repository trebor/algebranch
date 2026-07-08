# Algebranch Features Reference

[User Guide](user-guide.md) • [**Features Reference**](features.md) • [Scope & Capabilities](scope.md) • [FAQ](faq.md) • [Documentation Index](index.md)

---

A brief entry for every transposition, transform, and interface feature in Algebranch.

---

## 1. Core Mathematical Manipulations

### Transposition (Moving Terms)
*   **Within-Side Moves**: Click and rearrange terms on the same side of the equation. Algebranch uses interval arithmetic to verify that the value of the parent expression is unchanged.
*   **Cross-Side Moves**: Move a term across the equals sign. The math engine automatically balances the operation:
    *   Addition (`+`) transposes to subtraction (`-`).
    *   Subtraction (`-`) transposes to addition (`+`).
    *   Multiplication (`*`) transposes to division (`/`).
    *   Division (`/`) transposes to multiplication (`*`).

### Global Operations (The `=` Menu)
Clicking the circled `=` operator opens the global operations menu, letting you apply the same mathematical change to both sides of the equation simultaneously:
*   **Addition / Subtraction**: Add or subtract an expression on both sides.
*   **Multiplication / Division**: Multiply or divide both sides by a non-zero term.
*   **Exponents (Power)**: Raise both sides of the equation to a power (e.g. square both sides).
*   **Roots (Sqrt / Nth-Root)**: Take the square root or nth-root of both sides.
*   **Swap Sides**: Flip the entire left-hand side (LHS) and right-hand side (RHS) of the equation.

### Simplify & Expand
*   **Simplify**: Calculates constant operations (e.g. `2 * 5` becomes `10`), cancels inverse terms (e.g. `x + 3 - 3` becomes `x`), and reduces algebraic expressions.
*   **Expand / Distribute**: Applies multiplication across parentheses (e.g., `3 * (x - 2)` expands to `3 * x - 6` or `(x + 2) * (x + 3)` expands to `x^2 + 5 * x + 6`).

---

## 2. Advanced Algebraic Identities & Transforms

### Factoring
*   **Common Factoring**: Factor out single terms or multivariate greatest common factors (GCF) from expressions (e.g. `2 * x + 6` factors to `2 * (x + 3)`, and `x * y + x * z` factors to `x * (y + z)`).
*   **Polynomial Factoring**: Factoring quadratic trinomials and higher-order polynomials into binomial products.

### Completing the Square
*   Rewrites quadratic expressions of the form `x^2 + b * x` into a completed square representation: `(x + b/2)^2 - (b/2)^2`.

### Perfect Powers
*   Click constants to express them as perfect powers (e.g. rewrite `64` as `8^2` or `4^3` to reveal base relationships).

### Combining Fractions
*   Combines multiple fractions over a common denominator (e.g. `a / b + c / d` becomes `(a * d + b * c) / (b * d)`).

### Radicals & Irrational Numbers
*   **Radical Simplification**: Factor out perfect powers from inside roots (e.g. `sqrt(8)` simplifies to `2 * sqrt(2)`).
*   **Rationalization**: Multiply numerators and denominators to eliminate roots in denominators.
*   **Exact Irrationals**: Native, exact mathematical support for constants like $e$ and $\pi$.
*   **Complex Numbers**: Extend negative square roots to the imaginary domain (e.g. `sqrt(-4)` becomes `2 * ⅈ` using the dedicated Unicode symbol `ⅈ` to avoid variable conflicts). Supports complex denominator rationalization by multiplying by the conjugate, and simplifies powers of `ⅈ` (such as `ⅈ^2` to `-1`). Controlled via the `allowComplex` setting (enabled by default).

### Substitution & Reverse Substitution
*   **Substitution**: Swap any variable for a known equivalent expression defined in another workspace (e.g., if you have `y = 2 * x` in one workspace, you can click `y` in another workspace to substitute it with `2 * x`).
*   **Reverse Substitution**: Collapse a complex multi-term expression into a single placeholder variable to clean up a derivation, and expand it back later when needed.

### Inequalities
*   Full support for inequality relationships (`<`, `>`, `<=`, `>=`).
*   Automatically preserves inequality rules during transpositions, including flipping the inequality direction when multiplying or dividing both sides by a negative coefficient.

### Absolute Value
*   **Splitting and Combining**: Split the absolute value of products and quotients (e.g. `abs(x * y)` becomes `abs(x) * abs(y)`, or `abs(x / y)` becomes `abs(x) / abs(y)`) and combine them back.
*   **Square of Absolute Value**: Simplify the square of an absolute value to its plain argument squared (`abs(x)^2` becomes `x^2`).
*   **Root of a Square**: Simplify the principal root of a square to its absolute value (`sqrt(x^2)` becomes `abs(x)`) or expand an absolute value back as a root (`abs(x)` becomes `sqrt(x^2)`).

---

## 3. Application Features

### Equation Input
*   Separate left-side and right-side fields with a **relation selector** between them: pick `=`, `<`, `>`, `<=`, or `>=`.
*   Set the relation by clicking the selector, by typing `=`/`<`/`>` in a side (which jumps focus to the other side), or by pasting a full expression — the relation is detected and the sides are split automatically.

### Dynamic Graphing
*   Plots both sides of your equation as separate curves on shared axes, so you can see the relationship visually.
*   Marks the intersection points — the solutions — and lets you hover for a live readout of each side's value at any point, or drag to pan around the plot.
*   Available for single-variable equations.

### Equation Library
*   Contains 83 preset equations organized into five categories:
    1.  Linear & Basic Algebra
    2.  Quadratics & Polynomials
    3.  Fractions, Radicals & Rationals
    4.  Transcendental, Logs & Trig
    5.  Physics, Geometry & Science Formulas

### Workspaces & Tabs
*   Keep multiple derivations active at the same time in separate workspace tabs.
*   Allows equations in one tab to act as "known facts" for variable substitution in another tab.

### Share Links
*   **Share Equation**: A short `?eq=` link to just the starting equation; opens a fresh workspace.
*   **Share Derivation**: A compressed `?ws=` link scoped to the active derivation path only (the sequence of steps from the initial equation to your current step), resulting in a shorter URL.
*   **Share Workspace**: A compressed `?ws=` link that captures your full history tree (all steps and branches), current position, and active tab name. See [Deep Links & Sharing](user-guide.md#deep-links--sharing) for details.

### Clipboard & Export Integration
*   **LaTeX Export**: Copy your derivation history in LaTeX code, ready to paste directly into academic reports or editors.
*   **Unicode Export**: Copy derivations in clean, plain-text Unicode notation for readable copy-pasting.
*   **Idle Copy**: Pressing standard Copy (`Ctrl/Cmd + C`) without any active text selection automatically copies the current equation in Unicode text format to your clipboard.
*   **Paste-to-Open**: Pressing standard Paste (`Ctrl/Cmd + V`) while not focusing on a text input opens the **New Equation** dialog pre-seeded with your clipboard text (splitting on `=`, `<`, `>`, `<=`, or `>=` relations).

### Settings & Preferences
*   **Disable "Evaluate to Decimal"**: Toggle off decimal approximations to keep fractions, roots, and irrationals in their exact symbolic forms.
*   **Interface text size**: Scale the app's interface text — menus, labels, and buttons — across four steps from Default to Largest. The setting is independent of the equation canvas, which keeps fitting itself to the available space, and it persists in this browser. You can also cycle it from the keyboard with `T` and `Shift + T`.

### Keyboard Shortcuts

Single-key shortcuts work whenever you are *not* typing in a text field. Press `?` at any time to open the Help menu.

| Key | Action |
| --- | --- |
| `W` | Toggle the workspace panel |
| `L` | Toggle the equation library |
| `H` | Toggle the history sidebar |
| `Z` | Cycle history tree zoom level |
| `G` | Toggle the variable-relationship graph |
| `S` | Swap the two sides of the equation |
| `X` | Toggle Read view |
| `=` | Open the global equals menu (apply an operation to both sides) |
| `Esc` | Clear the current selection |
| `N` | New workspace |
| `[` / `]` | Previous / next workspace |
| `T` / `Shift + T` | Larger / smaller interface text |
| `A` | About Algebranch |
| `F` | Send feedback |
| `,` | Open settings |
| `K` | Show the keyboard-shortcuts overlay |
| `?` | Open Help (documentation links & shortcuts prompt) |

Copy and share live under the `C` leader — press `C`, then a second key:

| Sequence | Action |
| --- | --- |
| `C` then `D` | Copy the full derivation as text |
| `C` then `E` | Copy the current equation as text |
| `C` then `P` | Copy derivation share link (`?ws=…` active path only) |
| `C` then `W` | Copy a workspace share link (`?ws=…` full tree) |

With a modifier:

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Z` | Undo a step |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo a step |
| `Ctrl/Cmd + Backspace` | Close the current workspace |

When entering an equation, typing `=`, `<`, or `>` in either side sets the relation and jumps focus to the other side.

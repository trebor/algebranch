# Algebranch Features Reference

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
*   Factoring out common terms (e.g. `2 * x + 6` factors to `2 * (x + 3)`).
*   Factoring quadratic trinomials and higher-order polynomials into binomial products.

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

### Substitution & Reverse Substitution
*   **Substitution**: Swap any variable for a known equivalent expression defined in another workspace (e.g., if you have `y = 2 * x` in one workspace, you can click `y` in another workspace to substitute it with `2 * x`).
*   **Reverse Substitution**: Collapse a complex multi-term expression into a single placeholder variable to clean up a derivation, and expand it back later when needed.

### Inequalities
*   Full support for inequality relationships (`<`, `>`, `<=`, `>=`).
*   Automatically preserves inequality rules during transpositions, including flipping the inequality direction when multiplying or dividing both sides by a negative coefficient.

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
    3.  Rational & Radical Equations
    4.  Systems of Equations
    5.  Inequalities

### Workspaces & Tabs
*   Keep multiple derivations active at the same time in separate workspace tabs.
*   Allows equations in one tab to act as "known facts" for variable substitution in another tab.

### Share Links
*   **Share Equation**: A short `?eq=` link to just the starting equation; opens a fresh workspace.
*   **Share Workspace**: A `?ws=` link that compresses your full history tree, current position, and tab name into the URL; reopens the entire derivation as a new tab. See [Deep Links & Sharing](user-guide.md#deep-links--sharing) for details.

### LaTeX and Unicode Export
*   **LaTeX Export**: Copy your derivation history in LaTeX code, ready to paste directly into academic reports, homework documents, or LaTeX editors.
*   **Unicode Export**: Export derivations in clean, plain-text Unicode notation for readable copy-pasting into chat apps or documents.

### Settings & Preferences
*   **Disable "Evaluate to Decimal"**: Toggle off decimal approximations to keep fractions, roots, and irrationals in their exact symbolic forms.

### Keyboard Shortcuts

Single-key shortcuts work whenever you are *not* typing in a text field:

| Key | Action |
| --- | --- |
| `L` | Toggle the equation library |
| `W` | Toggle the workspace panel |
| `H` | Toggle the history sidebar |
| `G` | Toggle the variable-relationship graph |
| `Esc` | Deselect the current term |

With a modifier:

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + Z` | Undo a step |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo a step |
| `Ctrl/Cmd + Shift + S` | Swap the two sides of the equation |

When entering an equation, typing `=`, `<`, or `>` in either side sets the relation and jumps focus to the other side.

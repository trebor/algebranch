# Algebranch Features Reference

[User Guide](user-guide.md) • [**Features Reference**](features.md) • [Scope & Capabilities](scope.md) • [FAQ](faq.md) • [Documentation Index](index.md)

---

A brief entry for every transposition, transform, and interface feature in Algebranch.

---

## 1. Core Mathematical Manipulations

### Transposition: Moving Terms
*   **Within-Side Moves**: Click and rearrange terms on the same side of the equation. Algebranch uses interval arithmetic to verify that the value of the parent expression is unchanged.
*   **Cross-Side Moves**: Move a term across the equals sign. The math engine automatically balances the operation:
    *   Addition `+` transposes to subtraction `-`.
    *   Subtraction `-` transposes to addition `+`.
    *   Multiplication `*` transposes to division `/`.
    *   Division `/` transposes to multiplication `*`.

### Global Operations: The `=` Menu
Clicking the circled `=` operator opens the global operations menu, letting you apply the same mathematical change to both sides of the equation simultaneously:
*   **Addition / Subtraction**: Add or subtract an expression on both sides.
*   **Multiplication / Division**: Multiply or divide both sides by a non-zero term.
*   **Exponents**: Raise both sides to a power, such as squaring both sides.
*   **Roots**: Take the square root or nth-root of both sides.
*   **Swap Sides**: Flip the entire left-hand and right-hand sides of the equation.

### Operation Handles
When a sub-expression can be transformed in place, a coloured handle appears on it; clicking it opens a menu of the available moves. Handles come in five families:
*   **Simplify**, the amber ⚡ handle: calculate or reduce a sub-expression, such as `2 * 5` to `10` or `x + 3 - 3` to `x`.
*   **Expand**, an emerald handle: distribute a product over a sum, so `3 * (x - 2)` becomes `3 * x - 6` and `(x + 2) * (x + 3)` becomes `x^2 + 5 * x + 6`.
*   **Factor**, a teal handle: the inverse of Expand, so `2 * x + 6` becomes `2 * (x + 3)`.
*   **Rewrite**, an indigo handle: an equivalence-preserving restructure that is none of the above, such as completing the square, the quadratic formula, writing in standard form, combining fractions, or rationalizing a denominator.
*   **Substitute**, a violet handle: replace a variable with a known equivalent expression from another workspace.

The specific moves offered by the Expand, Factor, Rewrite, and Substitute handles are cataloged in the next section.

---

## 2. Advanced Algebraic Identities & Transforms

These are the specific in-place moves Algebranch offers. Factoring runs under the **Factor** handle and substitution under the **Substitute** handle. The algebraic identities that follow, such as completing the square, perfect powers, combining fractions, and the radical and absolute-value rules, are all **Rewrite** handles.

### Factoring
*   **Common Factoring**: Factor out single terms or multivariate greatest common factors from expressions, so `2 * x + 6` factors to `2 * (x + 3)` and `x * y + x * z` factors to `x * (y + z)`.
*   **Polynomial Factoring**: Factoring quadratic trinomials and higher-order polynomials into binomial products.

### Completing the Square
*   Rewrites quadratic expressions of the form `x^2 + b * x` into a completed square representation: `(x + b/2)^2 - (b/2)^2`.

### Perfect Powers
*   Click constants to express them as perfect powers, such as rewriting `64` as `8^2` or `4^3` to reveal base relationships.

### Combining Fractions
*   Combines multiple fractions over a common denominator, so `a / b + c / d` becomes `(a * d + b * c) / (b * d)`.

### Radicals & Irrational Numbers
*   **Radical Simplification**: Factor out perfect powers from inside roots, so `sqrt(8)` simplifies to `2 * sqrt(2)`.
*   **Rationalization**: Multiply numerators and denominators to eliminate roots in denominators.
*   **Exact Irrationals**: Native, exact mathematical support for constants like $e$ and $\pi$.
*   **Complex Numbers**: Extend negative square roots to the imaginary domain, so `sqrt(-4)` becomes `2 * ⅈ`, using the dedicated Unicode symbol `ⅈ` to avoid variable conflicts. Supports complex denominator rationalization by multiplying by the conjugate, and simplifies powers of `ⅈ` such as `ⅈ^2` to `-1`. The `allowComplex` setting controls this and is enabled by default.

### Substitution & Reverse Substitution
*   **Substitution**: Swap any variable for a known equivalent expression defined in another workspace. If you have `y = 2 * x` in one workspace, you can click `y` in another workspace to substitute it with `2 * x`.
*   **Reverse Substitution**: Collapse a complex multi-term expression into a single placeholder variable to clean up a derivation, and expand it back later when needed.

### Inequalities
*   Full support for the inequality relationships `<`, `>`, `<=`, and `>=`.
*   Automatically preserves inequality rules during transpositions, including flipping the inequality direction when multiplying or dividing both sides by a negative coefficient.

### Absolute Value
*   **Splitting and Combining**: Split the absolute value of products and quotients, so `abs(x * y)` becomes `abs(x) * abs(y)` and `abs(x / y)` becomes `abs(x) / abs(y)`, and combine them back.
*   **Square of Absolute Value**: Simplify the square of an absolute value to its plain argument squared, so `abs(x)^2` becomes `x^2`.
*   **Root of a Square**: Simplify the principal root of a square to its absolute value, so `sqrt(x^2)` becomes `abs(x)`, or expand an absolute value back as a root, so `abs(x)` becomes `sqrt(x^2)`.

---

## 3. Application Features

### Equation Input
*   Separate left-side and right-side fields with a **relation selector** between them: pick `=`, `<`, `>`, `<=`, or `>=`.
*   Set the relation by clicking the selector, by typing `=`, `<`, or `>` in a side, which jumps focus to the other side, or by pasting a full expression, which detects the relation and splits the sides automatically.

### Dynamic Graphing
*   Plots both sides of your equation as separate curves on shared axes, so you can see the relationship visually.
*   Marks the intersection points, the solutions, and lets you hover for a live readout of each side's value at any point, or drag to pan around the plot.
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
The **Share** button sends your work at a chosen scope, as either a short link or a self-contained link.
*   **Scopes**: **Whole workspace** sends every tab, branch, step, and the active selection; **This derivation** sends only the active path from the starting equation to your current step and makes a smaller link; **Just the equation** sends only the starting equation and opens a fresh workspace.
*   **Short link**, the default: a tiny, constant-size first-party link such as `algebranch.org/s#…`. Your browser encrypts the workspace and uploads only the ciphertext; the decryption key rides in the URL fragment after the `#` and never reaches the server, so shared work is stored but unreadable by us. It needs a connection to create.
*   **Self-contained link**: packs the whole scope into the URL itself, as a `?ws=…` link for a workspace or derivation or a `?eq=…` link for a single equation. Nothing is uploaded and it works offline, but the URL grows with your workspace. See [Deep Links & Sharing](user-guide.md#deep-links--sharing) for details.

### Clipboard & Export Integration
*   **LaTeX Export**: Copy your derivation history in LaTeX code, ready to paste directly into academic reports or editors.
*   **Unicode Export**: Copy derivations in clean, plain-text Unicode notation for readable copy-pasting.
*   **Idle Copy**: Pressing standard Copy, `Ctrl/Cmd + C`, without any active text selection copies the current equation to your clipboard in Unicode text.
*   **Paste-to-Open**: Pressing standard Paste, `Ctrl/Cmd + V`, while not focused on a text input opens the **Enter Equation** dialog pre-seeded with your clipboard text, splitting on `=`, `<`, `>`, `<=`, or `>=` relations.

### Settings & Preferences
*   **Disable "Evaluate to Decimal"**: Toggle off decimal approximations to keep fractions, roots, and irrationals in their exact symbolic forms.
*   **Interface text size**: Scale the app's interface text, including menus, labels, and buttons, across four steps from Default to Largest. The setting is independent of the equation canvas, which keeps fitting itself to the available space, and it persists in this browser. You can also cycle it from the keyboard with `T` and `Shift + T`.

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
| `=` | Open the global equals menu to apply an operation to both sides |
| `Esc` | Clear the current selection |
| `N` | New workspace |
| `[` / `]` | Previous / next workspace |
| `T` / `Shift + T` | Larger / smaller interface text |
| `A` | About Algebranch |
| `F` | Send feedback |
| `,` | Open settings |
| `K` | Show the keyboard-shortcuts overlay |
| `?` | Open Help with documentation links and a shortcuts prompt |

Copy and share live under the `C` leader. Press `C`, then a second key. Each chord copies a short link for that scope:

| Sequence | Action |
| --- | --- |
| `C` then `W` | Copy workspace link |
| `C` then `D` | Copy derivation link |
| `C` then `E` | Copy equation link |

With a modifier:

| Shortcut | Action |
| --- | --- |
| `Ctrl/Cmd + C` | Copy equation as text |
| `Ctrl/Cmd + V` | New equation from clipboard |
| `Ctrl/Cmd + Z` | Undo a step |
| `Ctrl/Cmd + Shift + Z` or `Ctrl/Cmd + Y` | Redo a step |
| `Ctrl/Cmd + Backspace` | Close the current workspace |

When entering an equation, typing `=`, `<`, or `>` in either side sets the relation and jumps focus to the other side.

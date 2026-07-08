# UI Debugging & Layout Verification Examples

This file documents a set of hand-to-reach-for equations and deep links for manual visual regression testing of the Algebranch user interface (handles, badges, overlaps, layout scaling, etc.).

---

## 💡 Key Architectural Constraints & Badging Grid

When reasoning about handles and badges in Algebranch, the math engine enforces several structural constraints on when overlays (stacking count and restriction warnings) can appear.

### Badging Matrix by Operation Class

<table>
  <thead>
    <tr>
      <th style="text-align: left;">Class</th>
      <th style="text-align: center; width: 10%;">Can Stack</th>
      <th style="text-align: center; width: 10%;">Can Warn</th>
      <th style="text-align: left; width: 50%;">Scenario &amp; Equation</th>
      <th style="text-align: center; width: 10%;">3000</th>
      <th style="text-align: center; width: 10%;">3001</th>
    </tr>
  </thead>
  <tbody>
    <!-- Simplify -->
    <tr>
      <td rowspan="4"><strong>Simplify</strong></td>
      <td rowspan="4" style="text-align: center;"><strong>Yes</strong></td>
      <td rowspan="4" style="text-align: center;"><strong>Yes</strong></td>
      <td style="font-size: 0.9em;"><strong>Stacking Only</strong>: constant subtrees. E.g. <code>x = 4/6</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%3D4%2F6">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%3D4%2F6">🔗</a></td>
    </tr>
    <tr>
      <td style="font-size: 0.9em;"><strong>Warning Only</strong>: variable cancellations. E.g. <code>x * (x - 1) / (x - 1) = 2</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%2A%28x-1%29%2F%28x-1%29%3D2">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%2A%28x-1%29%2F%28x-1%29%3D2">🔗</a></td>
    </tr>
    <tr>
      <td style="font-size: 0.9em;"><strong>No Overlays</strong>: standard simplification. E.g. <code>x = 1/2</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%3D1%2F2">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%3D1%2F2">🔗</a></td>
    </tr>
    <tr>
      <td colspan="3" style="text-align: left;"><strong>Both (N/A)</strong>: Mutually exclusive on a single handle.</td>
    </tr>
    <!-- Distribute -->
    <tr>
      <td><strong>Distribute</strong></td>
      <td style="text-align: center;"><strong>No</strong></td>
      <td style="text-align: center;"><strong>No</strong></td>
      <td style="font-size: 0.9em;"><strong>No Overlays</strong>: distribution expansion. E.g. <code>x = (x + 2) * 3</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%3D%28x%2B2%29%2A3">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%3D%28x%2B2%29%2A3">🔗</a></td>
    </tr>
    <!-- Identity (the "Apply Identity" handle; stack type `identity`) -->
    <tr>
      <td rowspan="2"><strong>Identity</strong></td>
      <td rowspan="2" style="text-align: center;"><strong>Yes</strong></td>
      <td rowspan="2" style="text-align: center;"><strong>No</strong></td>
      <td style="font-size: 0.9em;"><strong>Stacking Only</strong>: multiple equivalent rewrites (e.g. 64 = 8², 2⁶). E.g. <code>x = 64</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%3D64">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%3D64">🔗</a></td>
    </tr>
    <tr>
      <td style="font-size: 0.9em;"><strong>No Overlays</strong>: prime with no equivalent rewrites. E.g. <code>x = 3</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%3D3">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%3D3">🔗</a></td>
    </tr>
    <!-- Global -->
    <tr>
      <td rowspan="2"><strong>Global</strong></td>
      <td rowspan="2" style="text-align: center;"><strong>No</strong></td>
      <td rowspan="2" style="text-align: center;"><strong>Yes</strong></td>
      <td style="font-size: 0.9em;"><strong>Warning Only</strong>: dividing by variable expression (transpose/global). E.g. <code>x * y = 2</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%2Ay%3D2">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%2Ay%3D2">🔗</a></td>
    </tr>
    <tr>
      <td style="font-size: 0.9em;"><strong>No Overlays</strong>: adding or subtracting a term. E.g. <code>x + y = 2</code></td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%2By%3D2">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%2By%3D2">🔗</a></td>
    </tr>
    <!-- Substitute -->
    <tr>
      <td rowspan="2"><strong>Substitute</strong></td>
      <td rowspan="2" style="text-align: center;"><strong>Yes</strong></td>
      <td rowspan="2" style="text-align: center;"><strong>No</strong></td>
      <td style="font-size: 0.9em;"><strong>Stacking Only</strong>: multiple tabs define the variable differently. E.g. <code>x + y = 3</code> (with active tabs for <code>x = 2</code> and <code>x = 5</code>)</td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=x%2By%3D3">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=x%2By%3D3">🔗</a></td>
    </tr>
    <tr>
      <td style="font-size: 0.9em;"><strong>No Overlays</strong>: single variable replacement (no warning is generated even under a divisor). E.g. <code>1/x = 3</code> (with tab for <code>x = 2</code> or <code>x = 0</code>)</td>
      <td style="text-align: center;"><a href="http://localhost:3000/?eq=1%2Fx%3D3">🔗</a></td>
      <td style="text-align: center;"><a href="http://localhost:3001/?eq=1%2Fx%3D3">🔗</a></td>
    </tr>
  </tbody>
</table>

---

## 🔍 Overlay & Layout Verification Checklist

When navigating the live examples, verify these overlay placement and layout rules:

*   **Stacking count overlay**: *Retired (#435)* — Stacking count badges are no longer rendered on expression or history handles. Instead, multiple options are presented solely within the popover chooser menu.
*   **Domain-restriction warning** — placement differs by surface:
    *   On an **expression handle**, the restriction surfaces only in the handle's **hover tooltip** ("assuming x ≠ 0"); there is no corner overlay on the expression handle. (The branch-only `EquationNode`→`HandleBadge` adoption that drew a bottom-right ⚠ on the expression handle is intentionally **not** applied here.)
    *   On a **history connector handle** (#103), the restriction shows as a ⚠ sub-badge on the **bottom-right** corner of the edge handle, and the edge tooltip repeats the caveat.
*   **Sibling Handles**: When a term has multiple separate handles, they must align side-by-side without overlapping.
*   **Connector handle placement (#103)**: Each transition handle must sit centered on its connector's midpoint, clear of both node cards — including on diagonal branch edges and the ~44px loop bubbles.

---

## 🔗 History-Tree Transition Handles (#103)

In the History panel, **transition** badges live on the **connector into a node** (a property of the *step*), while **state** badges — contradiction / identity and the step index — stay on the **node** itself. The connector handle's icon always matches the handle you clicked to take the step: the whole ⚡ Simplify family (the engine ops `simplify` / `evaluate` / `quadratic` / `quadratic_standard_form`) renders the one ⚡ icon, never a stray letter glyph.

Take the step, then inspect the resulting connector in the History panel. Links are for `:3000` (Claude); swap the port to `:3001` for the Gemini worktree.

| What to verify | Equation | Link | Steps |
| :--- | :--- | :---: | :--- |
| ⚡ icon for an **evaluate** step (not `E`) | <code>2 + 3 = x</code> | <a href="http://localhost:3000/?eq=2%2B3%3Dx">🔗</a> | Click ⚡ on <code>2+3</code> (evaluates to 5); the edge shows ⚡. |
| ⚡ icon for a **quadratic-formula** step (not `Q`) | <code>x² − 5x + 6 = 0</code> | <a href="http://localhost:3000/?eq=x%5E2-5%2Ax%2B6%3D0">🔗</a> | Apply the quadratic formula; the edge shows ⚡. |
| Operation glyphs (− then ÷) on the edges | <code>2x + 3 = 7</code> | <a href="http://localhost:3000/?eq=2%2Ax%2B3%3D7">🔗</a> | Subtract 3, divide by 2; connectors show <code>−</code> then <code>/</code>. |
| Restriction ⚠ on the edge + tooltip caveat | <code>x² = x</code> | <a href="http://localhost:3000/?eq=x%5E2%3Dx">🔗</a> | Divide both sides by <code>x</code>; the connector carries a ⚠ and "assuming x ≠ 0". |
| Contradiction (state) stays on the **node** | <code>x + 1 = x + 2</code> | <a href="http://localhost:3000/?eq=x%2B1%3Dx%2B2">🔗</a> | Reach the false state; the red contradiction badge pins to the node corner while the transition rides the connector. |

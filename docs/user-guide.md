# Algebranch User Guide

[**User Guide**](user-guide.md) • [Features Reference](features.md) • [Scope & Capabilities](scope.md) • [FAQ](faq.md) • [Documentation Index](index.md)

---

## What to Know First

Three things shape how Algebranch works:

### 1. Your Work Stays on Your Computer
Everything you create—your active workspaces, equation history trees, and settings—is saved in **this browser's storage** (using keys prefixed with `algebranch_`).
*   **No account, no login.** The equations and derivations you build are never uploaded to a server.
*   **Optional anonymous analytics.** If you explicitly opt in, Algebranch collects anonymous, aggregated usage data (such as which features get used) to help us improve the app. This never includes the content of your equations or steps, and tracking is disabled by default. For more details on what we collect or to manage your preference, please read our [Privacy Policy](https://algebranch.org/privacy).
*   **The implication**: If you clear your browser's data, use a private browsing session, or switch to a different browser or device, your workspaces and history will not be there. To carry your work across devices, you must use **share links** or export your derivations.

### 2. Single-Device / Single-Browser by Design
Because there are no remote user accounts or database servers, your workspaces are bound to the specific browser and device where you created them. There is no automatic cloud syncing.

### 3. Why Two-Click, Not Drag-and-Drop
If you have used other interactive math tools, you might expect to drag terms across the screen. Algebranch intentionally uses a **two-click selection model** (Click to Select → Click to Place) for three key reasons:
1.  **Accessibility**: It lowers the motor-precision load required to interact with equations, which makes the app easier to use for people with motor difficulties or who find drag gestures hard to control.
2.  **Universal Mobile Support**: It provides an identical, consistent interaction model across desktop, tablet, and mobile phone viewports. It eliminates the conflict where dragging a term fights against scrolling the page on touchscreens.
3.  **Target Precision**: Mathematical terms can be small and highly nested (such as an exponent inside a fraction under a radical). Selecting a term highlights it in blue, and all mathematically valid destination slots light up in green *before* you commit to a move, so you can confirm where a term will land instead of aiming at a small target mid-drag.

---

## Getting Started

When you first open the app, you can start working in one of three ways:
1.  **Use the Onboarding Tutorial**: Click the onboarding guide to walk through the basic interactions.
2.  **Pick from the Library**: Click the **Equation Library** tab/button to choose from over 80 pre-built algebraic equations spanning linear algebra, quadratics, factoring, and more.
3.  **Write Your Own**: Click **Write Equation** or **Enter Equation** to type a custom equation using standard notation (e.g. `3*x - 4 = 11`). The input has a left side, a right side, and a **relation selector** between them. The relation defaults to `=`; click it to switch to an inequality (`<`, `>`, `<=`, or `>=`). You can also set the relation without the dropdown — typing `=`, `<`, or `>` in either side selects it and jumps to the other side, and pasting a full expression like `2*x + 1 <= 9` splits it across the two sides and sets the relation automatically.

---

## Core Interaction

Solving equations in Algebranch is built around a simple, loop-based interaction cycle:

```
[Select Term] ──(Click)──> [Identify Targets] ──(Click Target)──> [Auto-Balance]
```

1.  **Select a Term**: Click any interactive mathematical term. The term will highlight in blue, indicating it is selected (the **Source**).
2.  **Identify Targets**: Mathematically valid destinations (the **Targets**) will light up in emerald green.
3.  **Transpose**: Click any green target. Algebranch will move the term and automatically balance the math—such as flipping an addition to a subtraction (e.g., `+ 4` becomes `- 4`) when crossing the equals sign, or changing a multiplier to a divisor.
4.  **Simplify and Expand**:
    *   **Simplify**: When an operation can be calculated or simplified (such as `11 + 4` to `15`, or `sqrt(x^2)` to `x`), an amber handle (⚡) will appear.
    *   **Expand**: When terms can be distributed, expanded, or factored, similar operation handles appear.
    *   **Click to Open**: Unlike dragging, handles do not open on hover. Click a handle to open its operation menu showing the available transforms. Click it again or click outside to close the menu. Hovering over a handle shows a brief tooltip naming its operation class and highlights the specific subexpression it will affect.

### Live Previews & Visual Diffs

When solving, Algebranch provides instant visual feedback to help you plan your next step:
*   **Select-Term Preview**: Hovering over a candidate term (or holding/long-pressing it on mobile touch screens) previews what the equation will look like if you select it.
*   **Move Preview**: Once a term is selected, hovering (or long-pressing on touch) over any green target previews the transposed equation.
*   **Operation Preview**: Inside a handle's open menu, hovering over an option (or long-pressing it on touch) shows a preview of the simplified equation.
*   **Visual Diffs**: In all previews, Algebranch dims the parts of the equation that remain unchanged, keeping the new or modified terms fully bright and vivid. This visual diff lets you spot the exact outcome of an operation instantly.

---

## History Tree & Branching

Every transposition and simplification you make is a distinct step in your derivation. Algebranch tracks these steps in a visual **history tree**:
*   Every step is saved automatically.
*   You can click on any previous step in the history timeline to view the equation's state at that point.
*   If you make a new move from an earlier step, Algebranch does not overwrite your subsequent steps. Instead, it creates a **new branch** in the tree, allowing you to explore different solving strategies (e.g. factoring vs. completing the square) side-by-side.
*   **Loop detection**: If a move would return the equation to a state already in your tree, Algebranch doesn't add a redundant step. Instead it draws a compact **loop bubble** (marked with an ∞ icon) pointing back at the original step. Hover to see which step it leads to; click it to jump there. This keeps the tree from sprawling when you circle back to an earlier form.
*   **Domain-restriction warnings**: Some moves are only valid under an assumed condition — for example, dividing both sides by a term that could be zero is valid only if that term is non-zero. Algebranch still lets you make the move, but flags it: an "assuming x ≠ 0" caveat appears in the move menu before you commit, and the resulting step carries a warning-triangle badge (⚠) in the tree noting the condition it depends on. Watch for these — a step is only trustworthy where its assumed condition actually holds.

---

## Deep Links & Sharing

The **Share** button builds an encoded link you can copy and paste anywhere. It offers three sharing scopes to let you decide how much context to send:

*   **Share Workspace** — Compresses the entire workspace (all tabs, branches, steps, and active selection) into a `?ws=…` link. The recipient will see your complete history tree exactly as you left it. Key shortcut: `C` then `W`.
*   **Share Derivation** — Compresses only the active derivation path (the sequence of steps from the starting equation to your current step) into a `?ws=…` link. This is shorter than a full workspace link and focuses the reader on your specific solution. Key shortcut: `C` then `P`.
*   **Share Equation** — Creates a short `?eq=…` link holding only the starting equation, opening a fresh workspace with no history. (Retired to the Share menu; no keyboard chord).

### Link-Size Guidance & Advice
Because workspaces can grow large, Algebranch automatically measures the length of your share links and displays a size band badge in the Share menu:
*   🟢 **Tiny Link** (≤ 280 characters): Ideal for QR codes, tweets, or older chat clients.
*   🟢 **Compact Link** (≤ 2,000 characters): Safe for all modern web browsers and platforms.
*   🟡 **Large Link** (> 2,000 characters): Some chat apps or QR encoders may truncate links of this size. If your workspace link lands in this band, Algebranch will display a warning and suggest using the narrower **Share Derivation** or **Share Equation** options to keep the link safe.

You only need to encode characters like `+`, `=`, `/`, `(`, and `)` yourself if you manually write an `?eq=` link instead of using the Share button.

---

## Clipboard & Copy-Paste Integration

Algebranch features deep integration with your system clipboard for fast workflows without opening menus:
*   **Idle Copy**: If no text is selected on the screen, pressing standard Copy (`Ctrl/Cmd + C`) automatically copies the current equation in plain Unicode text.
*   **Instant Paste-to-Open**: Pressing standard Paste (`Ctrl/Cmd + V`) while not focused on an input field automatically opens the **New Equation** dialog pre-seeded with your clipboard text.
    *   If the pasted text contains an algebraic relation (`=`, `<`, `>`, `<=`, or `>=`), Algebranch splits the text across the sides and sets the relation selector automatically.

### Example Links
Each link opens a starting workspace directly on [algebranch.org](https://algebranch.org):
*   **Linear Equation (Chapter 1)** — `3 * x - 4 = 11` — [open](https://algebranch.org/?eq=3%20%2A%20x%20-%204%20%3D%2011)
*   **Quadratic Equation (Chapter 2)** — `x ^ 2 - 9 = 0` — [open](https://algebranch.org/?eq=x%20%5E%202%20-%209%20%3D%200)
*   **Difference of Squares (Chapter 3)** — `(x - 3) * (x + 3) = 0` — [open](https://algebranch.org/?eq=%28x%20-%203%29%20%2A%20%28x%20%2B%203%29%20%3D%200)
*   **Global Operations (Chapter 4)** — `x / 3 = 4` — [open](https://algebranch.org/?eq=x%20%2F%203%20%3D%204)
*   **Systems Substitution (Chapter 5)** — `y + 4 = 10` — [open](https://algebranch.org/?eq=y%20%2B%204%20%3D%2010)

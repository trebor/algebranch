# Algebranch User Guide

## What to Know First

Three things shape how Algebranch works:

### 1. Your Work Stays on Your Computer
Everything you create—your active workspaces, equation history trees, and settings—is saved in **this browser's storage** (using keys prefixed with `algebranch_`).
*   **No account, no login.** The equations and derivations you build are never uploaded to a server.
*   Algebranch may collect anonymous, aggregated usage data (such as which features get used) to improve the app. This never includes the content of your equations or steps.
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
    *   **Simplify**: When an operation can be calculated or simplified (such as `11 + 4` to `15`, or `sqrt(x^2)` to `x`), an amber handle will appear. Click the amber handle to perform the simplification.
    *   **Expand**: Click the amber handles to distribute terms, expand binomial products, or evaluate expressions.

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

The **Share** button builds a link you can paste into a browser or a chat app. It offers two kinds:

- **Share Equation** — a short link (`?eq=…`) holding just the starting equation. Opening it creates a fresh workspace at that equation, with no history. These are the links used throughout this documentation.
- **Share Workspace** — a link (`?ws=…`) holding your whole derivation: every step and branch of the history tree, your current position in it, and the tab name, all compressed into the URL. Opening it recreates the entire workspace as a new tab.

Both kinds are encoded for you, so they survive being pasted anywhere. A workspace link carries the full history tree, so it is far longer than an equation link — share the equation to hand someone a starting point, and the workspace to show them your work.

You only need to encode characters like `+`, `=`, `/`, `(`, and `)` yourself if you hand-write an `?eq=` link instead of using the Share button.

### Example Links
Each link opens a starting workspace directly on [algebranch.org](https://algebranch.org):
*   **Linear Equation (Chapter 1)** — `3 * x - 4 = 11` — [open](https://algebranch.org/?eq=3%20%2A%20x%20-%204%20%3D%2011)
*   **Quadratic Equation (Chapter 2)** — `x ^ 2 - 9 = 0` — [open](https://algebranch.org/?eq=x%20%5E%202%20-%209%20%3D%200)
*   **Difference of Squares (Chapter 3)** — `(x - 3) * (x + 3) = 0` — [open](https://algebranch.org/?eq=%28x%20-%203%29%20%2A%20%28x%20%2B%203%29%20%3D%200)
*   **Global Operations (Chapter 4)** — `x / 3 = 4` — [open](https://algebranch.org/?eq=x%20%2F%203%20%3D%204)
*   **Systems Substitution (Chapter 5)** — `y + 4 = 10` — [open](https://algebranch.org/?eq=y%20%2B%204%20%3D%2010)

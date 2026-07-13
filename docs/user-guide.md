# Algebranch User Guide

[**User Guide**](user-guide.md) • [Features Reference](features.md) • [Scope & Capabilities](scope.md) • [FAQ](faq.md) • [Documentation Index](index.md)

---

## What to Know First

### Your Work Stays on Your Computer
Everything you create, including your active workspaces, equation history trees, and settings, is saved in **this browser's storage** under keys prefixed with `algebranch_`.
*   **No account, no login.** The equations and derivations you build are never uploaded to a server.
*   **Optional anonymous analytics.** Our hosting platform records cookieless, aggregate traffic counts (page views, referrer, country, device type) that set no cookies and cannot identify you. If you explicitly opt in, Algebranch additionally collects anonymous, aggregated usage data such as which features get used, to help us improve the app. This never includes the content of your equations or steps, and tracking is disabled by default. For more detail on what we collect, or to change your preference, read our [Privacy Policy](https://algebranch.org/privacy).
*   **The implication.** If you clear your browser's data, use a private browsing session, or switch to a different browser or device, your workspaces and history will not be there. To carry your work across devices, use **share links** or export your derivations.

### Single-Device, Single-Browser by Design
There are no remote user accounts, so your workspaces are bound to the browser and device where you created them. There is no automatic cloud syncing.

### Why Two-Click, Not Drag-and-Drop
If you have used other interactive math tools, you might expect to drag terms across the screen. Algebranch uses a **two-click selection model** instead: click to select, then click to place. This lowers the motor precision needed to interact with equations, so it is easier for people who find drag gestures hard to control. It behaves the same on desktop, tablet, and phone, and it never fights the page scroll on a touchscreen the way a drag does. It is also more precise. Mathematical terms can be small and deeply nested, such as an exponent inside a fraction under a radical, so selecting a term highlights it in blue and lights up every valid destination in green *before* you commit, instead of asking you to aim at a tiny target mid-drag.

---

## Getting Started

When you first open the app, start from the buttons in the sidebar's **Define Equation** area:
*   **New** opens the **Enter Equation** dialog, where you type your own equation in standard notation such as `3*x - 4 = 11`. The dialog has a left side, a right side, and a **relation selector** between them. The relation defaults to `=`; click it to switch to an inequality such as `<`, `>`, `<=`, or `>=`. You can also set the relation without the dropdown: typing `=`, `<`, or `>` in either side selects it and jumps focus to the other side, and pasting a full expression like `2*x + 1 <= 9` splits it across the two sides and sets the relation automatically.
*   **Tutorial** starts an interactive, guided walkthrough of the basic interactions.
*   **Equation Library** opens a browsable set of over 80 preset equations spanning linear algebra, quadratics, factoring, and more.

---

## Core Interaction

Solving equations in Algebranch runs on a short, repeating cycle:

```
[Select Term] ──Click──> [Identify Targets] ──Click──> [Auto-Balance]
```

1.  **Select a term.** Click any interactive term. It highlights in blue to show it is the selected **source**.
2.  **Identify targets.** Every mathematically valid destination, the **targets**, lights up in emerald green.
3.  **Transpose.** Click any green target. Algebranch moves the term and balances the math for you, flipping an addition to a subtraction such as `+ 4` to `- 4` when crossing the equals sign, or turning a multiplier into a divisor.
4.  **Operation handles.** When a sub-expression can be transformed in place, a coloured handle appears on it. The amber ⚡ handle **simplifies**, such as `11 + 4` to `15`. Other handles cover the structural moves: **Expand**, its inverse **Factor**, **Rewrite** for identities like completing the square or the quadratic formula, and **Substitute** for swapping in a known value. A handle's colour and tooltip name its family.
    *   **Click to open.** Handles do not open on hover. Click a handle to open its menu and see the available transforms, then click it again or click outside to close. Hovering a handle shows a brief tooltip naming its family and highlights the sub-expression it will affect.

### Live Previews & Visual Diffs

Before you commit to a move, Algebranch shows you its result:
*   **Select-term preview.** Hover a candidate term, or hold it on a touchscreen, to preview what selecting it will do.
*   **Move preview.** With a term selected, hover or long-press a green target to preview the transposed equation.
*   **Operation preview.** Inside an open handle menu, hover or long-press an option to preview the simplified equation.
*   **Visual diffs.** In every preview, Algebranch dims the parts of the equation that stay the same and keeps the new or changed terms bright, so the outcome of a move is obvious at a glance.

---

## History Tree & Branching

Every transposition and simplification is a distinct step, and Algebranch records them in a visual **history tree**:
*   Every step is saved automatically.
*   Click any earlier step in the timeline to view the equation as it stood at that point.
*   Make a new move from an earlier step and Algebranch does not overwrite what followed. It opens a **new branch**, so you can explore different strategies such as factoring versus completing the square side by side.
*   **Loop detection.** If a move would return the equation to a state already in your tree, Algebranch skips the redundant step and instead draws a compact **loop bubble**, marked with an ∞ icon, pointing back at the original. Hover it to see where it leads, or click to jump there. This keeps the tree from sprawling when you circle back to an earlier form.
*   **Domain-restriction warnings.** Some moves are valid only under an assumed condition. Dividing both sides by a term that could be zero, for instance, is valid only when that term is non-zero. Algebranch still lets you make the move but flags it: an "assuming x ≠ 0" caveat appears in the move menu before you commit, and the resulting step carries a warning-triangle badge in the tree noting the condition. A step is only trustworthy where its condition actually holds, so watch for these.

---

## Deep Links & Sharing

The **Share** button builds a link you can copy and paste anywhere. Two things decide what it holds: the **scope** you pick, and the **kind** of link, where the menu defaults to a short one.

### Choosing a Scope
*   **Whole workspace** sends everything: every tab, branch, step, and the active selection. The recipient sees your complete history tree exactly as you left it. Keyboard: `C` then `W`.
*   **This derivation** sends only the active path, the steps from the starting equation to where you are now. It is smaller than a whole workspace and focuses the reader on your solution. Keyboard: `C` then `D`.
*   **Just the equation** sends only the starting equation, opening a fresh workspace with no history. Keyboard: `C` then `E`.

### Short vs. Self-Contained Links
Whichever scope you pick, the Share menu can send it two ways and leads with the short one:

*   **Short links** look like `algebranch.org/s#…` and stay the same small length no matter how large your workspace grows, so they are safe to post anywhere. To keep them short, Algebranch stores your work: your browser encrypts the workspace and uploads only the encrypted bytes, keeping the decryption key in the part of the link after the `#`, which your browser never sends to a server. So we store your share but cannot read it. Only someone who opens the link can, and decryption happens in their browser. Short links need a connection to create, so they are disabled when you are offline.
*   **Self-contained links** pack the whole scope into the URL itself, as a `?ws=…` link for a workspace or derivation or a `?eq=…` link for a single equation. No server is ever involved, nothing is uploaded, and you can build one offline. The tradeoff is length: a big workspace makes a long URL, which is where the size guidance below comes in. They live in the Share menu's "Links that work offline" section.

Either way, your work is never readable by us. The only difference is where the data lives: a short link stores encrypted bytes on a server, a self-contained link stores nothing.

### Link Size
Self-contained links grow with your workspace, so Algebranch measures each one and shows a size band beside it in the Share menu's offline section:
*   🟢 **Tiny**, up to 280 characters: fine for QR codes, tweets, or older chat clients.
*   🟢 **Compact**, up to 2,000 characters: safe for every modern browser and platform.
*   🟡 **Large**, over 2,000 characters: some chat apps or QR encoders may truncate it. When a workspace link lands here, Algebranch warns you and suggests the narrower **This derivation** or **Just the equation** instead.

You only need to encode characters like `+`, `=`, `/`, `(`, and `)` yourself if you write an `?eq=` link by hand instead of using the Share button.

---

## Clipboard & Copy-Paste Integration

Algebranch works with your system clipboard so you can move fast without opening menus:
*   **Idle copy.** With nothing selected on screen, standard Copy, `Ctrl/Cmd + C`, copies the current equation as plain Unicode text.
*   **Paste to open.** Standard Paste, `Ctrl/Cmd + V`, while you are not focused on an input field opens the **Enter Equation** dialog pre-seeded with your clipboard text. If that text contains a relation such as `=`, `<`, `>`, `<=`, or `>=`, Algebranch splits it across the two sides and sets the relation automatically.

### Example Links
Each link opens a starting workspace on [algebranch.org](https://algebranch.org):
*   **Linear equation** · `3 * x - 4 = 11` · [open](https://algebranch.org/?eq=3%20%2A%20x%20-%204%20%3D%2011)
*   **Quadratic equation** · `x ^ 2 - 9 = 0` · [open](https://algebranch.org/?eq=x%20%5E%202%20-%209%20%3D%200)
*   **Difference of squares** · `(x - 3) * (x + 3) = 0` · [open](https://algebranch.org/?eq=%28x%20-%203%29%20%2A%20%28x%20%2B%203%29%20%3D%200)
*   **Global operations** · `x / 3 = 4` · [open](https://algebranch.org/?eq=x%20%2F%203%20%3D%204)
*   **Systems substitution** · `y + 4 = 10` · [open](https://algebranch.org/?eq=y%20%2B%204%20%3D%2010)

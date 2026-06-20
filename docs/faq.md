# Frequently Asked Questions

### Is my work uploaded to a server?
**No — the math you work on stays on your device.** Your workspace tabs, equation steps, and settings are saved inside your own web browser. The equations and derivations you create are never uploaded, and there is no account or login.

We may collect anonymous, aggregated usage data—for example, which features get used—to understand how Algebranch is used and to improve it. That data never includes the content of your equations or steps. For more details on what we collect and how to opt out of analytics tracking, please read our [Privacy Policy](https://algebranch.org/privacy).

---

### Will Algebranch solve equations for me?
**No.** Algebranch is not a homework-solving black box. It will not automatically isolate variables or output a final answer. Instead, it is an interactive playground where **you** decide what moves to make. Algebranch acts as a mathematical guardrail, ensuring you don't make mistakes or sign errors, while leaving the strategy and solving process up to you.

---

### Why doesn't Algebranch use drag-and-drop?
We intentionally designed Algebranch with a **two-click selection model** (Click to Select → Click to Place) instead of dragging for several reasons:
1.  **Accessibility**: Dragging requires sustained motor precision, which can be difficult for users with motor difficulties or who use assistive input. A two-click model reduces that physical friction.
2.  **Mobile Usability**: Drag-and-drop gestures frequently conflict with native browser scrolling on smartphones and tablets. Two-click interactions avoid that conflict and behave the same way on touchscreens as on desktop.
3.  **Target Precision**: Math equations can be highly nested (e.g., exponents under fractions inside square roots). Click-selection allows the engine to accurately detect the boundaries of the term you want to move, showing you exactly where it can go *before* you place it.

---

### How do I save or share my work?
*   **Auto-Save**: Your work is saved automatically to your browser as you type or manipulate equations.
*   **Sharing**: Click the **Share** button. It offers two links — **Share Equation** (a short link to just the starting equation) and **Share Workspace** (a link carrying your full history tree — every step and branch — so the recipient sees your complete derivation). Both are encoded for you.
*   **Exporting Derivations**: If you want to submit your homework or copy your steps into another document, click the export buttons to copy the full step-by-step history as clean Unicode text or as LaTeX code.

---

### Does it work on mobile phones and tablets?
**Yes.** The interface is responsive, and the dynamic font scaler resizes complex equations to fit smaller screens. Because we use a two-click interaction model instead of drag-and-drop, the app works on touchscreens without fighting the browser's scroll gestures.

---

### Why is a certain move not allowed?
If you click a term but the destination you want does not highlight in green, it usually means the move would break the equality of the equation or violate an algebraic rule (such as dividing by zero). Algebranch checks the available actions in real time and only offers the ones it can guarantee are valid, which helps you avoid algebraic errors.

That said, if you are confident a move *is* valid and Algebranch isn't offering it, that may be a gap on our end rather than a real restriction. We would genuinely like to know — use the in-app **Feedback** button (Report a Bug), which opens a pre-filled [GitHub issue](https://github.com/trebor/algebranch/issues) (including a link back to your exact workspace) so we can take a look.

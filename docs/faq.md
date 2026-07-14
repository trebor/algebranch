# Frequently Asked Questions

[User Guide](user-guide.md) • [Features Reference](features.md) • [Scope & Capabilities](scope.md) • [**FAQ**](faq.md) • [Documentation Index](index.md)

---

### Is my work uploaded to a server?
**No. The math you work on stays on your device.** Your workspace tabs, equation steps, and settings are saved inside your own web browser. The equations and derivations you create are never uploaded, and there is no account or login.

Our hosting platform records cookieless, aggregate traffic counts (page views, referrer, country, device type) that set no cookies and cannot identify you. If you explicitly opt in, we additionally collect anonymous, aggregated usage data, such as which features get used, to understand how Algebranch is used and to improve it. That data is disabled by default and never includes the content of your equations or steps. For more detail on what we collect, or to change your preference, read our [Privacy Policy](https://algebranch.org/privacy).

---

### Will Algebranch solve equations for me?
**No.** Algebranch is not a homework-solving black box. It will not automatically isolate variables or output a final answer. Instead, it is an interactive playground where **you** decide what moves to make. Algebranch acts as a mathematical guardrail, ensuring you don't make mistakes or sign errors, while leaving the strategy and solving process up to you.

---

### What math can't Algebranch do?
Algebranch handles middle-school and high-school algebra, including linear equations, quadratic equations, complex numbers, factoring, and systems of equations. It does not currently support calculus, such as limits, derivatives, and integrals. It also does not support matrices, vectors, or unit conversions.

For a detailed breakdown of what is supported and what is not, see the [Scope & Capabilities](scope.md) page.

---

### Why doesn't Algebranch use drag-and-drop?
Algebranch uses a **two-click selection model**, click to select then click to place, instead of dragging. Dragging demands sustained motor precision, which is hard for people with motor difficulties or who use assistive input, and two clicks remove that friction. Drag gestures also fight native scrolling on phones and tablets, whereas two-click interactions behave the same on a touchscreen as on desktop. And because math is often deeply nested, such as an exponent under a fraction inside a square root, click-selection lets the engine detect the exact boundaries of the term and show you where it can go *before* you place it.

---

### How do I save or share my work?
*   **Auto-Save**: Your work is saved automatically to your browser as you type or manipulate equations.
*   **Sharing**: Click the **Share** button. **Whole workspace** sends everything, including all tabs, steps, and alternative branches; **This derivation** sends only your active solution path and makes a shorter link; **Just the equation** sends only the starting equation.
*   **Exporting Derivations**: To submit your homework or copy your steps into another document, click the export buttons to copy the full step-by-step history as clean Unicode text or as LaTeX code.
*   **Clipboard Shortcuts**: You can also use standard copy and paste gestures. `Ctrl/Cmd + C` copies the current equation as text, and `Ctrl/Cmd + V` on the workspace pastes and opens a new equation.

---

### Can Algebranch read the workspaces I share?
**No.** By default, Algebranch shares your work as a short link like `algebranch.org/s#…`. A short link stores something on a server, but it is built so we still can't read it: your browser encrypts the workspace before uploading, and only the encrypted bytes are stored. The key that unlocks them lives in the part of the link after the `#`, which browsers never send to a server, so we hold the ciphertext but never the key, and decryption happens only in the recipient's browser. You can also share a self-contained `?ws=` or `?eq=` link that carries your work inside the URL and uploads nothing at all. Either way, we can never read your mathematical work. See our [Privacy Policy](https://algebranch.org/privacy) for the full explanation.

---

### Does it work on mobile phones and tablets?
**Yes.** The interface is responsive, and the dynamic font scaler resizes complex equations to fit smaller screens. Because we use a two-click interaction model instead of drag-and-drop, the app works on touchscreens without fighting the browser's scroll gestures.

---

### Why is a certain move not allowed?
If you click a term but the destination you want does not highlight in green, it usually means the move would break the equality of the equation or violate an algebraic rule such as dividing by zero. Algebranch checks the available actions in real time and only offers the ones it can guarantee are valid, which helps you avoid algebraic errors.

That said, if you are confident a move *is* valid and Algebranch isn't offering it, that may be a gap on our end rather than a real restriction. We would genuinely like to know. Use the in-app **Feedback** button, choose **Bug**, and press **Send Feedback** — it goes straight to us with a link back to your exact workspace attached, and no account of any kind is required. If you would rather file it yourself, the same modal offers a **Prefer GitHub?** link that opens a pre-filled [GitHub issue](https://github.com/trebor/algebranch/issues) instead.
